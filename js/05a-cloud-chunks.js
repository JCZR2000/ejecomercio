        // ==========================================
        // 4a. TROZOS DE LA NUBE (Fase 4, schema: 2)
        // Funciones puras: sin Firestore ni DOM.
        // ==========================================
        const CHUNK_MAX_CHARS = 400000;

        function hashText(text) {
            return CryptoJS.SHA256(text).toString().slice(0, 16);
        }

        // Huella de la clave de cifrado: si cambia, se reescriben todos los trozos.
        function keyFingerprint() {
            return encryptionKey ? hashText('k:' + encryptionKey) : '';
        }

        function encryptJsonText(text) {
            return CryptoJS.AES.encrypt(text, encryptionKey).toString();
        }

        function decryptJsonText(cipher) {
            if (!encryptionKey) return null;
            try {
                return CryptoJS.AES.decrypt(cipher, encryptionKey).toString(CryptoJS.enc.Utf8) || null;
            } catch (e) {
                return null;
            }
        }

        // state.sales va de la más nueva a la más vieja; los trozos, al revés,
        // así una venta nueva solo cambia el último trozo.
        function splitSales(sales, maxChars = CHUNK_MAX_CHARS) {
            const chunks = [];
            let cur = [], size = 0;
            const flush = () => {
                // Fase 6: el hash en el id evita que un dispositivo atrasado pise un trozo que usa el otro
                if (cur.length) chunks.push({ id: 'sales_' + String(chunks.length).padStart(3, '0') + '_' + hashText(JSON.stringify(cur)).slice(0, 8), items: cur });
                cur = []; size = 0;
            };
            for (let i = (sales || []).length - 1; i >= 0; i--) {
                const len = JSON.stringify(sales[i]).length + 1;
                if (cur.length && size + len > maxChars) flush();
                cur.push(sales[i]);
                size += len;
            }
            flush();
            return chunks;
        }

        function joinSales(chunks) {
            return [...chunks].sort((a, b) => a.id < b.id ? -1 : 1).flatMap(c => c.items).reverse();
        }

        // Documento principal (schema 2) + mapa id -> { hash, json } de fotos y ventas.
        // kept: fotos que el producto tiene referenciadas pero no pudo traer; no se deben borrar.
        function buildCloudParts() {
            const { sales, products, ...rest } = buildCloudPayload();
            const chunks = {}, kept = [];
            const add = (id, value) => {
                const json = JSON.stringify(value);
                chunks[id] = { hash: hashText(json), json };
                return chunks[id].hash;
            };
            const mainProducts = (products || []).map(p => {
                const { img, ...noImg } = p;
                if (img) return { ...noImg, imgRef: add('img_' + p.id, img) };
                if (noImg.imgRef) kept.push('img_' + p.id);
                return noImg;
            });
            const salesChunks = splitSales(sales).map(c => ({ id: c.id, hash: add(c.id, c.items) }));
            return {
                main: { ...rest, schema: 2, products: mainProducts, chunkKey: keyFingerprint(), salesChunks },
                chunks, kept
            };
        }

        // ==========================================
        // Fase 6: sincronización segura (funciones puras)
        // ==========================================
        // Ficha de la versión de la nube: rev (nuevo) + lastUpdated, ambos al nivel superior del documento.
        function cloudTokenOf(raw) {
            return raw ? `${raw.rev || 0}|${raw.lastUpdated || ''}` : '';
        }

        function cloudCounts(d) {
            return { products: (d.products || []).length, sales: (d.sales || []).length, credits: (d.credits || []).length };
        }

        // base: ficha de la última versión de la nube aceptada (null = dispositivo de una versión vieja).
        function decideSync(base, cloudToken, dirty) {
            if (base === null) return 'LEGACY';
            if (cloudToken === base) return dirty ? 'UPLOAD' : 'NONE';
            return dirty ? 'CONFLICT' : 'LOAD';
        }

        // Tipos que bajan a 0 desde más de 0, o a menos de la mitad desde 5 o más.
        function bigLoss(baseCounts, nowCounts) {
            if (!baseCounts) return [];
            return ['products', 'sales', 'credits'].filter(t => {
                const b = baseCounts[t] || 0, n = (nowCounts && nowCounts[t]) || 0;
                return (b > 0 && n === 0) || (b >= 5 && n < b / 2);
            });
        }

        // Una parte cifrada crece ~1,35x: 400 000 caracteres siguen bajo el límite de 1 MiB de Firestore.
        const BACKUP_PART_CHARS = 400000;

        function splitText(text, size = BACKUP_PART_CHARS) {
            const parts = [];
            for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
            return parts;
        }

        function selfTestSync() {
            const t = decideSync;
            console.assert(t(null, '1|a', true) === 'LEGACY', 'selfTestSync: LEGACY');
            console.assert(t('1|a', '1|a', false) === 'NONE', 'selfTestSync: NONE');
            console.assert(t('1|a', '1|a', true) === 'UPLOAD', 'selfTestSync: UPLOAD');
            console.assert(t('1|a', '2|b', false) === 'LOAD', 'selfTestSync: LOAD');
            console.assert(t('1|a', '2|b', true) === 'CONFLICT', 'selfTestSync: CONFLICT');
            const c = (b, n) => bigLoss({ products: b, sales: 0, credits: 0 }, { products: n, sales: 0, credits: 0 }).length;
            console.assert(c(0, 0) === 0, 'selfTestSync: 0 a 0');
            console.assert(c(10, 4) === 1, 'selfTestSync: 10 a 4 es pérdida');
            console.assert(c(10, 6) === 0, 'selfTestSync: 10 a 6 no');
            console.assert(c(3, 1) === 0, 'selfTestSync: 3 a 1 no');
            console.assert(c(2, 0) === 1, 'selfTestSync: 2 a 0 es pérdida');
            console.assert(bigLoss(null, { products: 0 }).length === 0, 'selfTestSync: sin base no hay pérdida');
            console.assert(cloudTokenOf({ rev: 3, lastUpdated: 'x' }) === '3|x' && cloudTokenOf({ lastUpdated: 'x' }) === '0|x' && cloudTokenOf(null) === '', 'selfTestSync: ficha');
            const text = 'ñ'.repeat(2500) + 'abc';
            const parts = splitText(text, 900);
            console.assert(parts.length === 3 && parts.join('') === text && splitText('') .length === 0, 'selfTestSync: partir y unir texto');
            console.log('selfTestSync terminado');
        }

        function selfTestChunks() {
            const bk = { products: state.products, sales: state.sales };
            const mkSale = i => ({ id: 's' + i, total: i, note: 'x'.repeat(100) });
            const sales = Array.from({ length: 30 }, (_, i) => mkSale(30 - i)); // más nueva primero
            const split = splitSales(sales, 1000);
            console.assert(split.length > 1, 'selfTestChunks: debe haber varios trozos');
            console.assert(split.every((c, i) => new RegExp('^sales_' + String(i).padStart(3, '0') + '_[0-9a-f]{8}$').test(c.id)), 'selfTestChunks: id sales_NNN_hash8');
            console.assert(JSON.stringify(joinSales(split)) === JSON.stringify(sales), 'selfTestChunks: dividir y unir');
            const split2 = splitSales([mkSale(31), ...sales], 1000);
            const h = s => s.map(c => hashText(JSON.stringify(c.items)));
            const changed = h(split2).filter((x, i) => x !== h(split)[i]).length;
            console.assert(split2.length >= split.length && changed === 1 && h(split2).slice(0, -1).every((x, i) => x === h(split)[i]),
                'selfTestChunks: una venta nueva solo cambia el último trozo');
            state.products = [{ id: 'a', name: 'Con foto', img: 'data:image/jpeg;base64,AAA' }, { id: 'b', name: 'Sin foto' }];
            state.sales = [];
            const parts = buildCloudParts();
            const [pa, pb] = parts.main.products;
            console.assert(!('img' in pa) && pa.imgRef === parts.chunks.img_a.hash, 'selfTestChunks: foto pasa a imgRef');
            console.assert(!('imgRef' in pb) && !parts.chunks.img_b, 'selfTestChunks: sin foto no hay imgRef');
            console.assert(!Object.keys(parts.chunks).some(k => k.startsWith('sales_')) && parts.main.salesChunks.length === 0 && !('sales' in parts.main),
                'selfTestChunks: 0 ventas no da trozos');
            state.products = bk.products;
            state.sales = bk.sales;
            console.log('selfTestChunks terminado');
        }

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
                if (cur.length) chunks.push({ id: 'sales_' + String(chunks.length).padStart(3, '0'), items: cur });
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

        function selfTestChunks() {
            const bk = { products: state.products, sales: state.sales };
            const mkSale = i => ({ id: 's' + i, total: i, note: 'x'.repeat(100) });
            const sales = Array.from({ length: 30 }, (_, i) => mkSale(30 - i)); // más nueva primero
            const split = splitSales(sales, 1000);
            console.assert(split.length > 1, 'selfTestChunks: debe haber varios trozos');
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

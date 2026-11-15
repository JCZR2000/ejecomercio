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
            return { products: (d.products || []).length, sales: (d.sales || []).length, credits: (d.credits || []).length, clients: (d.clients || []).length };
        }

        // base: ficha de la última versión de la nube aceptada (null = dispositivo de una versión vieja).
        // partial (Fase 15): los datos locales quedaron incompletos (almacenamiento lleno): nunca se suben solos.
        function decideSync(base, cloudToken, dirty, partial = false) {
            if (base === null) return 'LEGACY';
            if (cloudToken === base) return dirty ? (partial ? 'CONFLICT' : 'UPLOAD') : 'NONE';
            return dirty ? 'CONFLICT' : 'LOAD';
        }

        // Fase 24: ¿es noticia esta versión de la nube?
        // 'OWN_NEWER': subida propia más nueva que la base (no se registró como base): se adopta.
        // 'STALE': subida propia ya conocida, o más vieja que la base: se ignora.
        // 'OK': versión de otro dispositivo: sigue a decideSync. rev 0 (reinicio de fábrica, sin rev) nunca es vieja.
        function cloudFilter(token, base, ownTokens) {
            const rev = (t) => parseInt(String(t || '').split('|')[0], 10) || 0;
            if (ownTokens.has(token)) return token !== base && rev(token) > rev(base) ? 'OWN_NEWER' : 'STALE';
            return rev(token) > 0 && rev(base) > rev(token) ? 'STALE' : 'OK';
        }

        // Fase 27: versión de usuario de un documento de la nube (la ficha de la última subida con cambios del usuario).
        // Sin userVer (documento viejo o subida con cambios) es su propia ficha.
        function cloudUserVer(raw) {
            return raw ? (raw.userVer || cloudTokenOf(raw)) : '';
        }

        // Fase 27: ¿la nube solo se diferencia de mi base en subidas de fondo (tasa, enlaces de fotos)?
        function sameUserVersion(cloudRaw, baseUserVer) {
            return !!baseUserVer && cloudUserVer(cloudRaw) === baseUserVer;
        }

        // Fase 27: al abrir la app, la versión igual a la base nunca es «vieja»: hay que pasar por decideSync para terminar de cargar.
        function isStaleNews(filter, isFirst, token, base) {
            return filter === 'STALE' && !(isFirst && token === base);
        }

        // Fase 24: ventas y fiados que están en local y no en la nube (por id).
        function localOnlyCounts(local, cloud) {
            const miss = (a, b) => { const ids = new Set((b || []).map(x => x.id)); return (a || []).filter(x => !ids.has(x.id)).length; };
            return { sales: miss(local.sales, cloud.sales), credits: miss(local.credits, cloud.credits) };
        }

        // Fase 34: texto para comparar contenido. Claves ordenadas; una clave vacía (null, [], {}) cuenta como ausente.
        function canonText(value) {
            const isEmpty = (x) => x == null || (typeof x === 'object' && Object.keys(x).length === 0);
            const norm = (x) => {
                if (Array.isArray(x)) return x.map(norm);
                if (!x || typeof x !== 'object') return x;
                const o = {};
                Object.keys(x).sort().forEach(k => { const n = norm(x[k]); if (!isEmpty(n)) o[k] = n; });
                return o;
            };
            const n = norm(value);
            return JSON.stringify(isEmpty(n) ? null : n);
        }

        // Fase 34: partes de los datos del usuario que son distintas entre local y nube ([] = mismo contenido).
        // No cuentan lastUpdated ni las tasas BCV (subidas de fondo). La foto se compara por su huella:
        // base64 en un lado y su imgRef en el otro son la misma foto. Si algo falla: ['error'] (en la duda se pregunta).
        const USER_DIFF_LABELS = {
            products: 'Productos', sales: 'Ventas', credits: 'Fiados', clients: 'Clientes', profitArchive: 'Ganancias',
            paymentMethods: 'Métodos de pago', security: 'PIN', receiptConfig: 'Recibo', receiptType: 'Tipo de recibo',
            fiscalConfig: 'Datos fiscales', catalogConfig: 'Vitrina', customRate: 'Tasa propia', rateMode: 'Modo de tasa',
            fiadosRateMode: 'Tasa de fiados', error: 'No se pudo comparar'
        };
        function userDataDiff(local, cloud, fields = Object.keys(buildCloudPayload())) {
            try {
                const part = (d, f) => f !== 'products' ? d[f]
                    : (d.products || []).map(({ img, imgRef, ...p }) => ({ ...p, photoRef: img ? hashText(JSON.stringify(img)) : imgRef }));
                return fields.filter(f => !['lastUpdated', 'bcvUsd', 'bcvEur'].includes(f) && canonText(part(local, f)) !== canonText(part(cloud, f)));
            } catch (e) {
                return ['error'];
            }
        }

        // Fase 34: ¿los productos solo difieren en fotos que este dispositivo ya subió a Storage y la nube aún tiene en base64?
        // Devuelve los productos de la nube con el enlace local (imgUrl/imgHash), o null si hay cualquier otra diferencia.
        function mergeUploadedPhotos(localProducts, cloudProducts) {
            try {
                const byId = new Map(localProducts.map(p => [String(p.id), p]));
                if (byId.size !== cloudProducts.length || new Set(cloudProducts.map(c => String(c.id))).size !== byId.size) return null;
                const same = (a, b) => !userDataDiff({ products: [a] }, { products: [b] }, ['products']).length;
                return cloudProducts.map(c => {
                    const l = byId.get(String(c.id));
                    if (same(l, c)) return c;
                    const { img, imgRef, imgUrl, imgHash, ...rest } = c;
                    const merged = { ...rest, imgUrl: l.imgUrl, imgHash: l.imgHash };
                    // misma foto: imgHash local es la huella del base64 que la nube todavía guarda
                    if (l.img || !l.imgUrl || typeof img !== 'string' || hashText(img) !== l.imgHash || !same(l, merged)) throw new Error('otra diferencia');
                    return merged;
                });
            } catch (e) {
                return null;
            }
        }

        // Tipos que bajan a 0 desde más de 0, o a menos de la mitad desde 5 o más.
        function bigLoss(baseCounts, nowCounts) {
            if (!baseCounts) return [];
            return ['products', 'sales', 'credits', 'clients'].filter(t => {
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
            console.assert(t('a', 'a', true, true) === 'CONFLICT', 'selfTestSync: local incompleto no sube solo');
            console.assert(t('a', 'a', true, false) === 'UPLOAD', 'selfTestSync: sin marca sube');
            console.assert(t('a', 'a', false, true) === 'NONE', 'selfTestSync: sin cambios carga la nube');
            console.assert(t('a', 'b', false, true) === 'LOAD', 'selfTestSync: nube nueva se carga');
            console.assert(t(null, 'a', true, true) === 'LEGACY', 'selfTestSync: dispositivo viejo sigue igual');
            const cf = (tk, b, own) => cloudFilter(tk, b, new Set(own));
            console.assert(cf('5|a', '5|a', ['5|a']) === 'STALE', 'selfTestSync: ficha propia igual a la base');
            console.assert(cf('6|b', '5|a', ['6|b']) === 'OWN_NEWER', 'selfTestSync: ficha propia más nueva');
            console.assert(cf('4|x', '5|a', []) === 'STALE', 'selfTestSync: ajena más vieja');
            console.assert(cf('6|x', '5|a', []) === 'OK', 'selfTestSync: ajena más nueva');
            console.assert(cf('0|x', '5|a', []) === 'OK', 'selfTestSync: rev 0 nunca es vieja');
            console.assert(cf('3|x', '', []) === 'OK' && cf('3|x', null, []) === 'OK', 'selfTestSync: sin base');
            console.assert(cloudUserVer({ rev: 3, lastUpdated: 'x' }) === '3|x' && cloudUserVer({ rev: 3, lastUpdated: 'x', userVer: '2|w' }) === '2|w' && cloudUserVer(null) === '', 'selfTestSync: cloudUserVer');
            console.assert(sameUserVersion({ rev: 4, lastUpdated: 'y', userVer: '3|x' }, '3|x') === true, 'selfTestSync: subida de fondo');
            console.assert(sameUserVersion({ rev: 4, lastUpdated: 'y' }, '3|x') === false, 'selfTestSync: subida con cambios de usuario');
            console.assert(sameUserVersion({ rev: 4, lastUpdated: 'y', userVer: '3|x' }, null) === false && sameUserVersion({ rev: 4, lastUpdated: 'y', userVer: '3|x' }, '') === false, 'selfTestSync: sin dato de base');
            console.assert(sameUserVersion({ rev: 5, lastUpdated: 'z', userVer: '3|x' }, '3|x') === true, 'selfTestSync: dos subidas de fondo');
            console.assert(isStaleNews('STALE', true, 'a', 'a') === false && isStaleNews('STALE', false, 'a', 'a') === true && isStaleNews('STALE', true, 'a', 'b') === true && isStaleNews('OK', true, 'a', 'a') === false, 'selfTestSync: isStaleNews');
            console.assert(parseOwnTokens('["a","b"]').length === 2 && parseOwnTokens('basura').length === 0 && parseOwnTokens(null).length === 0 && parseOwnTokens('{}').length === 0
                && parseOwnTokens(JSON.stringify(Array.from({ length: 15 }, (_, i) => 't' + i))).join() === Array.from({ length: 10 }, (_, i) => 't' + (i + 5)).join(), 'selfTestSync: parseOwnTokens');
            const lo = localOnlyCounts({ sales: [{ id: 1 }, { id: 2 }], credits: [{ id: 'a' }] }, { sales: [{ id: 1 }], credits: [{ id: 'a' }, { id: 'b' }] });
            console.assert(lo.sales === 1 && lo.credits === 0, 'selfTestSync: localOnlyCounts');
            console.assert(localOnlyCounts({}, {}).sales === 0, 'selfTestSync: localOnlyCounts vacío');
            // safeSetItem: guarda, y devuelve false (sin lanzar) si el almacenamiento falla. No llena el almacenamiento real.
            console.assert(safeSetItem('inv__selftest', '1') === true, 'selfTestSync: safeSetItem guarda');
            try { localStorage.removeItem('inv__selftest'); } catch (e) { /* sin almacenamiento */ }
            const realSet = Storage.prototype.setItem;
            Storage.prototype.setItem = () => { throw new DOMException('lleno', 'QuotaExceededError'); };
            try { console.assert(safeSetItem('inv__selftest', '1') === false, 'selfTestSync: safeSetItem con almacenamiento lleno'); }
            finally { Storage.prototype.setItem = realSet; }
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
            // Fase 34: userDataDiff y mergeUploadedPhotos (datos ficticios)
            const F = ['products', 'sales', 'credits', 'lastUpdated', 'bcvUsd'];
            const dA = { products: [{ id: 1, name: 'A', price: 2, imgUrl: 'u', imgHash: 'h' }], sales: [{ id: 's1', total: 5 }], credits: [], lastUpdated: 'x', bcvUsd: 1 };
            const dd = (cloud) => userDataDiff(dA, { ...dA, ...cloud }, F).join();
            console.assert(dd({ lastUpdated: 'y', bcvUsd: 2 }) === '', 'selfTestSync: otra fecha y otra tasa es igual');
            console.assert(dd({ sales: [{ id: 's1', total: 6 }] }) === 'sales', 'selfTestSync: venta distinta');
            console.assert(dd({ sales: [...dA.sales, { id: 's2', total: 1 }] }) === 'sales', 'selfTestSync: venta de más');
            console.assert(dd({ products: [{ imgHash: 'h', imgUrl: 'u', price: 2, name: 'A', id: 1 }] }) === '', 'selfTestSync: otro orden de claves es igual');
            console.assert(dd({ credits: undefined }) === '' && dd({ credits: null }) === '' && dd({ products: [{ ...dA.products[0], note: null }] }) === '', 'selfTestSync: vacío y ausente son iguales');
            console.assert(dd({ products: [{ ...dA.products[0], imgHash: 'otro' }] }) === 'products', 'selfTestSync: imgHash distinto');
            console.assert(dd({ products: [{ ...dA.products[0], price: 3 }], credits: [{ id: 'c' }] }) === 'products,credits', 'selfTestSync: dos partes distintas');
            const photo = 'data:image/jpeg;base64,AAA';
            const dp = (l, c) => userDataDiff({ products: [l] }, { products: [c] }, ['products']).join();
            console.assert(dp({ id: 1, img: photo }, { id: 1, imgRef: hashText(JSON.stringify(photo)) }) === '', 'selfTestSync: img y su imgRef son la misma foto');
            console.assert(dp({ id: 1, img: photo }, { id: 1, img: photo + 'B' }) === 'products' && dp({ id: 1, img: photo }, { id: 1 }) === 'products', 'selfTestSync: foto distinta o nueva');
            console.assert(userDataDiff({ products: 5 }, { products: [] }, ['products']).join() === 'error', 'selfTestSync: en la duda, error');
            const up = { id: 1, name: 'A', imgUrl: 'u', imgHash: hashText(photo) };
            const mg = mergeUploadedPhotos([up, { id: 2 }], [{ name: 'A', id: 1, img: photo }, { id: 2 }]);
            console.assert(mg && mg[0].imgUrl === 'u' && mg[0].imgHash === up.imgHash && !('img' in mg[0]) && mg.length === 2, 'selfTestSync: foto ya subida conserva el enlace local');
            console.assert(mergeUploadedPhotos([up], [{ id: 1, name: 'B', img: photo }]) === null, 'selfTestSync: otra diferencia no se une');
            console.assert(mergeUploadedPhotos([up], [{ id: 1, name: 'A', img: photo + 'B' }]) === null, 'selfTestSync: otra foto no se une');
            console.assert(mergeUploadedPhotos([up], [{ id: 1, name: 'A', img: photo }, { id: 2 }]) === null && mergeUploadedPhotos([up], [{ id: 9, name: 'A', img: photo }]) === null, 'selfTestSync: productos distintos no se unen');
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

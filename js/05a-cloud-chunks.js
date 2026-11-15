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
        const USER_SKIP_FIELDS = ['lastUpdated', 'bcvUsd', 'bcvEur'];
        // Un campo listo para comparar: en productos la foto pasa a su huella (photoRef).
        function userPart(d, f) {
            return f !== 'products' ? d[f]
                : (d.products || []).map(({ img, imgRef, ...p }) => ({ ...p, photoRef: img ? hashText(JSON.stringify(img)) : imgRef }));
        }
        function userDataDiff(local, cloud, fields = Object.keys(buildCloudPayload())) {
            try {
                return fields.filter(f => !USER_SKIP_FIELDS.includes(f) && canonText(userPart(local, f)) !== canonText(userPart(cloud, f)));
            } catch (e) {
                return ['error'];
            }
        }

        // ==========================================
        // Fase 36: huellas por elemento de la base (paso 1 de la unión de tres vías). Solo informan: no deciden nada.
        // ==========================================
        const PRINT_LISTS = ['sales', 'products', 'credits', 'clients']; // en el orden en que se nombran en los resúmenes
        const hasKey = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

        // { products: { id: [huella, qty] }, sales: { id: huella }, credits: { id: [huella, paid, totalDebt] }, clients: { id: huella },
        //   other: { campo: huella }, noId: cuántos elementos venían sin id (se guardan como '#' + índice) }.
        // Los números van aparte porque el paso 2 los unirá por diferencia.
        function basePrints(data, fields = Object.keys(buildCloudPayload())) {
            const print = (x) => hashText(canonText(x));
            const out = { other: {}, noId: 0 };
            fields.filter(f => !USER_SKIP_FIELDS.includes(f)).forEach(f => {
                const part = userPart(data, f);
                if (!PRINT_LISTS.includes(f)) { out.other[f] = print(part); return; }
                out[f] = {};
                (part || []).forEach((x, i) => {
                    const noId = !x || x.id == null;
                    if (noId) out.noId++;
                    const h = print(x);
                    out[f][noId ? '#' + i : x.id] = f === 'products' ? [h, x.qty] : f === 'credits' ? [h, x.paid, x.totalDebt] : h;
                });
            });
            return out;
        }

        // Qué cambió en data respecto a las huellas de la base: por tipo { added, removed, edited } (ids) y other: [campos].
        function sideChanges(prints, data, fields) {
            const now = basePrints(data, fields);
            const h = (v) => Array.isArray(v) ? v[0] : v;
            const out = { other: Object.keys(now.other).filter(f => now.other[f] !== (prints.other || {})[f]) };
            PRINT_LISTS.forEach(t => {
                const a = prints[t] || {}, b = now[t] || {};
                out[t] = {
                    added: Object.keys(b).filter(id => !hasKey(a, id)),
                    removed: Object.keys(a).filter(id => !hasKey(b, id)),
                    edited: Object.keys(b).filter(id => hasKey(a, id) && h(a[id]) !== h(b[id]))
                };
            });
            return out;
        }

        const CHANGE_NOUNS = { sales: ['venta', 'a'], products: ['producto', 'o'], credits: ['fiado', 'o'], clients: ['cliente', 'o'] };
        const pluralEs = (n, word) => word + (n === 1 ? '' : 's');

        // «2 ventas nuevas, 1 producto editado, Datos fiscales». Solo etiquetas fijas y números: nunca texto del usuario.
        function changeSummary(ch) {
            const out = [];
            PRINT_LISTS.forEach(t => {
                const [noun, g] = CHANGE_NOUNS[t];
                [['added', 'nuev'], ['edited', 'editad'], ['removed', 'borrad']].forEach(([k, adj]) => {
                    const n = ch[t][k].length;
                    if (n) out.push(`${n} ${pluralEs(n, noun)} ${pluralEs(n, adj + g)}`);
                });
            });
            return out.concat(ch.other.map(f => USER_DIFF_LABELS[f] || 'Otros')).join(', ') || 'Sin cambios';
        }

        // Elementos tocados en los dos lados, por tipo (cantidad), y other: [campos]. Es lo que el paso 3 tendría que preguntar.
        // shortcut: cuenta también el mismo cambio hecho igual en los dos lados; afinarlo en el paso 2, que ya compara huellas.
        function bothSides(a, b) {
            const ids = (c) => [...c.added, ...c.edited, ...c.removed];
            const out = { other: a.other.filter(f => b.other.includes(f)) };
            PRINT_LISTS.forEach(t => { const s = new Set(ids(a[t])); out[t] = ids(b[t]).filter(id => s.has(id)).length; });
            return out;
        }

        // «1 producto, 2 ventas, Datos fiscales» o «ninguno».
        function bothSummary(both) {
            return PRINT_LISTS.filter(t => both[t]).map(t => `${both[t]} ${pluralEs(both[t], CHANGE_NOUNS[t][0])}`)
                .concat(both.other.map(f => USER_DIFF_LABELS[f] || 'Otros')).join(', ') || 'ninguno';
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
            // Fase 36: huellas de la base (datos ficticios)
            const PF = ['products', 'sales', 'credits', 'clients', 'fiscalConfig', 'lastUpdated', 'bcvUsd'];
            const b0 = {
                products: [{ id: 1, name: 'A', qty: 5 }, { id: 2, name: 'B', qty: 1 }], sales: [{ id: 's1', total: 5 }],
                credits: [{ id: 'c1', paid: 1, totalDebt: 3 }], clients: [{ id: 'k1', name: 'X' }], fiscalConfig: { a: 1 }, lastUpdated: 'x', bcvUsd: 1
            };
            const bp = JSON.parse(JSON.stringify(basePrints(b0, PF))); // como vuelve de localStorage
            const sc = (d) => sideChanges(bp, { ...b0, ...d }, PF);
            const flat = (ch) => PRINT_LISTS.map(t => t + ':' + ['added', 'edited', 'removed'].map(k => ch[t][k].join('+')).join('/')).join(' ') + ' ' + ch.other.join('+');
            const none = 'sales:// products:// credits:// clients:// ';
            console.assert(bp.products[1][1] === 5 && bp.credits.c1[1] === 1 && bp.credits.c1[2] === 3 && typeof bp.sales.s1 === 'string' && bp.noId === 0, 'selfTestSync: forma de las huellas');
            console.assert(flat(sc({})) === none && flat(sc({ lastUpdated: 'y', bcvUsd: 9 })) === none && changeSummary(sc({})) === 'Sin cambios', 'selfTestSync: sin cambios');
            console.assert(flat(sc({ products: [{ qty: 5, name: 'A', id: 1 }, { name: 'B', id: 2, qty: 1, note: null }] })) === none, 'selfTestSync: otro orden de claves no es cambio');
            const chL = sc({ sales: [{ id: 's2', total: 1 }, ...b0.sales], products: [{ id: 1, name: 'A', qty: 4 }, b0.products[1]] });
            console.assert(chL.sales.added.join() === 's2' && chL.products.edited.join() === '1' && flat(chL) === 'sales:s2// products:/1/ credits:// clients:// ', 'selfTestSync: venta añadida y producto con otra qty');
            console.assert(changeSummary(chL) === '1 venta nueva, 1 producto editado', 'selfTestSync: resumen en singular');
            const chC = sc({ credits: [], products: [{ id: 1, name: 'A2', qty: 5 }, b0.products[1]], fiscalConfig: { a: 2 } });
            console.assert(chC.credits.removed.join() === 'c1' && chC.other.join() === 'fiscalConfig', 'selfTestSync: fiado borrado y campo distinto');
            console.assert(changeSummary(chC) === '1 producto editado, 1 fiado borrado, Datos fiscales', 'selfTestSync: resumen con otros campos');
            console.assert(changeSummary(sc({ sales: [{ id: 's2' }, { id: 's3' }, ...b0.sales], clients: [] })) === '2 ventas nuevas, 1 cliente borrado', 'selfTestSync: resumen en plural');
            const both = bothSides(chL, chC);
            console.assert(both.products === 1 && both.sales === 0 && both.credits === 0 && bothSummary(both) === '1 producto', 'selfTestSync: mismo producto en los dos lados');
            console.assert(bothSummary(bothSides(chL, sc({ credits: [...b0.credits, { id: 'c2' }] }))) === 'ninguno', 'selfTestSync: lados que no chocan');
            const noId = basePrints({ sales: [{ total: 1 }] }, ['sales']);
            console.assert(noId.noId === 1 && hasKey(noId.sales, '#0'), 'selfTestSync: elemento sin id');
            const ph = 'data:image/jpeg;base64,AAA';
            console.assert(basePrints({ products: [{ id: 1, img: ph }] }, ['products']).products[1][0] === basePrints({ products: [{ id: 1, imgRef: hashText(JSON.stringify(ph)) }] }, ['products']).products[1][0], 'selfTestSync: huella igual con img o con su imgRef');
            // setBasePrints: si no cabe, borra la clave y no lanza. La clave real se restaura.
            const realPrints = localStorage.getItem('inv_cloud_base_prints');
            Storage.prototype.setItem = () => { throw new DOMException('lleno', 'QuotaExceededError'); };
            try { setBasePrints('t', bp); } finally { Storage.prototype.setItem = realSet; }
            console.assert(localStorage.getItem('inv_cloud_base_prints') === null, 'selfTestSync: huella que no cabe se borra');
            if (realPrints !== null) localStorage.setItem('inv_cloud_base_prints', realPrints);
            // Fase 36: tamaño de los datos, una vez cada 24 h
            const H = 3600000, nowT = 1700000000000;
            console.assert(metricDue(null, nowT) && metricDue('basura', nowT) && metricDue(String(nowT - 25 * H), nowT) && metricDue(String(nowT + H), nowT)
                && !metricDue(String(nowT - 23 * H), nowT) && !metricDue(String(nowT), nowT), 'selfTestSync: metricDue');
            console.assert(docKB({ a: 'x'.repeat(2048) }) === 2 && docKB({ a: 'ñ'.repeat(1024) }) === 2, 'selfTestSync: docKB mide bytes');
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

        // ==========================================
        // 4c. FOTOS LOCALES EN INDEXEDDB (Fase 7)
        // En memoria, product.img sigue siendo el base64. Solo cambia el disco: inv_products se guarda
        // sin el base64 de las fotos ya confirmadas en IndexedDB (base 'ejecomercio', almacén 'images',
        // clave = id del producto, valor = { hash, img }).
        // ==========================================
        const LOCAL_IMG_DB = 'ejecomercio';
        let localImagesReady = false;
        let resolveLocalImages;
        const localImagesLoaded = new Promise(r => { resolveLocalImages = r; });
        // Lo que se sabe que hay en IndexedDB: id -> base64 (comparar el texto es barato; hashear 120 fotos en cada guardado no)
        let savedLocalImages = new Map();
        let imageDbPromise = null;
        let syncChain = Promise.resolve();

        // Devuelve la base o null (IndexedDB no existe o falla, p. ej. modo privado): todo sigue como antes.
        function openImageDb() {
            if (!imageDbPromise) {
                imageDbPromise = new Promise(resolve => {
                    try {
                        const req = indexedDB.open(LOCAL_IMG_DB, 1);
                        req.onupgradeneeded = () => req.result.createObjectStore('images');
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = req.onblocked = () => resolve(null);
                    } catch (e) { resolve(null); }
                });
            }
            return imageDbPromise;
        }

        const idbDone = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error); });
        const idbReq = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
        const isLocalDataImg = (img) => typeof img === 'string' && img.startsWith('data:');

        // Al arrancar: devuelve las fotos a los productos que no las tienen en memoria
        async function loadLocalImages() {
            try {
                const db = await openImageDb();
                if (db) {
                    const tx = db.transaction('images', 'readonly');
                    const store = tx.objectStore('images');
                    const [keys, vals] = await Promise.all([idbReq(store.getAllKeys()), idbReq(store.getAll())]);
                    const byId = new Map(keys.map((k, i) => [String(k), vals[i]]));
                    byId.forEach((v, k) => { if (v && isLocalDataImg(v.img)) savedLocalImages.set(k, v.img); });
                    state.products.forEach(p => {
                        const e = byId.get(String(p.id));
                        if (!p.img && e && isLocalDataImg(e.img)) p.img = e.img;
                    });
                }
            } catch (e) {
                console.warn('No se pudieron leer las fotos locales:', e);
            }
            localImagesReady = true;
            resolveLocalImages();
            renderAll();
        }

        // Guarda en IndexedDB las fotos base64 que faltan o cambiaron y borra las de productos que ya no las tienen.
        // Las llamadas se encadenan. Solo después de que IndexedDB confirma, saved se actualiza.
        function syncLocalImages() {
            syncChain = syncChain.then(async () => {
                try {
                    const db = await openImageDb();
                    if (!db) return savedLocalImages;
                    const current = new Map(state.products.filter(p => isLocalDataImg(p.img)).map(p => [String(p.id), p.img]));
                    const puts = [...current].filter(([id, img]) => savedLocalImages.get(id) !== img);
                    const dels = [...savedLocalImages.keys()].filter(id => !current.has(id));
                    if (!puts.length && !dels.length) return savedLocalImages;
                    const tx = db.transaction('images', 'readwrite');
                    const store = tx.objectStore('images');
                    puts.forEach(([id, img]) => store.put({ hash: hashText(img), img }, id));
                    dels.forEach(id => store.delete(id));
                    await idbDone(tx);
                    puts.forEach(([id, img]) => savedLocalImages.set(id, img));
                    dels.forEach(id => savedLocalImages.delete(id));
                } catch (e) {
                    console.warn('Fotos locales: no se pudo guardar en IndexedDB, siguen en localStorage:', e);
                }
                return savedLocalImages;
            });
            return syncChain;
        }

        // Copia de los productos para localStorage, sin el base64 de las fotos ya confirmadas con ese mismo texto.
        // Los enlaces http (OpenFoodFacts) se quedan: son cortos.
        function productsForLocalStorage(products, saved) {
            return (products || []).map(p => {
                if (isLocalDataImg(p.img) && saved && saved.get(String(p.id)) === p.img) {
                    const { img, ...rest } = p;
                    return rest;
                }
                return p;
            });
        }

        // Escribe inv_products. Si localStorage se llena, no se rompe el guardado: la foto sigue en memoria
        // y en IndexedDB cuando se confirme.
        function writeLocalProducts() {
            try {
                localStorage.setItem('inv_products', JSON.stringify(productsForLocalStorage(state.products, savedLocalImages)));
                return true;
            } catch (e) {
                console.warn('localStorage lleno: inv_products no se guardó todavía.', e);
                return false;
            }
        }

        // Primero se confirma en IndexedDB y después se quita de localStorage (nunca al revés)
        function persistProducts() {
            const ok = writeLocalProducts();
            if (localImagesReady) syncLocalImages().then(() => writeLocalProducts());
            return ok; // Fase 15: saveData lo usa para saber si el guardado local quedó completo
        }

        // Reinicio de fábrica / cierre con borrado
        async function deleteImageDb() {
            try {
                const db = await imageDbPromise;
                if (db) db.close();
                await new Promise(res => {
                    const req = indexedDB.deleteDatabase(LOCAL_IMG_DB);
                    req.onsuccess = req.onerror = req.onblocked = () => res();
                });
            } catch (e) { /* sin IndexedDB no hay nada que borrar */ }
            imageDbPromise = null;
            savedLocalImages = new Map();
        }

        document.addEventListener('DOMContentLoaded', () => { loadLocalImages(); });

        function selfTestLocalImages() {
            const A = 'data:image/jpeg;base64,AAA', B = 'data:image/jpeg;base64,BBB', URL1 = 'https://images.openfoodfacts.org/a.jpg';
            const prods = [{ id: 1, img: A }, { id: 2, img: B }, { id: 3, img: URL1 }, { id: 4 }, { id: 'x', img: A }];
            const out = productsForLocalStorage(prods, new Map([['1', A], ['2', 'OTRA'], ['x', A]]));
            console.assert(!('img' in out[0]), 'selfTestLocalImages: foto confirmada sale de localStorage');
            console.assert(out[1].img === B, 'selfTestLocalImages: foto cambiada se queda hasta confirmar');
            console.assert(out[2].img === URL1, 'selfTestLocalImages: el enlace http se queda');
            console.assert(!('img' in out[3]) && out[3].id === 4, 'selfTestLocalImages: sin foto igual');
            console.assert(!('img' in out[4]) && out[4].id === 'x', 'selfTestLocalImages: id de texto');
            console.assert(prods[0].img === A, 'selfTestLocalImages: no modifica los productos de memoria');
            console.assert(productsForLocalStorage(prods, null)[0].img === A && productsForLocalStorage(null, null).length === 0, 'selfTestLocalImages: sin confirmadas no se quita nada');
            console.log('selfTestLocalImages terminado');
        }

        // ==========================================
        // 13a. FOTOS EN FIREBASE STORAGE (Fase 5)
        // Ruta: users/{uid}/products/{productId}_{imgHash}.jpg (el hash en el nombre: el enlace nunca cambia).
        // Las fotos van SIN cifrar (decisión del usuario, 2026-10-23).
        // ==========================================
        const IMG_CACHE = 'ejecomercio-img';
        const IMG_PRUNE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 días: da margen a las copias de la nube
        const failedImageUrls = new Set(); // enlaces externos que no se pudieron subir en esta sesión
        let isUploadingImages = false;
        let hasPrunedImages = false;
        let hasRepairedImages = false;

        // img gana: si existe es más nueva (un dispositivo v47 cambia img sin tocar imgUrl).
        function productImageSrc(p) {
            return (p && (p.img || p.imgUrl)) || '';
        }

        function imagePath(uid, productId, hash) {
            return `users/${uid}/products/${productId}_${hash}.jpg`;
        }

        // Productos cuya foto sigue en el teléfono (base64 o enlace externo) y se puede subir.
        function pendingImageProducts(products, failed = failedImageUrls) {
            return (products || []).filter(p => typeof p.img === 'string' &&
                (p.img.startsWith('data:image/') || (/^https?:\/\//.test(p.img) && !failed.has(p.img))));
        }

        async function uploadProductImage(p) {
            const imgHash = hashText(p.img);
            const ref = storage.ref(imagePath(auth.currentUser.uid, p.id, imgHash));
            // Mismo hash = misma foto: nunca se sube encima (cambiaría el token y rompería los enlaces guardados).
            // shortcut: dos dispositivos subiendo la misma foto nueva a la vez pueden pisar el token; repairImageUrls lo corrige en la siguiente sesión.
            try { return { imgUrl: await ref.getDownloadURL(), imgHash }; }
            catch (e) { if (e.code !== 'storage/object-not-found') throw e; }
            const meta = { cacheControl: 'public, max-age=31536000, immutable' };
            if (p.img.startsWith('data:')) {
                await ref.putString(p.img, 'data_url', meta);
            } else {
                const res = await fetch(p.img);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const blob = await res.blob();
                if (!/^image\//.test(blob.type)) throw new Error('no es una imagen');
                await ref.put(blob, { ...meta, contentType: blob.type });
            }
            return { imgUrl: await ref.getDownloadURL(), imgHash };
        }

        async function uploadPendingImages() {
            if (isUploadingImages || !auth.currentUser || !navigator.onLine || !state.isCloudSynced) return;
            isUploadingImages = true;
            let changed = false;
            try {
                for (const p of pendingImageProducts(state.products)) {
                    const img = p.img;
                    let up;
                    try {
                        up = await uploadProductImage(p);
                    } catch (e) {
                        console.warn('Foto no subida a Storage:', p.id, e.message || e);
                        if (!img.startsWith('data:')) failedImageUrls.add(img);
                        if (!navigator.onLine) break;
                        continue;
                    }
                    // state.products pudo cambiar mientras subía: solo se toca si la foto sigue siendo la misma
                    const cur = state.products.find(x => x.id === p.id);
                    if (!cur || cur.img !== img) continue;
                    delete cur.img;
                    cur.imgUrl = up.imgUrl;
                    cur.imgHash = up.imgHash;
                    changed = true;
                }
            } finally {
                isUploadingImages = false;
            }
            if (changed) {
                saveData();
                renderAll();
            }
        }

        // Cambia imgUrl solo si el producto sigue existiendo y su imgUrl sigue siendo oldUrl. Devuelve cuántos cambió.
        function applyImageUrlFixes(products, fixes) {
            let n = 0;
            for (const f of fixes) {
                const p = (products || []).find(x => String(x.id) === String(f.id));
                if (p && p.imgUrl === f.oldUrl) { p.imgUrl = f.newUrl; n++; }
            }
            return n;
        }

        // Pide a Firebase el enlace actual de cada foto y corrige imgUrl si cambió. Una vez por sesión.
        async function repairImageUrls() {
            if (hasRepairedImages || !auth.currentUser || !navigator.onLine || !state.isCloudSynced) return;
            hasRepairedImages = true;
            const uid = auth.currentUser.uid;
            const todo = state.products.filter(p => p.imgUrl && p.imgHash && !p.img);
            const fixes = [];
            try {
                for (let i = 0; i < todo.length; i += 8) {
                    await Promise.all(todo.slice(i, i + 8).map(async p => {
                        try {
                            const newUrl = await storage.ref(imagePath(uid, p.id, p.imgHash)).getDownloadURL();
                            if (newUrl !== p.imgUrl) fixes.push({ id: p.id, oldUrl: p.imgUrl, newUrl });
                        } catch (e) {
                            if (e.code !== 'storage/object-not-found') throw e;
                            console.warn('Foto no encontrada en Storage:', p.id); // no se borra imgUrl: una copia de la nube puede necesitarlo
                        }
                    }));
                }
            } catch (e) {
                console.warn('Reparación de enlaces de fotos detenida:', e.message || e);
                return;
            }
            if (applyImageUrlFixes(state.products, fixes)) {
                saveData({ background: true });
                renderAll();
            }
        }

        // Borra los archivos que ningún producto ni copia usa y tienen más de 7 días. Una vez por sesión.
        async function pruneStorageImages() {
            if (hasPrunedImages || !auth.currentUser || !state.isCloudSynced) return;
            hasPrunedImages = true;
            const uid = auth.currentUser.uid;
            // Sin imgHash no se sabe el nombre del archivo: por seguridad no se borra nada
            if (state.products.some(p => p.imgUrl && !p.imgHash)) return;
            const used = new Set(state.products.filter(p => p.imgUrl).map(p => imagePath(uid, p.id, p.imgHash)));
            try {
                // Fotos que usan las copias de la nube (solo las cabeceras). Si no se pueden leer, no se borra nada.
                (await db.collection('users').doc(uid).collection('backups').get()).docs.forEach(d => (d.data().imgPaths || []).forEach(x => used.add(x)));
                const list = await storage.ref(`users/${uid}/products`).listAll();
                for (const item of list.items) {
                    if (used.has(item.fullPath)) continue;
                    const meta = await item.getMetadata();
                    if (Date.now() - new Date(meta.timeCreated).getTime() < IMG_PRUNE_AGE_MS) continue;
                    await item.delete();
                    console.log('🧹 Foto sin uso borrada de Storage:', item.name);
                }
            } catch (e) {
                console.warn('Limpieza de Storage no terminada:', e.message || e);
            }
        }

        // Borra de la caché del Service Worker las fotos que ya no usa ningún producto.
        async function pruneImageCache() {
            if (!('caches' in window)) return;
            try {
                const used = new Set(state.products.map(p => p.imgUrl).filter(Boolean));
                const cache = await caches.open(IMG_CACHE);
                for (const req of await cache.keys()) {
                    if (!used.has(req.url)) await cache.delete(req);
                }
            } catch (e) {
                console.warn('Limpieza de caché de fotos no terminada:', e.message || e);
            }
        }

        // Borra todo lo que el usuario tiene en Storage (reinicio de fábrica).
        async function deleteStorageFolder(ref) {
            const list = await ref.listAll();
            for (const item of list.items) await item.delete();
            for (const sub of list.prefixes) await deleteStorageFolder(sub);
        }

        // Se llama tras cada sincronización con la nube
        function afterCloudSyncImages() {
            uploadPendingImages().then(repairImageUrls).then(() => {
                if (!hasPrunedImages) pruneStorageImages().then(pruneImageCache);
            });
        }

        window.addEventListener('online', () => uploadPendingImages());

        function selfTestStorageImages() {
            console.assert(productImageSrc({ imgUrl: 'https://u', img: 'data:image/jpeg;base64,A' }) === 'data:image/jpeg;base64,A', 'selfTestStorageImages: img gana a imgUrl');
            console.assert(productImageSrc({ imgUrl: 'https://u' }) === 'https://u', 'selfTestStorageImages: imgUrl');
            console.assert(productImageSrc({}) === '' && productImageSrc(null) === '', 'selfTestStorageImages: sin foto');
            console.assert(imagePath('U1', 123, 'abc') === 'users/U1/products/123_abc.jpg', 'selfTestStorageImages: imagePath');
            const prods = [
                { id: 1, img: 'data:image/jpeg;base64,A' },
                { id: 2, imgUrl: 'https://firebasestorage.googleapis.com/x', imgHash: 'h' },
                { id: 3, img: 'https://images.openfoodfacts.org/a.jpg' },
                { id: 4, img: 'https://fallo.example/b.jpg' },
                { id: 5, img: null },
                { id: 6 },
                { id: 7, img: 'basura' }
            ];
            const ids = pendingImageProducts(prods, new Set(['https://fallo.example/b.jpg'])).map(p => p.id);
            console.assert(JSON.stringify(ids) === '[1,3]', 'selfTestStorageImages: pendientes ' + JSON.stringify(ids));
            // Fase 4: una foto que ya está en Storage no genera trozo img_ ni imgRef
            const bk = state.products;
            state.products = [prods[1]];
            const parts = buildCloudParts();
            state.products = bk;
            const mp = parts.main.products[0];
            console.assert(!parts.chunks.img_2 && !('imgRef' in mp) && mp.imgUrl === prods[1].imgUrl && parts.kept.length === 0,
                'selfTestStorageImages: Storage sin trozo img_');
            // Fase 8: applyImageUrlFixes
            const fx = [{ id: 1, imgUrl: 'old' }, { id: 2, imgUrl: 'otro' }, { id: '3', imgUrl: 'old' }, { id: 4, imgUrl: 'old' }];
            const n = applyImageUrlFixes(fx, [
                { id: 1, oldUrl: 'old', newUrl: 'new' },   // coincide
                { id: 2, oldUrl: 'old', newUrl: 'new' },   // imgUrl ya es otro
                { id: 99, oldUrl: 'old', newUrl: 'new' },  // ya no existe
                { id: 3, oldUrl: 'old', newUrl: 'new' },   // id de texto
                { id: '4', oldUrl: 'old', newUrl: 'new' }  // id numérico buscado como texto
            ]);
            console.assert(n === 3 && fx[0].imgUrl === 'new' && fx[1].imgUrl === 'otro' && fx[2].imgUrl === 'new' && fx[3].imgUrl === 'new',
                'selfTestStorageImages: applyImageUrlFixes ' + n);
            console.log('selfTestStorageImages terminado');
        }

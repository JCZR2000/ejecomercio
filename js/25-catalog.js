        // ==========================================
        // 25. VITRINA EN LÍNEA (Fase 10)
        // JSON público en Storage: catalogo/{uid}.json. Lo arma y lo sube la app; la página catalogo.html solo lo lee.
        // Cola por dispositivo: localStorage inv_catalog_queue = { uid, action: 'publish'|'delete', due, qhash }.
        // ==========================================
        const CATALOG_ALLOWED_FIELDS = ['id', 'name', 'category', 'price', 'photo', 'available'];
        const CATALOG_PHOTO_PREFIX = 'https://firebasestorage.googleapis.com/';
        const CATALOG_DEFAULT_CONFIG = { enabled: false, delayMin: 5, whatsapp: '', title: '', slogan: '', color: 'indigo', logoUrl: '', logoHash: '' };
// Paletas de la vitrina (la página tiene los mismos nombres); el valor es la muestra del selector
const CATALOG_COLORS = { indigo: '#312e81', verde: '#166534', rojo: '#991b1b', azul: '#075985', morado: '#6b21a8', oscuro: '#262626' };
        let catalogTimer = null;
        let isPublishingCatalog = false;
        let catalogError = '';

        const catalogPath = (uid) => `catalogo/${uid}.json`;
        const normalizeCatalogWhatsapp = (v) => String(v || '').replace(/\D/g, '');
        const isValidCatalogWhatsapp = (v) => /^\d{10,15}$/.test(v);

        function normalizeCatalogConfig() {
            const c = { ...CATALOG_DEFAULT_CONFIG, ...(state.catalogConfig || {}) };
            c.enabled = c.enabled === true;
            c.delayMin = Math.min(10, Math.max(5, parseInt(c.delayMin) || 5));
            c.whatsapp = normalizeCatalogWhatsapp(c.whatsapp);
            c.title = String(c.title || '');
            c.slogan = String(c.slogan || '').slice(0, 80);
            if (!CATALOG_COLORS[c.color]) c.color = 'indigo';
            if (typeof c.logoUrl !== 'string' || !c.logoUrl.startsWith(CATALOG_PHOTO_PREFIX)) { c.logoUrl = ''; c.logoHash = ''; }
            state.catalogConfig = c;
            return c;
        }

        // Lista blanca: crea objetos nuevos con solo los campos permitidos (nunca copia el producto entero).
        function buildPublicCatalog(products, config, money) {
            const list = [];
            for (const p of products || []) {
                const name = String((p && p.name) || '').trim();
                const price = roundMoney(p && p.price);
                if (!name || !(price > 0)) continue;
                // Con img y imgUrl a la vez (copias viejas de la nube) vale imgUrl si su hash es el de img; si no, img es una foto
                // nueva aún sin subir y sale sin foto hasta que uploadPendingImages la sube
                const uploaded = typeof p.imgUrl === 'string' && p.imgUrl.startsWith(CATALOG_PHOTO_PREFIX);
                const photo = uploaded && (!p.img || (p.imgHash && p.imgHash === hashText(p.img))) ? p.imgUrl : null;
                list.push({ id: String(p.id), name, category: String(p.category || '').trim(), price, photo, available: Number(p.qty) > 0 });
            }
            return {
                v: 1,
                updatedAt: new Date().toISOString(),
                shop: {
                    title: String(config.title || 'Catálogo'),
                    whatsapp: String(config.whatsapp || ''),
                    slogan: String(config.slogan || '').slice(0, 80),
                    color: CATALOG_COLORS[config.color] ? config.color : 'indigo',
                    logo: typeof config.logoUrl === 'string' && config.logoUrl.startsWith(CATALOG_PHOTO_PREFIX) ? config.logoUrl : ''
                },
                currency: money.currency,
                rate: money.rate > 0 ? money.rate : null,
                products: list
            };
        }

        // Sin updatedAt: dos catálogos iguales dan el mismo hash.
        function catalogHash(catalog) {
            return hashText(JSON.stringify({ ...catalog, updatedAt: undefined }));
        }

        function buildCatalogNow() {
            const c = normalizeCatalogConfig();
            const title = c.title.trim() || (state.receiptConfig && state.receiptConfig.companyName) || '';
            const rate = getActiveRate();
            return buildPublicCatalog(state.products, { ...c, title }, { currency: getSymbol(), rate: rate > 0 ? roundMoney(rate) : 0 });
        }

        function getCatalogQueue() { try { return JSON.parse(localStorage.getItem('inv_catalog_queue')); } catch (e) { return null; } }
        function setCatalogQueue(q) {
            if (q) localStorage.setItem('inv_catalog_queue', JSON.stringify(q));
            else localStorage.removeItem('inv_catalog_queue');
            armCatalogTimer();
            renderCatalogBadge();
        }

        function armCatalogTimer() {
            clearTimeout(catalogTimer);
            const q = getCatalogQueue();
            if (q) catalogTimer = setTimeout(() => runCatalogQueue(), Math.min(Math.max(0, q.due - Date.now()), 2147483000));
        }

        // Se llama desde saveData y tras cada sincronización: agenda la subida (la espera se reinicia con cada cambio).
        function scheduleCatalogPublish() {
            const c = normalizeCatalogConfig();
            const user = auth.currentUser;
            if (!c.enabled || !user) return;
            const hash = catalogHash(buildCatalogNow());
            const q = getCatalogQueue();
            if (q && q.action === 'publish' && q.uid === user.uid && q.qhash === hash) return; // nada nuevo desde el último cambio
            if (hash === localStorage.getItem('inv_catalog_hash')) {
                if (q) setCatalogQueue(null); // volvió a ser igual a lo publicado
                return;
            }
            catalogError = '';
            setCatalogQueue({ uid: user.uid, action: 'publish', due: Date.now() + c.delayMin * 60000, qhash: hash });
        }

        async function runCatalogQueue(force = false) {
            const q = getCatalogQueue();
            if (!q || isPublishingCatalog) return;
            const c = normalizeCatalogConfig();
            if ((q.action === 'publish') !== c.enabled) { setCatalogQueue(null); return; } // la vitrina cambió de estado
            const user = auth.currentUser;
            if (!user || user.uid !== q.uid || !navigator.onLine || !state.isCloudSynced) { renderCatalogBadge(); return; }
            if (q.action === 'publish' && !force && q.due > Date.now()) { armCatalogTimer(); return; }
            isPublishingCatalog = true;
            catalogError = '';
            renderCatalogBadge();
            try {
                if (q.action === 'delete') await deleteCatalog(user.uid);
                else await publishCatalog(user.uid);
                const cur = getCatalogQueue();
                if (cur && cur.due === q.due) setCatalogQueue(null); // si cambió durante la subida, la cola nueva sigue
            } catch (e) {
                console.warn('Vitrina: no se pudo completar', e.code || e.message || e);
                catalogError = e.message || 'Error';
            } finally {
                isPublishingCatalog = false;
                renderCatalogBadge();
                renderCatalogConfigUI();
            }
        }

        async function publishCatalog(uid) {
            const catalog = buildCatalogNow();
            // Seguro: un estado vacío (p. ej. cifrado sin desbloquear) nunca reemplaza la vitrina
            if (!catalog.products.length) throw new Error('Vitrina vacía: no se publicó');
            const hash = catalogHash(catalog);
            const ref = storage.ref(catalogPath(uid));
            let same = false;
            try { const m = await ref.getMetadata(); same = !!(m.customMetadata && m.customMetadata.hash === hash); }
            catch (e) { if (e.code !== 'storage/object-not-found') throw e; }
            if (!same) await ref.putString(JSON.stringify(catalog), 'raw', { contentType: 'application/json', cacheControl: 'public, max-age=300', customMetadata: { hash } });
            localStorage.setItem('inv_catalog_hash', hash);
            localStorage.setItem('inv_catalog_published_at', String(Date.now()));
        }

        async function deleteCatalog(uid) {
            try { await storage.ref(catalogPath(uid)).delete(); }
            catch (e) { if (e.code !== 'storage/object-not-found') throw e; }
            localStorage.removeItem('inv_catalog_hash');
            localStorage.removeItem('inv_catalog_published_at');
        }

        // Tras cada sincronización con la nube (lo llama afterCloudSyncImages, cuando los enlaces de fotos ya están al día)
        function afterCloudSyncCatalog() {
            scheduleCatalogPublish();
            runCatalogQueue();
            renderCatalogConfigUI();
        }

        // ---------- Indicador ----------
        function renderCatalogBadge() {
            const b = $('catalogBadge');
            if (!b) return;
            const c = state.catalogConfig;
            if (!c || !c.enabled) { b.classList.add('hidden'); return; }
            const q = getCatalogQueue();
            const { text, color } = catalogStatusInfo();
            // En pantallas chicas solo el icono (el detalle sale al tocarlo)
            b.className = `${color} text-[11px] font-bold flex items-center gap-1 h-8 px-2 rounded bg-slate-800 border border-slate-700`;
            b.title = catalogError || text;
            b.innerHTML = `<i class="fa-solid fa-store text-sm"></i><span class="hidden md:inline">${escapeHtml(text)}</span>`;
        }

        function catalogStatusInfo() {
            const q = getCatalogQueue();
            if (isPublishingCatalog) return { text: 'Publicando…', color: 'text-blue-300' };
            if (catalogError) return { text: 'Error', color: 'text-red-400' };
            if (q) return { text: `Pendiente (${Math.max(1, Math.ceil((q.due - Date.now()) / 60000))} min)`, color: 'text-yellow-300' };
            const at = Number(localStorage.getItem('inv_catalog_published_at'));
            return { text: at ? 'Publicada ' + new Date(at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : 'Vitrina', color: 'text-emerald-400' };
        }

        // Al tocar el indicador: detalle del estado y, si hay algo pendiente, opción de publicar ya
        function showCatalogDetail() {
            const { text } = catalogStatusInfo();
            const at = Number(localStorage.getItem('inv_catalog_published_at'));
            const last = at ? 'Última publicación: ' + new Date(at).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Aún no se ha publicado.';
            const msg = [text, last, catalogError].filter(Boolean).join('\n');
            if (getCatalogQueue() && !isPublishingCatalog) {
                customConfirm('Vitrina en línea', msg + '\n\n¿Publicar ahora?', 'warning', () => runCatalogQueue(true));
                $('dialogMsg').style.whiteSpace = 'pre-line';
            } else {
                customAlert('Vitrina en línea', msg, catalogError ? 'error' : 'success');
                $('dialogMsg').style.whiteSpace = 'pre-line';
            }
        }

        // ---------- Configuración ----------
        function catalogPublicUrl() {
            const user = auth.currentUser;
            if (!user) return '';
            return location.origin + location.pathname.replace(/[^/]*$/, '') + 'catalogo.html?u=' + encodeURIComponent(user.uid);
        }

        function renderCatalogConfigUI() {
            if (!$('catalogToggleBtn')) return;
            const c = normalizeCatalogConfig();
            const btn = $('catalogToggleBtn');
            btn.textContent = c.enabled ? 'Activada' : 'Apagada';
            btn.className = 'px-3 py-1 rounded text-xs font-bold ' + (c.enabled ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600');
            // No se pisa lo que el usuario está escribiendo
            if (document.activeElement !== $('catalogTitle')) $('catalogTitle').value = c.title;
            if (document.activeElement !== $('catalogWhatsapp')) $('catalogWhatsapp').value = c.whatsapp;
            if (document.activeElement !== $('catalogSlogan')) $('catalogSlogan').value = c.slogan;
            $('catalogDelay').value = String(c.delayMin);
            $('catalogColors').innerHTML = Object.entries(CATALOG_COLORS).map(([k, hex]) =>
                `<button type="button" onclick="setCatalogColor('${k}')" title="${k}" class="w-7 h-7 rounded-full border-2 ${c.color === k ? 'border-yellow-400 ring-2 ring-yellow-300' : 'border-white'} shadow" style="background:${hex}"></button>`).join('');
            $('catalogLogoPreview').src = c.logoUrl;
            $('catalogLogoPreview').classList.toggle('hidden', !c.logoUrl);
            $('catalogLogoRemove').classList.toggle('hidden', !c.logoUrl);
            $('catalogLinkBox').classList.toggle('hidden', !c.enabled);
            if (c.enabled) $('catalogLinkInput').value = catalogPublicUrl();
            $('catalogError').textContent = catalogError;
            renderCatalogBadge();
        }

        function saveCatalogConfig() {
            const c = normalizeCatalogConfig();
            const whatsapp = normalizeCatalogWhatsapp($('catalogWhatsapp').value);
            if (c.enabled && !isValidCatalogWhatsapp(whatsapp)) {
                customAlert('WhatsApp obligatorio', 'Escribe el número con código de país, solo dígitos (10 a 15). Ejemplo: 584120000000.', 'error');
                renderCatalogConfigUI();
                return;
            }
            state.catalogConfig = { ...c, whatsapp, title: $('catalogTitle').value.trim(), slogan: $('catalogSlogan').value.trim(), delayMin: parseInt($('catalogDelay').value) || 5 };
            localStorage.setItem('inv_catalog_config', JSON.stringify(normalizeCatalogConfig()));
            saveData(); // sincroniza la configuración y agenda la subida
            renderCatalogConfigUI();
        }

        function toggleCatalog(enabled) {
            const c = normalizeCatalogConfig();
            if (enabled) {
                const whatsapp = normalizeCatalogWhatsapp($('catalogWhatsapp').value);
                if (!isValidCatalogWhatsapp(whatsapp)) {
                    customAlert('WhatsApp obligatorio', 'Para activar la vitrina escribe el WhatsApp del negocio con código de país, solo dígitos (10 a 15). Ejemplo: 584120000000.', 'error');
                    return;
                }
                if (!auth.currentUser) { customAlert('Inicia sesión', 'La vitrina necesita una sesión iniciada.', 'error'); return; }
                state.catalogConfig = { ...c, enabled: true, whatsapp, title: $('catalogTitle').value.trim(), slogan: $('catalogSlogan').value.trim(), delayMin: parseInt($('catalogDelay').value) || 5 };
                localStorage.setItem('inv_catalog_config', JSON.stringify(normalizeCatalogConfig()));
                saveData();
                // Al activar se publica de inmediato, sin espera
                catalogError = '';
                setCatalogQueue({ uid: auth.currentUser.uid, action: 'publish', due: Date.now(), qhash: '' });
                runCatalogQueue(true);
                renderCatalogConfigUI();
            } else {
                customConfirm('¿Apagar la vitrina?', 'Se borrará el archivo público y el enlace dejará de funcionar.', 'warning', () => {
                    state.catalogConfig = { ...c, enabled: false };
                    localStorage.setItem('inv_catalog_config', JSON.stringify(normalizeCatalogConfig()));
                    saveData();
                    catalogError = '';
                    if (auth.currentUser) setCatalogQueue({ uid: auth.currentUser.uid, action: 'delete', due: Date.now() });
                    runCatalogQueue(true);
                    renderCatalogConfigUI();
                });
            }
        }

        function setCatalogColor(key) {
            if (!CATALOG_COLORS[key]) return;
            state.catalogConfig = { ...normalizeCatalogConfig(), color: key };
            localStorage.setItem('inv_catalog_config', JSON.stringify(state.catalogConfig));
            saveData();
            renderCatalogConfigUI();
        }

        // Reduce el logo a 256 px como máximo (PNG: conserva la transparencia)
        function resizeCatalogLogo(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(reader.error);
                reader.onload = () => {
                    const img = new Image();
                    img.onerror = () => reject(new Error('No es una imagen válida'));
                    img.onload = () => {
                        const scale = Math.min(1, 256 / Math.max(img.width, img.height));
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.max(1, Math.round(img.width * scale));
                        canvas.height = Math.max(1, Math.round(img.height * scale));
                        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve(canvas.toDataURL('image/png'));
                    };
                    img.src = reader.result;
                };
                reader.readAsDataURL(file);
            });
        }

        const catalogLogoPath = (uid, hash) => `users/${uid}/brand/logo_${hash}.png`;

        // Se sube a la carpeta privada del usuario (users/); la vitrina publica solo su enlace de descarga, como las fotos de productos
        async function onCatalogLogoPicked(ev) {
            const file = ev.target.files[0];
            ev.target.value = '';
            const user = auth.currentUser;
            if (!file) return;
            if (!user || !navigator.onLine) { customAlert('Sin conexión', 'Necesitas sesión y conexión para subir el logo.', 'error'); return; }
            busyStart('Subiendo logo...');
            try {
                const dataUrl = await resizeCatalogLogo(file);
                const hash = hashText(dataUrl);
                const ref = storage.ref(catalogLogoPath(user.uid, hash));
                await ref.putString(dataUrl, 'data_url', { cacheControl: 'public, max-age=31536000, immutable' });
                const logoUrl = await ref.getDownloadURL();
                const old = normalizeCatalogConfig();
                state.catalogConfig = { ...old, logoUrl, logoHash: hash };
                localStorage.setItem('inv_catalog_config', JSON.stringify(state.catalogConfig));
                saveData();
                if (old.logoHash && old.logoHash !== hash) storage.ref(catalogLogoPath(user.uid, old.logoHash)).delete().catch(() => {});
                renderCatalogConfigUI();
            } catch (e) {
                console.warn('Logo no subido:', e);
                customAlert('No se pudo subir el logo', e.message || 'Intenta de nuevo.', 'error');
            } finally { busyEnd(); }
        }

        function removeCatalogLogo() {
            const old = normalizeCatalogConfig();
            state.catalogConfig = { ...old, logoUrl: '', logoHash: '' };
            localStorage.setItem('inv_catalog_config', JSON.stringify(state.catalogConfig));
            saveData();
            // La página tolera un logo que ya no existe (muestra la inicial) mientras llega la vitrina nueva
            if (old.logoHash && auth.currentUser) storage.ref(catalogLogoPath(auth.currentUser.uid, old.logoHash)).delete().catch(() => {});
            renderCatalogConfigUI();
        }

        function copyCatalogLink() {
            const url = catalogPublicUrl();
            if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => customAlert('Enlace copiado', url, 'success'), () => prompt('Copia el enlace:', url));
            else prompt('Copia el enlace:', url);
        }

        function shareCatalogLink() {
            const url = catalogPublicUrl();
            const text = 'Mira nuestra vitrina: ' + url;
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile && navigator.share) navigator.share({ title: 'Vitrina', text, url }).catch(console.error);
            else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }

        window.addEventListener('online', () => runCatalogQueue());
        setInterval(renderCatalogBadge, 30000); // cuenta regresiva del "Pendiente (N min)"
        armCatalogTimer();
        document.addEventListener('DOMContentLoaded', renderCatalogBadge);

        // Prueba comprobable (consola: selfTestCatalog()). Solo datos ficticios.
        function selfTestCatalog() {
            const fb = CATALOG_PHOTO_PREFIX + 'v0/b/x/o/users%2Fu%2Fp.jpg?alt=media&token=t';
            const products = [
                { id: 1, name: 'Harina', qty: 7, price: 1.2, cost: 3, notes: 'interna', barcode: '7591', supplier: 'Prov Ficticio', category: 'Víveres', img: 'data:image/jpeg;base64,AAA', imgUrl: fb, imgHash: 'h', fiado: { customer: 'Cliente Ficticio Zeta', deuda: 5 } },
                { id: 2, name: 'Arroz', qty: '3', price: 2, imgUrl: fb },
                { id: 3, name: 'Pasta', qty: 0, price: 1.5, imgUrl: 'https://otro.dominio/x.jpg' },
                { id: 4, name: 'Gratis', qty: 1, price: 0 },
                { id: 5, name: '  ', qty: 1, price: 3 }
            ];
            const snapshot = JSON.stringify(products);
            const cat = buildPublicCatalog(products, { title: 'Bodega Ficticia', whatsapp: '584120000000' }, { currency: '$', rate: 36.5 });
            console.assert(JSON.stringify(products) === snapshot, 'selfTestCatalog: modificó los productos');
            console.assert(cat.products.length === 3, 'selfTestCatalog: precio 0 o sin nombre no debe salir');
            cat.products.forEach(p => console.assert(Object.keys(p).join() === CATALOG_ALLOWED_FIELDS.join(), 'selfTestCatalog: campos distintos a la lista blanca'));
            const txt = JSON.stringify(cat);
            ['"qty"', '"cost"', '"notes"', '"barcode"', '"supplier"', 'data:image', 'interna', 'Cliente Ficticio Zeta', 'paymentMethods', 'security', 'credits', 'sales', 'fiado']
                .forEach(s => console.assert(!txt.includes(s), 'selfTestCatalog: apareció ' + s));
            console.assert(cat.products[0].photo === null, 'selfTestCatalog: img nueva (hash distinto) + imgUrl debe dar photo null');
            const both = buildPublicCatalog([{ id: 9, name: 'Dos', qty: 1, price: 1, img: 'data:image/jpeg;base64,AAA', imgHash: hashText('data:image/jpeg;base64,AAA'), imgUrl: fb }], { title: 'T' }, { currency: '$', rate: 0 });
            console.assert(both.products[0].photo === fb, 'selfTestCatalog: img + imgUrl con el mismo hash debe dar la foto subida');
            console.assert(cat.products[1].photo === fb && cat.products[1].available === true, 'selfTestCatalog: imgUrl de Firebase / qty texto');
            console.assert(cat.products[2].photo === null && cat.products[2].available === false, 'selfTestCatalog: otro dominio / qty 0');
            console.assert(cat.products[1].category === '', 'selfTestCatalog: sin category -> vacío');
            const again = { ...buildPublicCatalog(products, { title: 'Bodega Ficticia', whatsapp: '584120000000' }, { currency: '$', rate: 36.5 }), updatedAt: 'otro' };
            console.assert(catalogHash(cat) === catalogHash(again), 'selfTestCatalog: el hash no debe depender de updatedAt');
            products[1].price = 2.5;
            console.assert(catalogHash(cat) !== catalogHash(buildPublicCatalog(products, { title: 'Bodega Ficticia', whatsapp: '584120000000' }, { currency: '$', rate: 36.5 })), 'selfTestCatalog: el hash debe cambiar con el precio');
            const shopOut = buildPublicCatalog(products, { title: 'T', slogan: 'x'.repeat(100), color: 'fucsia', logoUrl: 'https://otro.dominio/l.png' }, { currency: '$', rate: 0 }).shop;
            console.assert(shopOut.slogan.length === 80 && shopOut.color === 'indigo' && shopOut.logo === '', 'selfTestCatalog: lema, color y logo se validan');
            console.assert(buildPublicCatalog(products, { title: 'T', color: 'rojo', logoUrl: fb }, { currency: '$', rate: 0 }).shop.logo === fb, 'selfTestCatalog: logo de Firebase');
            console.log('selfTestCatalog terminado');
        }

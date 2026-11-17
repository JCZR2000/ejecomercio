        // ==========================================
        // 31. DISEÑO «MOSTRADOR» OPCIONAL (Fase 39)
        // ==========================================
        // UI2 (global) lo fija el script del <head> con inv_ui = '2'. La preferencia es de este dispositivo: no sube a la nube.

        // Iconos de trazo (estilo Lucide, 2 px), rutas de los artboards del diseño. Texto fijo: no lleva datos del usuario.
        const UI2_ICONS = {
            box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
            users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
            clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
            inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
            chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
            coins: '<circle cx="9" cy="9" r="6"/><path d="M15.5 9.5a6 6 0 1 1-6 6"/><path d="M10 7.8H8.6a.6.6 0 0 0 0 1.2h.8a.6.6 0 0 1 0 1.2H8M9 6.8v1M9 10.2v1"/>',
            crown: '<path d="m3 8 4 4 5-7 5 7 4-4-2 11H5z"/>',
            sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
            download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
            logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
            lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
            cloud: '<path d="M17.5 19H8a5 5 0 1 1 1.4-9.8A6 6 0 0 1 21 11.5 4 4 0 0 1 17.5 19z"/>',
            store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/>',
            more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
            user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
            swap: '<path d="m17 3 4 4-4 4"/><path d="M3 11V9a2 2 0 0 1 2-2h16"/><path d="m7 21-4-4 4-4"/><path d="M21 13v2a2 2 0 0 1-2 2H3"/>',
            // Fase 40
            calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
            plus: '<path d="M12 5v14M5 12h14"/>',
            search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
            x: '<path d="M6 6l12 12M18 6 6 18"/>',
            scan: '<path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M7 8v8M10 8v8M14 8v8M17 8v8"/>',
            back: '<path d="m15 18-6-6 6-6"/>',
            chevron: '<path d="m9 18 6-6-6-6"/>',
            camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
            'cloud-down': '<path d="M17.5 19H8a5 5 0 1 1 1.4-9.8A6 6 0 0 1 21 11.5 4 4 0 0 1 17.5 19z"/><path d="m9 14 3 3 3-3M12 11v6"/>',
            edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
            trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
            // Fase 42
            receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
            // Fase 43 (trazos para el cambiador de iconos)
            check: '<path d="m5 12 5 5 9-10"/>',
            'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
            save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h7V3M8 21v-7h8v7"/>',
            minus: '<path d="M5 12h14"/>',
            unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
            file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
            upload: '<path d="M12 16V4M7 9l5-5 5 5M5 21h14"/>',
            calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
            'chevron-down': '<path d="m6 9 6 6 6-6"/>',
            'chevron-up': '<path d="m18 15-6-6-6 6"/>',
            refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2"/><path d="M18.5 2v4h-4M5.5 22v-4h4"/>',
            spinner: '<path d="M12 3a9 9 0 1 0 9 9"/>',
            image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 16-5-5-8 8"/>',
            cart: '<circle cx="9.5" cy="19.5" r="1.2"/><circle cx="18" cy="19.5" r="1.2"/><path d="M1 4h3.2l2.4 11.4h12.8a1 1 0 0 0 .98-.8L22.5 8H5.3"/>',
            tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
            share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/>',
            copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
            link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
            phone: '<rect x="5.5" y="2" width="13" height="20" rx="2.5"/><path d="M10.5 18h3"/>',
            warning: '<path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
            info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
            ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
            login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/>',
            'eye-off': '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3 3.6M6.6 6.6A16 16 0 0 0 2.5 12S6 18 12 18a9 9 0 0 0 4-.9"/>',
            bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
            // Fase 44: métodos de pago, «Venta» y «Fiado»
            banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
            'banknote-usd': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M12 7.5v9M14.6 9.6c-.4-.7-1.4-1.1-2.6-1.1-1.5 0-2.6.7-2.6 1.7 0 2.4 5.3 1.2 5.3 3.6 0 1-1.1 1.7-2.7 1.7-1.3 0-2.3-.5-2.7-1.2"/>',
            bank: '<path d="M3 10 12 4l9 6z"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
            card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h3"/>',
            wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16.5" cy="14.5" r="1"/>',
            book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>'
        };
        // Icono de cada método de pago (aparte de PAY_METHODS: lo usan la factura y el recibo)
        const UI2_PAY_ICONS = { EFECTIVO: 'banknote', DIVISAS: 'banknote-usd', PAGO_MOVIL: 'phone', TRANSFERENCIA: 'bank', PUNTO: 'card', OTRO: 'more' };
        const ui2PayIcon = (key, size) => icon(UI2_PAY_ICONS[key] || 'more', size || 18);

        // Nombre de Font Awesome (sin «fa-») → clave de UI2_ICONS. Lo que no está aquí se queda como Font Awesome.
        const UI2_FA_MAP = {};
        Object.entries({
            x: 'times xmark', check: 'check', 'check-circle': 'circle-check check-circle clipboard-check', save: 'save floppy-disk',
            trash: 'trash trash-can', edit: 'pen pen-to-square', plus: 'plus', minus: 'minus', user: 'user', users: 'address-book user-clock',
            lock: 'lock user-shield shield-halved key', unlock: 'lock-open', receipt: 'receipt file-invoice file-invoice-dollar print',
            file: 'file-pdf file-excel', download: 'download', upload: 'upload', cloud: 'cloud cloud-bolt', 'cloud-down': 'cloud-arrow-down',
            sliders: 'gear sliders', clock: 'clock clock-rotate-left history', calendar: 'calendar-days calendar-day',
            chevron: 'chevron-right arrow-right', 'chevron-down': 'chevron-down', 'chevron-up': 'caret-up', back: 'arrow-left',
            refresh: 'rotate sync-alt', spinner: 'spinner circle-notch', search: 'search magnifying-glass', camera: 'camera', image: 'image',
            scan: 'barcode qrcode', calc: 'calculator', cart: 'cart-shopping basket-shopping cart-plus', box: 'box box-open boxes-stacked',
            store: 'store', inbox: 'inbox', tag: 'tags', share: 'share-nodes', copy: 'copy', link: 'link', phone: 'phone mobile-screen',
            warning: 'triangle-exclamation circle-exclamation', info: 'circle-info info-circle', ban: 'ban',
            chart: 'chart-line chart-pie arrow-trend-up', coins: 'coins money-bill money-bill-wave sack-dollar dollar-sign piggy-bank',
            crown: 'crown trophy', logout: 'right-from-bracket', login: 'right-to-bracket', 'eye-off': 'eye-slash', bolt: 'bolt'
        }).forEach(([k, names]) => names.split(' ').forEach(n => { UI2_FA_MAP[n] = k; }));

        function icon(name, size) {
            const s = Number(size) || 20;
            return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${UI2_ICONS[name] || ''}</svg>`;
        }

        // Rellena los <span data-icon="nombre" data-size="N"> del armazón nuevo
        document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon, el.dataset.size); });
        // Fase 44: iconos en los métodos de pago del carrito (los botones los crea 24-fiscal.js una sola vez)
        if (UI2) document.querySelectorAll('#posPayChips button[data-pay]').forEach(b => b.insertAdjacentHTML('afterbegin', ui2PayIcon(b.dataset.pay)));

        // Fase 43: iconos de trazo en lugar de Font Awesome (solo con UI2). Se conserva el <i> para que sigan sirviendo id, className, classList y fa-spin.
        const UI2_FA_SKIP = new Set(['fa-solid', 'fa-regular', 'fa-brands', 'fa-spin', 'fa-fw', 'fa-lg', 'fa-xl', 'fa-2x', 'fa-3x', 'fa-xs', 'fa-sm', 'fa-beat', 'fa-bounce', 'fa-pulse', 'fa-shake']);
        function ui2SwapIcon(i) {
            if (!i || i.closest('#receiptCanvas, #fiscalCanvas') || i.classList.contains('fa-brands')) return; // el recibo y la factura no cambian
            const cls = [...i.classList].find(c => c.startsWith('fa-') && !UI2_FA_SKIP.has(c));
            const key = cls && UI2_FA_MAP[cls.slice(3)];
            if (!key) { if (i.dataset.ui2i) { delete i.dataset.ui2i; i.textContent = ''; } return; }
            if (i.dataset.ui2i === cls.slice(3)) return;
            i.dataset.ui2i = cls.slice(3);
            i.innerHTML = icon(key, 16).replace('width="16" height="16"', 'width="1em" height="1em"');
        }
        function ui2SwapIn(root) {
            if (root.nodeType !== 1) return;
            if (root.tagName === 'I') ui2SwapIcon(root);
            else if (root.querySelector) root.querySelectorAll('i[class*="fa-"]').forEach(ui2SwapIcon);
        }
        // Consola (solo para probar): nombres de FA que siguen visibles sin traducir, con su cuenta
        function ui2IconAudit() {
            const out = {};
            document.querySelectorAll('i[class*="fa-"]:not([data-ui2i])').forEach(i => {
                if (i.offsetParent === null) return;
                const c = [...i.classList].find(x => x.startsWith('fa-') && !UI2_FA_SKIP.has(x)) || '?';
                out[c] = (out[c] || 0) + 1;
            });
            return out;
        }
        if (UI2) {
            ui2SwapIn(document.body);
            new MutationObserver(muts => muts.forEach(m => {
                if (m.type === 'attributes') ui2SwapIcon(m.target.tagName === 'I' ? m.target : null);
                else m.addedNodes.forEach(ui2SwapIn);
            })).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        }

        // Fase 44: «Mi cuenta» de la barra lateral muestra la foto y el nombre de Google y el estado de la sincronización (mismas palabras que Ajustes).
        // La llaman renderUserUI (al entrar y salir) y updateCloudStatus (al cambiar la red o la subida). Todo texto va por textContent.
        function ui2RenderSideUser(user) {
            const nameEl = $('ui2SideName');
            if (!nameEl) return;
            const u = user === undefined ? auth.currentUser : user;
            const img = $('ui2SideImg'), ini = $('ui2SideIni'), sync = $('ui2SideSync');
            const name = u ? (u.displayName || u.email || 'Usuario') : 'Mi cuenta';
            nameEl.textContent = name;
            const st = syncStateInfo();
            sync.textContent = st.short; sync.title = st.text; sync.dataset.level = st.level; // leyenda corta con un punto de color (ui2.css)
            ui2FillAvatar(img, ini, u, name);
            ui2FillAvatar($('ui2MenuImg'), $('ui2MenuIni'), u, name); // Fase 46: la misma foto en el menú de la cuenta
        }
        function ui2FillAvatar(img, ini, u, name) {
            if (!img || !ini) return;
            if (u && u.photoURL) {
                if (img.getAttribute('src') !== u.photoURL) img.src = u.photoURL;
                img.alt = name; img.classList.remove('hidden'); ini.classList.add('hidden');
                img.onerror = () => { img.classList.add('hidden'); ini.classList.remove('hidden'); };
            } else {
                img.classList.add('hidden'); img.removeAttribute('src'); ini.classList.remove('hidden');
                if (u) ini.textContent = (name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase();
                else ini.innerHTML = icon('user', 20);
            }
        }
        if (UI2) ui2RenderSideUser();

        // Un solo botón alterna entre los dos diseños. Se guarda y se recarga: no se redibuja en caliente.
        async function toggleDesign() {
            if (state.cart.length > 0) {
                const ok = await customConfirm('Venta sin cobrar', 'Tienes una venta sin cobrar. Al cambiar de diseño se vacía el carrito.', 'warning', null, 'Cambiar de diseño');
                if (!ok) return;
            }
            await waitForUpload();
            if (UI2) {
                try { localStorage.removeItem('inv_ui'); } catch (e) {}
            } else if (!safeSetItem('inv_ui', '2')) {
                return customAlert('Diseño', 'No se pudo guardar la preferencia en este dispositivo.', 'error');
            }
            location.reload();
        }

        // En esta fase el botón solo lo ve el administrador. Dentro del diseño nuevo se ve siempre, para poder volver.
        document.addEventListener('DOMContentLoaded', () => auth.onAuthStateChanged(() => {
            const btn = $('btnToggleDesign');
            if (!btn) return;
            if (UI2) return btn.classList.remove('hidden');
            isAdminUser().then(ok => btn.classList.toggle('hidden', !ok));
        }));

        // ==========================================
        // Fase 40: inventario, hoja de producto y carrito del diseño nuevo
        // ==========================================
        document.body.dataset.tab = document.body.dataset.tab || 'home';

        // Chip elegida del inventario: vive aquí, NO en state (no se guarda ni se sube)
        let ui2InvFilter = 'all';
        const UI2_LOW_STOCK = 5;
        const UI2_TILES = ['#FEF3E2', '#FDECEC', '#EDE9E3', '#FCE7F3', '#E0F2FE', '#FEF9C3'];
        const ui2Qty = p => Number(p && p.qty) || 0;
        const ui2Cat = p => String((p && p.category) || '').trim();

        const ui2NoCost = p => !(Number(p && p.cost) > 0);

        function ui2FilterProducts(list) {
            const f = ui2InvFilter;
            if (f === 'low') return list.filter(p => !isUnlimited(p) && ui2Qty(p) > 0 && ui2Qty(p) < UI2_LOW_STOCK);
            if (f === 'out') return list.filter(p => !isUnlimited(p) && ui2Qty(p) <= 0);
            if (f === 'nocost') { // Fase 42: solo cuáles faltan, sin mostrar costos
                if (!state.products.some(ui2NoCost)) { ui2InvFilter = 'all'; return list; } // ya no falta ninguno
                return list.filter(ui2NoCost);
            }
            if (f.startsWith('cat:')) {
                if (!state.products.some(p => 'cat:' + ui2Cat(p) === f)) { ui2InvFilter = 'all'; return list; } // la categoría ya no existe
                return list.filter(p => 'cat:' + ui2Cat(p) === f);
            }
            return list;
        }

        function ui2SetFilter(key) { ui2InvFilter = key; renderAll(); }
        // Fase 44: tarjeta «Sin costo» y enlace «Poner costos». Mismo PIN que Ganancias (el costo sigue oculto sin él); no exige Pro.
        function ui2OpenMissingCosts() { checkAuth('profit', () => openCosts(true)); }
        function ui2SortChange(col) { if (state.sortCol !== col) sortInventory(col); }

        function renderUi2Filters() {
            const box = $('ui2InvFilters');
            if (!box) return;
            const ae = document.activeElement;
            const focused = ae && ae.closest && ae.closest('#ui2InvFilters, #ui2InvCats') ? ae.dataset.f : null;
            const cats = [...new Set(state.products.map(ui2Cat).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
            const noCost = state.products.filter(ui2NoCost).length;
            const catBox = $('ui2InvCats');
            const stateDefs = [['all', 'Todos · ' + state.products.length], ['low', 'Poco stock'], ['out', 'Agotados'], ...(noCost > 0 ? [['nocost', 'Sin costo · ' + noCost]] : [])];
            const paint = (el, defs) => {
                el.innerHTML = defs.map(([k, label]) => `<button type="button" class="ec-filter" data-f="${escapeHtml(k)}" aria-pressed="${k === ui2InvFilter}">${escapeHtml(label)}</button>`).join('');
                el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => ui2SetFilter(b.dataset.f)));
            };
            paint(box, stateDefs);
            if (catBox) paint(catBox, cats.map(c => ['cat:' + c, c]));
            const row = $('ui2CatsRow');
            if (row) row.classList.toggle('hidden', cats.length === 0);
            const pc = $('ui2PutCosts');
            if (pc) pc.classList.toggle('hidden', ui2InvFilter !== 'nocost');
            if (focused) { const b = [...document.querySelectorAll('#ui2InvFilters button, #ui2InvCats button')].find(x => x.dataset.f === focused); if (b) b.focus(); }
            const sort = $('ui2Sort');
            if (sort) sort.value = state.sortCol;
        }

        function ui2Tile(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return UI2_TILES[h % UI2_TILES.length]; }
        // Fase 46: miniatura del producto (foto o iniciales); la usan el inventario, Costos y Editar fiado. `extra` va dentro (insignia del carrito).
        function ui2ProdTile(p, extra = '') {
            const src = productImageSrc(p);
            const ini = escapeHtml((String(p.name).trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase());
            return `<div class="ui2-prow__tile" style="background:${ui2Tile(p.id)}">${src ? `<img src="${escapeHtml(src)}" alt="">` : ini}${extra}</div>`;
        }

        function renderInventoryUi2(list) {
            const body = $('inventoryTableBody');
            if (!body) return;
            const rate = getActiveRate();
            body.innerHTML = list.map(p => {
                const id = escapeHtml(String(p.id)), name = escapeHtml(p.name), q = ui2Qty(p);
                const unl = isUnlimited(p), out = !unl && q <= 0, low = !unl && !out && q < UI2_LOW_STOCK;
                const stock = unl ? '∞' : out ? 'Agotado' : low ? 'Quedan ' + q : q + ' u.';
                const stockCls = out ? 'ec-chip ec-chip--neutral' : low ? 'ec-chip ec-chip--warning' : 'ui2-prow__stock';
                const cat = ui2Cat(p);
                return `<div class="ui2-prow" role="listitem"${out ? ' style="opacity:.6"' : ''}>
                    ${ui2ProdTile(p, `<span class="ui2-prow__badge hidden" data-cart-badge="${id}">0</span>`)}
                    <div class="ui2-prow__body">
                        <button type="button" class="ui2-prow__name" onclick="editProduct('${id}')" aria-label="Editar ${name}">${name}</button>
                        ${cat ? `<div class="ui2-prow__cat">${escapeHtml(cat)}</div>` : ''}
                        <div class="ui2-prow__price"><b>${formatMoney(p.price)}</b><span>Bs ${(p.price * rate).toFixed(2)}</span></div>
                    </div>
                    <span class="${stockCls}">${stock}</span>
                    <button type="button" class="ec-icon-btn ui2-prow__add" onclick="addToCartFromRow('${id}')" aria-label="Agregar ${name} a la venta"${out ? ' disabled' : ''}>${icon('plus', 20)}<span class="ui2-desk-only">Vender</span></button>
                    <button type="button" class="ec-iconbtn ui2-desk-only" onclick="editProduct('${id}')" aria-label="Editar ${name}">${icon('edit', 18)}</button>
                    <button type="button" class="ec-iconbtn ui2-desk-only ui2-prow__del" onclick="requestDelete('${id}')" aria-label="Borrar ${name}">${icon('trash', 18)}</button>
                </div>`;
            }).join('');
            const n = $('ui2ProdCount');
            if (n) n.textContent = state.products.length;
            renderUi2Filters();
            // Fase 42: tarjetas del escritorio (solo lectura; «cobrado» y «por cobrar» las escriben calculateTotals y renderCreditsList)
            const set = (id, t) => { const e = $(id); if (e) e.textContent = t; };
            const noCost = state.products.filter(ui2NoCost).length;
            set('ui2StatProds', state.products.length);
            set('ui2StatOut', state.products.filter(p => !isUnlimited(p) && ui2Qty(p) <= 0).length);
            set('ui2StatNoCostN', noCost);
            const nb = $('ui2StatNoCost');
            if (nb) { nb.disabled = noCost === 0; nb.setAttribute('aria-label', 'Sin costo: ' + noCost + (noCost ? ', ver cuáles' : '')); }
        }

        // --- Hoja «Nuevo / Editar producto» ---
        // Fila «Costo» de la hoja: oculta hasta pasar el PIN. El valor vive en #prodCost (el guardado de siempre); el campo solo lo copia.
        function ui2CostMarginUpdate() {
            const v = parseFloat($('ui2ProdCostEdit').value), price = parseFloat($('prodPrice').value);
            $('ui2CostMargin').textContent = v > 0 && price > 0 ? costMarginText(v, price) : '';
        }
        function ui2CostInput() { $('prodCost').value = $('ui2ProdCostEdit').value; ui2CostMarginUpdate(); }
        function ui2SyncCost() { // copia #prodCost al campo si está a la vista (la calculadora de precios también escribe en #prodCost)
            const cb = $('ui2CostEditBox');
            if (!cb || cb.classList.contains('hidden')) return;
            $('ui2ProdCostEdit').value = $('prodCost').value;
            ui2CostMarginUpdate();
        }
        function ui2HideCost() {
            const box = $('ui2CostEditBox');
            if (!box) return;
            box.classList.add('hidden');
            $('ui2ProdCostEdit').value = '';
            $('ui2CostMargin').textContent = '';
            $('ui2CostHint').textContent = 'Oculto';
            $('ui2CostBtn').classList.remove('hidden');
        }
        function ui2RevealCost() {
            checkAuth('profit', () => {
                $('ui2CostEditBox').classList.remove('hidden');
                $('ui2CostBtn').classList.add('hidden');
                $('ui2CostHint').textContent = 'Costo por unidad';
                ui2SyncCost();
                $('ui2ProdCostEdit').focus();
            });
        }
        function ui2UpdatePriceBs() {
            const el = $('ui2PriceBs'), v = parseFloat($('prodPrice').value);
            if (el) el.textContent = '= Bs ' + (v > 0 ? (v * getActiveRate()).toFixed(2) : '0,00');
            const cb = $('ui2CostEditBox');
            if (cb && !cb.classList.contains('hidden')) ui2CostMarginUpdate();
        }
        // La llama toggleProductManager(true) con el diseño nuevo
        function ui2OnProductSheet() {
            const editing = state.editingId !== null && state.editingId !== undefined;
            ui2HideCost(); // el costo de un producto no queda a la vista al abrir el siguiente
            $('ui2ProdTitle').textContent = editing ? 'Editar producto' : 'Nuevo producto';
            $('ui2DeleteProd').classList.toggle('hidden', !editing);
            $('ui2ClearProd').classList.toggle('hidden', editing);
            ui2UpdatePriceBs();
        }
        function ui2NewProduct() { cancelEdit(); toggleProductManager(true); }
        function ui2DeleteProduct() {
            const id = state.editingId;
            if (id === null || id === undefined) return;
            cancelEdit();
            requestDelete(id); // pide PIN y confirmación
        }
        function ui2StepQty(d) { const q = $('prodQty'); q.value = Math.max(0, (parseInt(q.value) || 0) + d); }
        $('prodPrice').addEventListener('input', ui2UpdatePriceBs);

        // --- Carrito ---
        // Los controles nuevos no guardan estado: escriben en #isCreditSale y #paymentScheduleSelect (la fuente de verdad)
        function ui2SetCredit(on) {
            const cb = $('isCreditSale');
            if (cb.disabled || cb.checked === on) return;
            cb.checked = on;
            cb.dispatchEvent(new Event('change', { bubbles: true })); // corren los dos oyentes de siempre
        }
        function ui2SetDue(v) {
            $('paymentScheduleSelect').value = v;
            toggleCustomDate();
            syncUi2Cart();
        }
        function syncUi2Cart() {
            const cb = $('isCreditSale'), credit = cb.checked, sel = $('paymentScheduleSelect').value;
            [['ui2SegCash', !credit], ['ui2SegCredit', credit]].forEach(([id, on]) => { const b = $(id); if (b) { b.setAttribute('aria-pressed', String(on)); b.disabled = cb.disabled; } });
            document.querySelectorAll('#ui2DueChips [data-due]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.due === sel)));
        }
        // La llama renderCart: barra del carrito, insignias de la lista y símbolo del total
        function ui2AfterRenderCart(totalItems, totalUSD, rate, sym) {
            const bar = $('fabCart');
            if (bar) bar.dataset.count = totalItems;
            const set = (id, t) => { const e = $(id); if (e) e.textContent = t; };
            set('ui2CartCount', totalItems + (totalItems === 1 ? ' producto' : ' productos'));
            set('ui2CartBs', 'Bs ' + (totalUSD * rate).toFixed(2));
            set('ui2CartUsd', formatMoney(totalUSD));
            const tot = $('cartTotalUSD');
            if (tot) tot.dataset.sym = sym;
            const byId = {};
            state.cart.forEach(i => { if (!i.isStub) byId[i.id] = (byId[i.id] || 0) + i.qty; });
            document.querySelectorAll('[data-cart-badge]').forEach(b => {
                const n = byId[b.dataset.cartBadge] || 0;
                b.textContent = n;
                b.classList.toggle('hidden', n === 0);
            });
        }
        syncUi2Cart();

        // ==========================================
        // Fase 41: fiados y cobro del diseño nuevo
        // ==========================================
        // Estado de pantalla: vive aquí, NO en state (no se guarda ni se sube)
        let ui2CreditId = null;   // fiado abierto en el cobro
        let ui2SheetOpen = false; // móvil: la hoja del cobro está abierta
        let ui2JustPaid = false;  // tras un abono guardado el campo de monto queda vacío
        const ui2IsDesk = () => window.matchMedia('(min-width: 1024px)').matches;
        const ui2Dd = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');

        // Mismos días que getDateDisplay (04-credit-dates-surcharges.js); null si no hay fecha
        function ui2CreditDays(c) { return c.nextPaymentDate ? Math.ceil((new Date(c.nextPaymentDate) - new Date()) / 86400000) : null; }
        const ui2Overdue = c => { const d = ui2CreditDays(c); return d !== null && d < 0; };
        function ui2CreditStatus(c) {
            const d = ui2CreditDays(c);
            if (d === null) return 'Sin fecha de pago';
            if (d < 0) return 'Atrasado ' + (-d) + (d === -1 ? ' día' : ' días');
            if (d === 0) return 'Paga hoy';
            return 'Paga ' + ui2Dd(new Date(c.nextPaymentDate));
        }
        // Desglose del cobro: Original + Recargo + Ajuste − Abonos = Debe. Solo lectura; no toca los abonos.
        function ui2CreditBreakdown(c) {
            const real = calculateRealDebt(c);
            return { orig: roundMoney(c.totalDebt - (c.surcharge || 0)), surcharge: c.surcharge || 0, adj: roundMoney(real - c.totalDebt), paid: c.paid, debt: roundMoney(real - c.paid), real };
        }

        function ui2CreditRow(c, rate) {
            const debt = roundMoney(calculateRealDebt(c) - c.paid);
            const id = escapeHtml(String(c.id)), name = escapeHtml(c.customer), late = ui2Overdue(c);
            const ini = escapeHtml((String(c.customer).trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase());
            const sub = escapeHtml(ui2CreditStatus(c)) + (c.surcharge ? ' · con recargo' : '');
            return `<div role="listitem" class="ui2-fitem"><button type="button" class="ec-row ui2-frow" data-credit="${id}" onclick="ui2OpenCredit('${id}')" aria-label="Cobrar a ${name}, debe ${escapeHtml(formatMoney(debt))}">
                <span class="ec-row__lead${late ? ' ec-row__lead--danger' : ''}">${ini}</span>
                <span class="ec-row__body"><span class="ec-row__title" style="display:block">${name}</span><span class="ec-row__sub${late ? ' ec-row__sub--danger' : ''}" style="display:block">${sub}</span></span>
                <span class="ec-amount ec-amount--debt"><span class="ec-amount__usd">${formatMoney(debt)}</span><span class="ec-amount__bs">Bs ${(debt * rate).toFixed(2)}</span></span>
            </button></div>`;
        }

        // La llama renderCreditsList (también cuando no queda ningún pendiente). list = filtrada y ordenada; allPending = todos.
        function renderCreditsUi2(list, allPending) {
            const rate = getFiadosActiveRate();
            const live = list.filter(c => calculateRealDebt(c) - c.paid > 0.01); // como hoy: se salta lo saldado por redondeo
            const livePending = allPending.filter(c => calculateRealDebt(c) - c.paid > 0.01);
            const sort = $('ui2CreditSort');
            if (sort) sort.value = state.creditSortMode || 'RECENT';
            $('creditsList').innerHTML = live.map(c => ui2CreditRow(c, rate)).join('');
            const late = livePending.filter(ui2Overdue).length, n = livePending.length;
            $('ui2CreditStats').textContent = n + (n === 1 ? ' fiado' : ' fiados') + ' · ' + late + (late === 1 ? ' atrasado' : ' atrasados');
            // ¿Sigue pendiente el fiado abierto? Si no (saldado o borrado): se cierra la hoja o se elige el primero
            if (ui2CreditId === null || !livePending.some(c => String(c.id) === String(ui2CreditId))) {
                ui2CreditId = null; ui2SheetOpen = false;
                if (ui2IsDesk() && live.length) ui2CreditId = live[0].id;
            } else if (!ui2IsDesk() && !ui2SheetOpen) ui2CreditId = null;
            renderUi2CreditDetail();
        }

        function ui2OpenCredit(id) {
            ui2CreditId = id; ui2SheetOpen = !ui2IsDesk();
            renderUi2CreditDetail();
            if (ui2SheetOpen) { const b = $('ui2CreditDetail').querySelector('.ui2-cart__back'); if (b) b.focus(); }
        }
        function ui2CloseCredit() {
            const el = $('ui2CreditDetail');
            if (el && el.classList.contains('is-closing')) return; // ya se está cerrando
            const finish = () => {
                const id = ui2CreditId;
                if (el) el.classList.remove('is-closing');
                ui2SheetOpen = false; ui2CreditId = null;
                renderUi2CreditDetail();
                const row = id !== null && document.querySelector(`#creditsList [data-credit="${CSS.escape(String(id))}"]`);
                if (row) row.focus();
            };
            // Fase 44: la hoja del teléfono sale con una animación corta antes de vaciarse
            if (el && el.classList.contains('is-open') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.classList.add('is-closing'); setTimeout(finish, 180); }
            else finish();
        }

        function renderUi2CreditDetail() {
            const el = $('ui2CreditDetail');
            if (!el) return;
            const c = ui2CreditId !== null ? state.credits.find(x => x.id == ui2CreditId) : null;
            document.querySelectorAll('#creditsList .ui2-frow').forEach(b => b.toggleAttribute('aria-current', !!c && b.dataset.credit === String(c.id)));
            el.classList.toggle('is-open', !!c && ui2SheetOpen);
            if (!c) { el.innerHTML = ''; delete el.dataset.id; return; }
            const id = String(c.id), eid = escapeHtml(id);
            // Se conserva lo escrito si es el mismo fiado (en escritorio la búsqueda repinta en cada tecla); tras un abono guardado el campo queda vacío
            const val = k => { const e = $(k + id); return e ? e.value : ''; };
            const keep = el.dataset.id === id && !ui2JustPaid ? { usd: val('pay_usd_'), bs: val('pay_bs_'), method: val('pay_method_') } : null;
            const body0 = el.querySelector('.ui2-cart__body'), scroll = body0 ? body0.scrollTop : 0;
            const ae = document.activeElement, focusId = ae && el.contains(ae) ? ae.id : '';
            const caret = focusId && ae.selectionStart != null ? ae.selectionStart : null;
            ui2JustPaid = false;

            const rate = getFiadosActiveRate(), b = ui2CreditBreakdown(c);
            const cons = {};
            c.items.forEach(i => { cons[i.name] = (cons[i.name] || 0) + i.qty; });
            const items = Object.entries(cons).map(([n, q]) => `${q}× ${escapeHtml(n)}`).join(', ');
            const late = ui2Overdue(c);
            const adjusted = b.real > c.totalDebt && state.creditMode === 'DYNAMIC';
            const method = lastPayMethod();
            const line = (k, v, cls) => `<div class="ui2-line${cls || ''}"><span>${k}</span><b>${v}</b></div>`;
            const signed = n => (n < 0 ? '−' : '+') + formatMoney(Math.abs(n));
            // Fase 44: en escritorio cada acción lleva icono y una línea de ayuda (el teléfono las oculta por CSS)
            const actBtn = (label, call, ic, help, cls) => `<button type="button" class="ec-btn ec-btn--secondary ui2-act${cls || ''}" onclick="${call}"><span class="ui2-act__ic">${icon(ic, 20)}</span><span class="ui2-act__t"><b>${label}</b><small>${help}</small></span></button>`;
            const act = (label, fn, ic, help, cls) => actBtn(label, `${fn}('${eid}')`, ic, help, cls);
            const cl = getClient(c.clientId);
            const useBal = cl && cl.balance > 0.01 ? actBtn('Usar saldo', `requestUseBalance('${safeClientId(cl.id)}', '${safeClientId(c.id)}')`, 'wallet', 'Descontar el saldo a favor') : '';
            const ini = escapeHtml((String(c.customer).trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase());

            el.innerHTML = `
                <header class="ui2-cart__head">
                    <button type="button" class="ui2-cart__back ui2-mob-only" onclick="ui2CloseCredit()" aria-label="Volver a Fiados">${icon('back', 22)}</button>
                    <div class="ui2-cart__titlebox">
                        <span class="ec-avatar ${late ? 'ec-avatar--danger' : 'ec-avatar--neutral'}" aria-hidden="true">${ini}</span>
                        <div class="ui2-detail__who">
                            <h2 class="ui2-cart__title">${clientNameHtml(c)} ${clientBalanceTagHtml(c)}</h2>
                            <div class="ui2-detail__sub">Venta ${ui2Dd(new Date(c.date))}${c.nextPaymentDate ? ' · vence ' + ui2Dd(new Date(c.nextPaymentDate)) : ''}</div>
                        </div>
                        <span class="ec-chip ec-chip--${late ? 'danger' : 'neutral'}">${escapeHtml(ui2CreditStatus(c))}</span>
                    </div>
                </header>
                <div class="ui2-cart__body">
                    <section class="ui2-card ui2-owe">
                        <div class="ui2-row-between"><span class="ec-overline">DEBE</span>${adjusted ? '<span class="ec-chip ec-chip--pro">Ajustado</span>' : ''}</div>
                        <div class="ec-amount ec-amount--debt ec-amount--xl ec-amount--start"><span class="ec-amount__usd">${formatMoney(b.debt)}</span><span class="ec-amount__bs">Bs ${(b.debt * rate).toFixed(2)}</span></div>
                        <div class="ui2-lines">
                            ${items ? `<div class="ui2-took"><div class="ui2-took__lbl">${icon('cart', 16)}Lo que se llevó</div><div class="ui2-detail__items">${items}</div></div>` : ''}
                            ${line('Original', formatMoney(b.orig))}
                            ${b.surcharge ? line('Recargo', '+' + formatMoney(b.surcharge)) : ''}
                            ${Math.abs(b.adj) > 0.01 ? line('Ajuste por precios de hoy', signed(b.adj)) : ''}
                            ${line('Abonos', '−' + formatMoney(b.paid))}
                            ${line('Debe', formatMoney(b.debt), ' ui2-line--total')}
                        </div>
                    </section>

                    <section class="ui2-card ui2-payc">
                        <div class="ec-overline">REGISTRAR PAGO</div>
                        <div class="ui2-two">
                            <label class="ec-field__control ec-field__control--amount"><span class="ec-field__prefix dynamic-symbol-span">${getSymbol()}</span><input type="number" id="pay_usd_${eid}" step="0.01" inputmode="decimal" placeholder="0.00" aria-label="Monto del abono" oninput="ui2PayInput('${eid}', 'USD')"></label>
                            <label class="ec-field__control ec-field__control--amount"><span class="ec-field__prefix">Bs</span><input type="number" id="pay_bs_${eid}" step="0.01" inputmode="decimal" placeholder="0.00" aria-label="Monto del abono en bolívares" oninput="ui2PayInput('${eid}', 'BS')"></label>
                        </div>
                        <div class="ui2-row-between">
                            <button type="button" class="ec-choice ui2-all" onclick="ui2PayAll('${eid}')">Todo</button>
                            <span id="ui2PayHint" class="ec-field__hint" aria-live="polite"></span>
                        </div>
                        <div class="ec-field__label" id="ui2PayMLabel">¿Cómo pagó?</div>
                        <div class="ec-choices" role="group" aria-labelledby="ui2PayMLabel">${PAY_METHODS.map(m => `<button type="button" class="ec-choice ui2-choice-ic" data-m="${m.key}" aria-pressed="${m.key === method}" onclick="ui2PickPayMethod('${eid}', '${m.key}')">${ui2PayIcon(m.key)}${m.text}</button>`).join('')}</div>
                        <select id="pay_method_${eid}" class="sr-only" tabindex="-1" aria-hidden="true">${PAY_METHODS.map(m => `<option value="${m.key}"${m.key === method ? ' selected' : ''}>${m.text}</option>`).join('')}</select>
                        <button type="button" id="ui2PayBtn" class="ec-btn ec-btn--primary ec-btn--block" onclick="ui2PayCredit('${eid}')">Registrar pago</button>
                    </section>

                    <section class="ui2-card">
                        <div class="ui2-acts">
                            ${act('Recordar', 'openShareModal', 'share', 'Mandar el recordatorio')}${act('Agregar', 'editCredit', 'plus', 'Sumar productos al fiado')}${act('Factura', 'openReceiptFromCredit', 'receipt', 'Generar la factura')}
                            ${act('Fecha', 'updatePaymentDate', 'calendar', 'Cambiar la fecha de pago')}${act('Recargo', 'openSurchargeModal', 'tag', 'Sumar un cargo a la deuda')}${act('Editar', 'requestEditCredit', 'edit', 'Cambiar productos o fechas')}${useBal}${act('Eliminar', 'requestDeleteCredit', 'trash', 'Borrar este fiado', ' ui2-danger')}
                        </div>
                    </section>

                    <section class="ui2-card">
                        <div class="ec-overline">MOVIMIENTOS</div>
                        ${ui2CreditMovesHtml(c)}
                    </section>
                </div>`;

            el.dataset.id = id;
            if (keep) {
                $('pay_usd_' + id).value = keep.usd; $('pay_bs_' + id).value = keep.bs;
                if (keep.method) ui2PickPayMethod(id, keep.method);
            }
            ui2PayRefresh(id);
            const nb = el.querySelector('.ui2-cart__body');
            if (nb) nb.scrollTop = scroll;
            const f = focusId && $(focusId);
            if (f) { f.focus(); if (caret !== null) { try { f.setSelectionRange(caret, caret); } catch (e) { /* los number no lo permiten */ } } }
        }

        function ui2PayInput(id, type) {
            ui2JustPaid = false;
            const usd = $('pay_usd_' + id), bs = $('pay_bs_' + id);
            if (!(type === 'USD' ? usd : bs).value) (type === 'USD' ? bs : usd).value = '';
            else convertCreditPayment(id, type);
            ui2PayRefresh(id);
        }
        function ui2PayAll(id) {
            const c = state.credits.find(x => x.id == id);
            if (!c) return;
            $('pay_usd_' + id).value = roundMoney(calculateRealDebt(c) - c.paid).toFixed(2);
            ui2PayInput(id, 'USD');
        }
        function ui2PickPayMethod(id, key) {
            const sel = $('pay_method_' + id);
            if (sel) sel.value = key;
            document.querySelectorAll('#ui2CreditDetail [data-m]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === key)));
        }
        // «Quedará debiendo» y el texto del botón, con las mismas reglas de validateCreditPayments
        function ui2PayRefresh(id) {
            const u = $('pay_usd_' + id), hint = $('ui2PayHint'), btn = $('ui2PayBtn');
            if (!u || !hint || !btn) return;
            const amount = roundMoney(parseFloat(u.value));
            hint.classList.remove('ec-field__hint--danger');
            if (!(amount > 0)) { hint.textContent = ''; btn.textContent = 'Registrar pago'; return; }
            btn.textContent = 'Registrar pago de ' + formatMoney(amount);
            const [v] = validateCreditPayments([{ id, amount }]);
            if (v.error) { hint.textContent = v.error; hint.classList.add('ec-field__hint--danger'); }
            else hint.textContent = v.excess > 0 ? '+' + formatMoney(v.excess) + ' a saldo a favor' : 'Quedará debiendo ' + formatMoney(v.remaining);
        }
        // Mismo PIN y mismas validaciones que el «Pagar» de hoy, pero sin collectCreditPayments (que solo busca dentro de #creditsList)
        function ui2PayCredit(id) { checkAuth('credit_pay', () => { ui2JustPaid = true; payCredit(id); }); }

        // Al pasar de móvil a escritorio (o al revés) se vuelve a decidir qué se muestra
        window.matchMedia('(min-width: 1024px)').addEventListener('change', () => { if (UI2 && document.body.dataset.tab === 'credits') renderCreditsList(); });

        // ==========================================
        // Fase 42: historial, clientes y movimientos del fiado
        // ==========================================
        // Cuántos movimientos se ven: vive aquí, NO en state (no se guarda ni se sube)
        let ui2HistLimit = 25;
        const UI2_HIST_STEP = 25;
        const ui2Hm = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Pura: «Hoy · martes 17/11», «Ayer · lunes 16/11» o «jueves 12/11»
        function ui2DayLabel(d, now = new Date()) {
            const wd = d.toLocaleDateString('es', { weekday: 'long' }) + ' ' + ui2Dd(d);
            const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            if (d.toDateString() === now.toDateString()) return 'Hoy · ' + wd;
            if (d.toDateString() === y.toDateString()) return 'Ayer · ' + wd;
            return wd;
        }
        // Pura: movimientos ya ordenados → grupos por día [{ label, items }]
        function ui2HistGroups(list, now = new Date()) {
            const groups = [];
            list.forEach(s => {
                const d = new Date(s.date), key = d.toDateString();
                let g = groups[groups.length - 1];
                if (!g || g.key !== key) { g = { key, label: ui2DayLabel(d, now), items: [] }; groups.push(g); }
                g.items.push(s);
            });
            return groups;
        }

        function ui2HistRow(s) {
            const id = escapeHtml(String(s.id)), amt = Number(s.total) || 0, isPay = s.type === 'payment';
            let title, sub;
            const mk = payMethodKey(s.method);
            const mIc = mk ? `<span class="ui2-hrow__m">${ui2PayIcon(mk, 14)}</span>` : ''; // icono del método junto a su texto
            if (isPay) {
                const m = payMethodLabel(s.method);
                title = escapeHtml(s.description || 'Abono');
                sub = 'Pago de fiado' + (m ? ' · ' + mIc + escapeHtml(m) : '');
            } else {
                const cons = {};
                (s.items || []).forEach(i => { cons[i.name] = (cons[i.name] || 0) + (Number(i.qty) || 0); });
                title = Object.entries(cons).map(([n, q]) => escapeHtml(n) + (q > 1 ? ' ×' + q : '')).join(', ') || 'Venta';
                const count = (s.items || []).reduce((a, i) => a + (Number(i.qty) || 0), 0);
                const m = payMethodLabel(s.method);
                sub = s.items ? 'Venta · ' + count + (count === 1 ? ' producto' : ' productos') + (m ? ' · ' + mIc + escapeHtml(m) : '') : '';
            }
            const kind = isPay ? ['coins', 'success'] : ['cart', 'primary']; // abono / venta (las ventas fiadas no entran en state.sales)
            return `<div role="listitem" class="ui2-hrow">
                <span class="ui2-hrow__time">${escapeHtml(ui2Hm(new Date(s.date)))}</span>
                <span class="ui2-hrow__ic ui2-hrow__ic--${kind[1]}">${icon(kind[0], 16)}</span>
                <span class="ec-row__body"><span class="ec-row__title" style="display:block">${title}</span>${sub ? `<span class="ec-row__sub" style="display:block">${sub}</span>` : ''}</span>
                <span class="ec-amount${isPay ? ' ec-amount--paid' : ''}"><span class="ec-amount__usd">${isPay ? '+' : ''}${formatMoney(amt)}</span></span>
                <button type="button" class="ec-iconbtn ec-iconbtn--plain" onclick="openReceiptFromHistory('${id}')" aria-label="Ver recibo">${icon('receipt', 20)}</button>
            </div>`;
        }

        // La llama renderHistoryTable con state.sales ya ordenada (la más nueva primero)
        function renderHistoryUi2(all) {
            const body = $('historyBody');
            if (!body) return;
            const shown = all.slice(0, ui2HistLimit);
            body.innerHTML = shown.length ? ui2HistGroups(shown).map(g => {
                const n = g.items.length;
                return `<div class="ui2-hday" role="presentation"><span>${escapeHtml(g.label)}</span><span>${n} ${n === 1 ? 'movimiento' : 'movimientos'}</span></div>` + g.items.map(ui2HistRow).join('');
            }).join('') : '<div class="p-8 text-center text-gray-400 italic bg-white">Aún no hay ventas ni abonos</div>';
            const more = $('ui2HistMore');
            if (more) more.classList.toggle('hidden', all.length <= ui2HistLimit);
        }
        function ui2HistMore() { ui2HistLimit += UI2_HIST_STEP; renderHistoryTable(); }

        // Fila de la lista de clientes (mismo patrón que las deudas)
        function ui2ClientRow(c, s, rate) {
            const id = escapeHtml(safeClientId(c.id)), name = escapeHtml(c.name);
            const ini = escapeHtml((String(c.name).trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase());
            const owes = s.debt > 0.01, bal = s.balance > 0.01;
            const aria = escapeHtml('Abrir ficha de ' + c.name + (owes ? ', debe ' + formatMoney(s.debt) : '') + (bal ? ', saldo a favor ' + formatMoney(s.balance) : ''));
            return `<div role="listitem" class="ui2-fitem"><button type="button" class="ec-row ui2-frow" onclick="openClientCard('${id}')" aria-label="${aria}">
                <span class="ec-row__lead">${ini}</span>
                <span class="ec-row__body"><span class="ec-row__title" style="display:block">${name}</span><span class="ec-row__sub" style="display:block">${escapeHtml(c.phone || 'Sin teléfono')}</span></span>
                <span class="ui2-clamt">${owes ? `<span class="ec-amount ec-amount--debt"><span class="ec-amount__usd">${formatMoney(s.debt)}</span><span class="ec-amount__bs">Bs ${(s.debt * rate).toFixed(2)}</span></span>` : ''}${bal ? `<span class="ec-chip ec-chip--success">Saldo ${formatMoney(s.balance)}</span>` : ''}</span>
            </button></div>`;
        }

        // Ficha del cliente: mismo contenido y mismos onclick que la de siempre. s = clientSummary(id); id ya pasó por safeClientId.
        function renderClientCardUi2(s, id, rate) {
            const c = s.client, wa = clientWaNumber(c.phone);
            const day = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(); };
            const row = (left, mid, right) => `<div class="ui2-mv"><span class="ui2-mv__l">${left}</span>${mid ? `<b class="ui2-mv__m">${mid}</b>` : ''}<span class="ui2-mv__r">${right}</span></div>`;
            const empty = t => `<div class="ui2-mv ui2-mv--empty">${t}</div>`;
            const openRows = s.open.map(cr => row(escapeHtml(day(cr.date)), `<span class="ui2-neg">${formatMoney(creditPending(cr))}</span>`,
                (s.balance > 0.01 ? `<button type="button" class="ec-btn ec-btn--ghost ui2-mini" onclick="requestUseBalance('${id}', '${safeClientId(cr.id)}')">Usar saldo</button>` : '') +
                `<button type="button" class="ec-btn ec-btn--ghost ui2-mini" onclick="viewClientCredits('${id}')">Ver</button>`)).join('') || empty('Sin fiados abiertos.');
            const closedRows = s.closed.slice(0, 5).map(cr => row(escapeHtml(day(cr.date)), formatMoney(cr.totalDebt), '<span class="ec-chip ec-chip--success">Pagado</span>')).join('') || empty('Ninguno guardado.');
            const MOVE_LABELS = { OVERPAY: 'Pagó de más', USE: 'Usado en un fiado', ADJUST: 'Ajuste', MERGE: 'Unión de clientes' };
            const movesRows = (c.moves || []).slice(0, 10).map(m => row(
                escapeHtml(day(m.date)) + ' · ' + escapeHtml(MOVE_LABELS[m.kind] || m.kind) + (m.note ? ` <span class="ui2-muted">(${escapeHtml(m.note)})</span>` : ''), '',
                `<b class="${m.amount < 0 ? 'ui2-neg' : 'ui2-pos'}">${m.amount < 0 ? '−' : '+'}${formatMoney(Math.abs(m.amount))}</b>`)).join('') || empty('Sin movimientos.');
            const fig = (label, usd, cls) => `<div class="ui2-card ui2-fig"><div class="ec-overline">${label}</div><div class="ec-amount ec-amount--${cls} ec-amount--start"><span class="ec-amount__usd">${formatMoney(usd)}</span><span class="ec-amount__bs">Bs ${(usd * rate).toFixed(2)}</span></div></div>`;
            return `
                <div class="ui2-cardhead">
                    <div class="ui2-cardhead__who">
                        <h3 class="ui2-cart__title" style="white-space:normal">${escapeHtml(c.name)}</h3>
                        <div class="ui2-detail__sub">${escapeHtml(c.phone || 'Sin teléfono')}${c.doc ? ' · ' + escapeHtml(c.doc) : ''}</div>
                        ${c.notes ? `<div class="ui2-detail__sub" style="font-style:italic">${escapeHtml(c.notes)}</div>` : ''}
                    </div>
                    <button type="button" class="ec-btn ec-btn--secondary ui2-mini" onclick="openClientForm('${id}')">Editar</button>
                </div>
                <div class="ui2-two">${fig('DEBE', s.debt, 'debt')}${fig('SALDO A FAVOR', s.balance, 'paid')}</div>
                <div class="ec-overline ui2-sec">FIADOS ABIERTOS</div><div class="ec-list">${openRows}</div>
                <div class="ec-overline ui2-sec">PAGADOS (ÚLTIMOS GUARDADOS)</div><div class="ec-list">${closedRows}</div>
                <div class="ec-overline ui2-sec">MOVIMIENTOS DEL SALDO</div><div class="ec-list">${movesRows}</div>
                <div class="ui2-two ui2-cardacts">
                    <button type="button" class="ec-btn ec-btn--secondary ui2-span2" onclick="requestAdjustBalance('${id}')">Ajustar saldo</button>
                    ${wa ? `<button type="button" class="ec-btn ec-btn--soft" onclick="openClientWhatsapp('${id}')">WhatsApp</button>` : ''}
                    <button type="button" class="ec-btn ec-btn--primary" onclick="newCreditForClient('${id}')">Nuevo fiado</button>
                    <button type="button" class="ec-btn ec-btn--secondary" onclick="startMergeClient('${id}')">Unir con…</button>
                    <button type="button" class="ec-btn ec-btn--danger ui2-span2" onclick="requestDeleteClient('${id}')">Eliminar</button>
                </div>`;
        }

        // Movimientos de un fiado, de más nuevo a más viejo. Solo lectura. Siempre cuadra con c.paid: lo que no se puede fechar va en «Abonos anteriores».
        // Cada línea: { label, sub (fecha y hora, '' si no se guardó), amount (− abona, + suma) }
        function ui2CreditMoves(c) {
            const dated = [];
            state.sales.forEach(s => {
                if (s.type !== 'payment' || s.creditId != c.id) return;
                const m = payMethodLabel(s.method), toDebt = roundMoney((Number(s.total) || 0) - (Number(s.toBalance) || 0));
                dated.push({ date: s.date, label: 'Abono' + (m ? ' · ' + m : ''), amount: -toDebt });
            });
            const cl = getClient(c.clientId);
            ((cl && cl.moves) || []).forEach(m => {
                if (m.kind === 'USE' && m.creditId == c.id) dated.push({ date: m.date, label: 'Saldo a favor usado', amount: -Math.abs(Number(m.amount) || 0) });
            });
            dated.sort((a, b) => new Date(b.date) - new Date(a.date));
            const out = dated.map(m => ({ label: m.label, sub: ui2Dd(new Date(m.date)) + ' ' + ui2Hm(new Date(m.date)), amount: m.amount }));
            const diff = roundMoney((Number(c.paid) || 0) + out.reduce((a, m) => a + m.amount, 0));
            if (diff > 0.01) out.push({ label: 'Abonos anteriores', sub: '', amount: -diff });
            else if (diff < -0.01) out.push({ label: 'Ajuste de abonos', sub: '', amount: -diff });
            if (c.surcharge) out.push({ label: 'Recargo', sub: '', amount: c.surcharge }); // no se guarda cuándo se puso
            const n = (c.items || []).reduce((a, i) => a + (Number(i.qty) || 0), 0);
            out.push({ label: 'Venta · ' + n + (n === 1 ? ' producto' : ' productos'), sub: ui2Dd(new Date(c.date)), amount: roundMoney(c.totalDebt - (c.surcharge || 0)) });
            return out;
        }
        function ui2CreditMovesHtml(c) {
            return ui2CreditMoves(c).map(m => `<div class="ui2-mv"><span class="ui2-mv__l"><b>${escapeHtml(m.label)}</b>${m.sub ? `<span class="ui2-detail__sub" style="display:block">${escapeHtml(m.sub)}</span>` : ''}</span><b class="${m.amount < 0 ? 'ui2-neg' : 'ui2-pos'}">${m.amount < 0 ? '−' : '+'}${formatMoney(Math.abs(m.amount))}</b></div>`).join('');
        }

        // Autoprueba (consola): selfTestUi2()
        function selfTestUi2() {
            const payload = buildCloudPayload();
            const noUiInCloud = !Object.keys(payload).some(k => /^(inv_)?ui$/.test(k)) && !JSON.stringify(payload).includes('"inv_ui"');
            const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
            const dupIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
            const leftover = document.querySelectorAll(`[data-ui="${UI2 ? '1' : '2'}"]`).length;
            const iconOk = icon('box').startsWith('<svg') && icon('nada').includes('aria-hidden="true"');
            console.assert(noUiInCloud, 'inv_ui no debe estar en buildCloudPayload()');
            console.assert(dupIds.length === 0, 'Hay id repetidos en el DOM:', dupIds);
            console.assert(leftover === 0, 'Quedan bloques del diseño inactivo:', leftover);
            console.assert(iconOk, 'icon() no devuelve un SVG');
            // Fase 40: el filtro de chips clasifica bien y su estado no entra en state
            const prevFilter = ui2InvFilter, prevProducts = state.products;
            state.products = [{ id: 'a', qty: 0 }, { id: 'b', qty: 3 }, { id: 'c', qty: 10 }, { id: 'd', qty: 0, unlimited: true }];
            ui2InvFilter = 'out'; const outN = ui2FilterProducts(state.products).length;
            ui2InvFilter = 'low'; const lowN = ui2FilterProducts(state.products).length;
            ui2InvFilter = 'all'; const allN = ui2FilterProducts(state.products).length;
            state.products = prevProducts; ui2InvFilter = prevFilter;
            const filterOk = outN === 1 && lowN === 1 && allN === 4;
            const stateOk = !('ui2InvFilter' in state) && !JSON.stringify(buildCloudPayload()).includes('ui2InvFilter');
            console.assert(filterOk, 'ui2FilterProducts clasifica mal', { outN, lowN, allN });
            console.assert(stateOk, 'state/payload no deben tener la chip del inventario');
            // Fase 41: el desglose del cobro suma la deuda (fiado ficticio, modo dinámico, precio subido y recargo)
            const prevCredits = state.credits, prevMode = state.creditMode, prevProds2 = state.products;
            let breakdownOk = false, statusOk = false;
            try {
                state.creditMode = 'DYNAMIC';
                state.products = [{ id: 'zz1', name: 'Prueba', price: 12, qty: 5 }];
                const yesterday = new Date(Date.now() - 86400000).toISOString();
                const c = { id: 'zzc', customer: 'Cliente ficticio', date: new Date().toISOString(), items: [{ id: 'zz1', name: 'Prueba', price: 10, qty: 2 }], totalDebt: 25, surcharge: 5, paid: 4, nextPaymentDate: yesterday };
                const b = ui2CreditBreakdown(c);
                breakdownOk = b.adj === 4 && roundMoney(b.orig + b.surcharge + b.adj - b.paid) === b.debt && b.debt === roundMoney(calculateRealDebt(c) - c.paid);
                statusOk = ui2CreditStatus(c).startsWith('Atrasado') && ui2CreditStatus({}) === 'Sin fecha de pago';
            } finally { state.credits = prevCredits; state.creditMode = prevMode; state.products = prevProds2; }
            const credStateOk = !('ui2CreditId' in state) && !JSON.stringify(buildCloudPayload()).includes('ui2CreditId');
            console.assert(breakdownOk, 'El desglose del cobro no suma la deuda');
            console.assert(statusOk, 'ui2CreditStatus da un estado equivocado');
            console.assert(credStateOk, 'ui2CreditId no debe estar en state ni en buildCloudPayload()');
            // Fase 42: movimientos del fiado, agrupado del historial, filtro «Sin costo» y límite fuera de state
            let movesOk = false, groupsOk = false, noCostOk = false;
            const prev42 = { sales: state.sales, clients: state.clients, products: state.products, filter: ui2InvFilter };
            try {
                const now = new Date(), yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
                state.clients = [{ id: 'zzcl', name: 'Cliente ficticio', moves: [{ kind: 'USE', creditId: 'zzc2', amount: -1, date: now.toISOString() }] }];
                state.sales = [
                    { id: 1, type: 'payment', date: now.toISOString(), total: 2, creditId: 'zzc2' },
                    { id: 2, type: 'payment', date: now.toISOString(), total: 2 } // abono inicial: sin creditId
                ];
                const c = { id: 'zzc2', clientId: 'zzcl', customer: 'Cliente ficticio', date: now.toISOString(), items: [{ name: 'Prueba', price: 8, qty: 1 }], totalDebt: 8, paid: 5 };
                const mv = ui2CreditMoves(c), prior = mv.find(m => m.label === 'Abonos anteriores');
                movesOk = !!prior && prior.amount === -2 && roundMoney(-mv.filter(m => m.amount < 0).reduce((a, m) => a + m.amount, 0)) === c.paid;
                state.sales = [{ date: now.toISOString() }, { date: now.toISOString() }, { date: yest.toISOString() }];
                const g = ui2HistGroups(state.sales, now);
                groupsOk = g.length === 2 && g[0].items.length === 2 && g[1].items.length === 1 && g[0].label.startsWith('Hoy') && g[1].label.startsWith('Ayer');
                state.products = [{ id: 'a', cost: 3 }, { id: 'b', cost: 0 }, { id: 'c' }];
                ui2InvFilter = 'nocost';
                noCostOk = ui2FilterProducts(state.products).length === 2;
            } finally { state.sales = prev42.sales; state.clients = prev42.clients; state.products = prev42.products; ui2InvFilter = prev42.filter; }
            const limitOk = !('ui2HistLimit' in state) && !JSON.stringify(buildCloudPayload()).includes('ui2HistLimit');
            console.assert(movesOk, 'ui2CreditMoves no cuadra con paid');
            console.assert(groupsOk, 'ui2HistGroups agrupa mal por día');
            console.assert(noCostOk, 'ui2FilterProducts nocost cuenta mal');
            console.assert(limitOk, 'ui2HistLimit no debe estar en state ni en buildCloudPayload()');
            // Fase 43: cambiador de iconos (nodos sueltos, nada queda en el DOM)
            const box = document.createElement('div');
            box.innerHTML = '<i class="fa-solid fa-trash-can"></i><i class="fa-brands fa-whatsapp"></i><i class="fa-solid fa-ghost"></i><span id="receiptCanvas"><i class="fa-solid fa-check"></i></span>';
            const [iTr, iWa, iGh] = box.querySelectorAll(':scope > i'), iRc = box.querySelector('span i');
            [iTr, iWa, iGh, iRc].forEach(ui2SwapIcon);
            const swapA = iTr.dataset.ui2i === 'trash-can' && !!iTr.querySelector('svg');
            iTr.className = 'fa-solid fa-pen'; ui2SwapIcon(iTr);
            const swapB = iTr.dataset.ui2i === 'pen';
            const swapNo = !iWa.dataset.ui2i && !iGh.dataset.ui2i && !iRc.dataset.ui2i && !iRc.querySelector('svg');
            const mapOk = Object.values(UI2_FA_MAP).every(k => k in UI2_ICONS);
            console.assert(swapA && swapB, 'ui2SwapIcon no traduce o no retraduce');
            console.assert(swapNo, 'ui2SwapIcon cambió marcas, desconocidos o el recibo');
            console.assert(mapOk, 'UI2_FA_MAP apunta a un icono que no existe');
            // Fase 44: fila «Costo» oculta al limpiar, el campo escribe en #prodCost, y cada método de pago tiene su icono
            const prevCost = $('prodCost').value;
            ui2HideCost();
            const costHidden = $('ui2CostEditBox').classList.contains('hidden') && $('ui2ProdCostEdit').value === '';
            $('ui2CostEditBox').classList.remove('hidden'); $('ui2ProdCostEdit').value = '2.5'; ui2CostInput();
            const costCopies = $('prodCost').value === '2.5';
            ui2HideCost(); $('prodCost').value = prevCost;
            const costBack = $('ui2CostEditBox').classList.contains('hidden') && $('ui2ProdCostEdit').value === '' && $('prodCost').value === prevCost;
            const payIconsOk = PAY_METHODS.every(m => UI2_PAY_ICONS[m.key] in UI2_ICONS) && new Set(PAY_METHODS.map(m => UI2_PAY_ICONS[m.key])).size === PAY_METHODS.length;
            console.assert(costHidden && costCopies && costBack, 'La fila Costo no se oculta o no copia a #prodCost', { costHidden, costCopies, costBack });
            console.assert(payIconsOk, 'Cada método de pago necesita un icono distinto en UI2_PAY_ICONS');
            const ok = costHidden && costCopies && costBack && payIconsOk && swapA && swapB && swapNo && mapOk && noUiInCloud && dupIds.length === 0 && leftover === 0 && iconOk && filterOk && stateOk && breakdownOk && statusOk && credStateOk && movesOk && groupsOk && noCostOk && limitOk;
            console.log(ok ? '✅ selfTestUi2: todo bien' : '❌ selfTestUi2: revisar', { ui2: UI2, noUiInCloud, dupIds, leftover, iconOk, filterOk, stateOk, breakdownOk, statusOk, credStateOk, movesOk, groupsOk, noCostOk, limitOk });
            return ok;
        }

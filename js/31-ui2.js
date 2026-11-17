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
            coins: '<circle cx="9" cy="9" r="6"/><path d="M15.5 9.5a6 6 0 1 1-6 6"/><path d="M9 6.5v5M7.5 8h2.2a1 1 0 0 1 0 2H8.3a1 1 0 0 0 0 2h2.2"/>',
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
            trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'
        };

        function icon(name, size) {
            const s = Number(size) || 20;
            return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${UI2_ICONS[name] || ''}</svg>`;
        }

        // Rellena los <span data-icon="nombre" data-size="N"> del armazón nuevo
        document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon, el.dataset.size); });

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

        function ui2FilterProducts(list) {
            const f = ui2InvFilter;
            if (f === 'low') return list.filter(p => !isUnlimited(p) && ui2Qty(p) > 0 && ui2Qty(p) < UI2_LOW_STOCK);
            if (f === 'out') return list.filter(p => !isUnlimited(p) && ui2Qty(p) <= 0);
            if (f.startsWith('cat:')) {
                if (!state.products.some(p => 'cat:' + ui2Cat(p) === f)) { ui2InvFilter = 'all'; return list; } // la categoría ya no existe
                return list.filter(p => 'cat:' + ui2Cat(p) === f);
            }
            return list;
        }

        function ui2SetFilter(key) { ui2InvFilter = key; renderAll(); }
        function ui2SortChange(col) { if (state.sortCol !== col) sortInventory(col); }

        function renderUi2Filters() {
            const box = $('ui2InvFilters');
            if (!box) return;
            const focused = document.activeElement && box.contains(document.activeElement) ? document.activeElement.dataset.f : null;
            const cats = [...new Set(state.products.map(ui2Cat).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
            const defs = [['all', 'Todos · ' + state.products.length], ['low', 'Poco stock'], ['out', 'Agotados'], ...cats.map(c => ['cat:' + c, c])];
            box.innerHTML = defs.map(([k, label]) => `<button type="button" class="ec-filter" data-f="${escapeHtml(k)}" aria-pressed="${k === ui2InvFilter}">${escapeHtml(label)}</button>`).join('');
            box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => ui2SetFilter(b.dataset.f)));
            if (focused) { const b = [...box.querySelectorAll('button')].find(x => x.dataset.f === focused); if (b) b.focus(); }
            const sort = $('ui2Sort');
            if (sort) sort.value = state.sortCol;
        }

        function ui2Tile(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return UI2_TILES[h % UI2_TILES.length]; }

        function renderInventoryUi2(list) {
            const body = $('inventoryTableBody');
            if (!body) return;
            const rate = getActiveRate();
            body.innerHTML = list.map(p => {
                const id = escapeHtml(String(p.id)), name = escapeHtml(p.name), q = ui2Qty(p);
                const unl = isUnlimited(p), out = !unl && q <= 0, low = !unl && !out && q < UI2_LOW_STOCK;
                const src = productImageSrc(p);
                const ini = escapeHtml((String(p.name).trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || '?').toUpperCase());
                const stock = unl ? '∞' : out ? 'Agotado' : low ? 'Quedan ' + q : q + ' u.';
                const stockCls = out ? 'ec-chip ec-chip--neutral' : low ? 'ec-chip ec-chip--warning' : 'ui2-prow__stock';
                const cat = ui2Cat(p);
                return `<div class="ui2-prow" role="listitem"${out ? ' style="opacity:.6"' : ''}>
                    <div class="ui2-prow__tile" style="background:${ui2Tile(p.id)}">${src ? `<img src="${escapeHtml(src)}" alt="">` : ini}<span class="ui2-prow__badge hidden" data-cart-badge="${id}">0</span></div>
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
        }

        // --- Hoja «Nuevo / Editar producto» ---
        function ui2UpdatePriceBs() {
            const el = $('ui2PriceBs'), v = parseFloat($('prodPrice').value);
            if (el) el.textContent = '= Bs ' + (v > 0 ? (v * getActiveRate()).toFixed(2) : '0,00');
        }
        // La llama toggleProductManager(true) con el diseño nuevo
        function ui2OnProductSheet() {
            const editing = state.editingId !== null && state.editingId !== undefined;
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
        let ui2MoreOpen = false;  // «Más» abierto en el cobro
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
                ui2CreditId = null; ui2SheetOpen = false; ui2MoreOpen = false;
                if (ui2IsDesk() && live.length) ui2CreditId = live[0].id;
            } else if (!ui2IsDesk() && !ui2SheetOpen) ui2CreditId = null;
            renderUi2CreditDetail();
        }

        function ui2OpenCredit(id) {
            ui2CreditId = id; ui2MoreOpen = false; ui2SheetOpen = !ui2IsDesk();
            renderUi2CreditDetail();
            if (ui2SheetOpen) { const b = $('ui2CreditDetail').querySelector('.ui2-cart__back'); if (b) b.focus(); }
        }
        function ui2CloseCredit() {
            const id = ui2CreditId;
            ui2SheetOpen = false; ui2CreditId = null;
            renderUi2CreditDetail();
            const row = id !== null && document.querySelector(`#creditsList [data-credit="${CSS.escape(String(id))}"]`);
            if (row) row.focus();
        }
        function ui2ToggleMore() {
            ui2MoreOpen = !ui2MoreOpen;
            const m = $('ui2MoreActs'), b = $('ui2MoreBtn');
            if (m) m.classList.toggle('is-open', ui2MoreOpen);
            if (b) b.setAttribute('aria-expanded', String(ui2MoreOpen));
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
            const act = (label, fn, cls) => `<button type="button" class="ec-btn ec-btn--secondary${cls || ''}" onclick="${fn}('${eid}')">${label}</button>`;

            el.innerHTML = `
                <header class="ui2-cart__head">
                    <button type="button" class="ui2-cart__back ui2-mob-only" onclick="ui2CloseCredit()" aria-label="Volver a Fiados">${icon('back', 22)}</button>
                    <div class="ui2-cart__titlebox">
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
                            ${items ? `<div class="ui2-detail__items">${items}</div>` : ''}
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
                        <div class="ec-choices" role="group" aria-labelledby="ui2PayMLabel">${PAY_METHODS.map(m => `<button type="button" class="ec-choice" data-m="${m.key}" aria-pressed="${m.key === method}" onclick="ui2PickPayMethod('${eid}', '${m.key}')">${m.text}</button>`).join('')}</div>
                        <select id="pay_method_${eid}" class="sr-only" tabindex="-1" aria-hidden="true">${PAY_METHODS.map(m => `<option value="${m.key}"${m.key === method ? ' selected' : ''}>${m.text}</option>`).join('')}</select>
                        <button type="button" id="ui2PayBtn" class="ec-btn ec-btn--primary ec-btn--block" onclick="ui2PayCredit('${eid}')">Registrar pago</button>
                    </section>

                    <section class="ui2-card">
                        <div class="ui2-acts">
                            ${act('Recordar', 'openShareModal')}${act('Agregar', 'editCredit')}${act('Factura', 'openReceiptFromCredit')}
                            <button type="button" id="ui2MoreBtn" class="ec-btn ec-btn--ghost ui2-more-btn" aria-expanded="${ui2MoreOpen}" aria-controls="ui2MoreActs" onclick="ui2ToggleMore()">Más</button>
                        </div>
                        <div id="ui2MoreActs" class="ui2-acts ui2-more${ui2MoreOpen ? ' is-open' : ''}">
                            ${act('Fecha', 'updatePaymentDate')}${act('Recargo', 'openSurchargeModal')}${act('Editar', 'requestEditCredit')}${clientUseBalanceBtnHtml(c)}${act('Eliminar', 'requestDeleteCredit', ' ui2-danger')}
                        </div>
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
            const ok = noUiInCloud && dupIds.length === 0 && leftover === 0 && iconOk && filterOk && stateOk && breakdownOk && statusOk && credStateOk;
            console.log(ok ? '✅ selfTestUi2: todo bien' : '❌ selfTestUi2: revisar', { ui2: UI2, noUiInCloud, dupIds, leftover, iconOk, filterOk, stateOk, breakdownOk, statusOk, credStateOk });
            return ok;
        }

        // ==========================================
        // 28. PEDIDOS EN LÍNEA (Fase 19)
        // El cliente crea users/{uid}/pedidos/{id} desde catalogo.html (sin precios). La app los escucha, el dueño acepta o rechaza.
        // Al aceptar se ignora todo precio del cliente: el carrito se arma con los precios de la app y se cierra con la caja de siempre.
        // ==========================================
        const ORDER_MAX_AGE_MS = 30 * 86400000;
        let ordersList = [], ordersUnsub = null, ordersUid = null, orderOpenId = null, orderClientId = null, orderSuggestId = null;

        const orderClip = (v, max) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, max);
        const orderRef = (id) => db.collection('users').doc(auth.currentUser.uid).collection('pedidos').doc(id);
        const orderLast10 = (v) => normalizeClientPhone(v).slice(-10);

        // Las reglas de Firestore no revisan cada línea de items: aquí se descartan las malas. Devuelve null si el pedido queda vacío.
        function cleanOrder(raw, id) {
            if (!raw || typeof raw !== 'object' || !/^[\w-]+$/.test(String(id || ''))) return null;
            const byId = new Map();
            (Array.isArray(raw.items) ? raw.items : []).forEach(l => {
                if (!l || typeof l.id !== 'string' || !l.id || !Number.isInteger(l.n) || l.n < 1 || l.n > 999) return;
                const key = l.id.slice(0, 60), prev = byId.get(key);
                if (prev) prev.n = Math.min(999, prev.n + l.n); // el mismo producto dos veces no debe pasar de las existencias
                else byId.set(key, { id: key, n: l.n, name: orderClip(l.name, 80) });
            });
            if (!byId.size) return null;
            const at = raw.at && typeof raw.at.toMillis === 'function' ? raw.at.toMillis() : Number(raw.at) || 0;
            return {
                id: String(id), name: orderClip(raw.name, 60), phone: normalizeClientPhone(raw.phone),
                pay: raw.pay === 'fiado' ? 'fiado' : 'contado', delivery: raw.delivery === 'delivery' ? 'delivery' : 'retiro',
                address: orderClip(raw.address, 120), at, items: [...byId.values()]
            };
        }

        // Precios y existencias de la app (el pedido no trae precios). Si no alcanza, el carrito lleva lo disponible.
        function buildOrderCart(order, products) {
            const lines = [], cart = [];
            order.items.forEach(it => {
                const p = (products || []).find(x => String(x.id) === it.id);
                if (!p) { lines.push({ id: it.id, name: it.name, asked: it.n, avail: 0, qty: 0, missing: true }); return; }
                const avail = Math.max(0, Math.floor(Number(p.qty) || 0)), qty = Math.min(it.n, avail);
                lines.push({ id: p.id, name: p.name, price: p.price, asked: it.n, avail, qty, short: it.n > avail });
                if (qty > 0) cart.push({ id: p.id, name: p.name, price: p.price, qty, subtotal: roundMoney(qty * p.price), ...(p.cost > 0 && { cost: p.cost }) });
            });
            return { lines, cart, total: roundMoney(cart.reduce((s, l) => s + l.subtotal, 0)) };
        }

        // 1) mismo teléfono (últimos 10 dígitos), 2) nombre. Devuelve { client, by } o null.
        function matchOrderClient(order, clients, find = findClients) {
            const ph = orderLast10(order.phone);
            if (ph.length >= 7) {
                const c = clients.find(x => x.phone && orderLast10(x.phone) === ph);
                if (c) return { client: c, by: 'phone' };
            }
            const f = order.name ? find(order.name, 1)[0] : null;
            return f ? { client: f, by: 'name' } : null;
        }

        // ---------- Escucha ----------
        function startOrdersListener() {
            const user = auth.currentUser, mode = normalizeCatalogConfig().orderMode;
            const want = user && mode !== 'whatsapp' ? user.uid : null;
            if (want === ordersUid) return;
            if (ordersUnsub) { ordersUnsub(); ordersUnsub = null; }
            ordersUid = want;
            ordersList = [];
            if (!want) { renderOrdersBadge(); if (orderOpenId) closeOrders(); return; }
            ordersUnsub = db.collection('users').doc(want).collection('pedidos').orderBy('at').onSnapshot(snap => {
                const now = Date.now(), list = [];
                snap.docs.forEach(d => {
                    const o = cleanOrder(d.data(), d.id);
                    if (o && o.at && now - o.at > ORDER_MAX_AGE_MS) { d.ref.delete().catch(() => {}); return; } // más de 30 días
                    if (o) list.push(o);
                });
                ordersList = list;
                renderOrdersBadge();
                renderOrders();
            }, e => console.warn('Pedidos: no se pudo escuchar', e.code || e.message || e));
        }
        document.addEventListener('DOMContentLoaded', () => auth.onAuthStateChanged(() => startOrdersListener()));

        function renderOrdersBadge() {
            const b = $('ordersBadge');
            if (!b) return;
            b.classList.toggle('hidden', !ordersList.length);
            $('ordersCount').textContent = ordersList.length;
        }

        // ---------- Pantallas ----------
        const currentOrder = () => ordersList.find(o => o.id === orderOpenId) || null;
        const orderTime = (at) => at ? new Date(at).toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
        const orderPayChip = (pay) => pay === 'fiado' ? '<span class="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Fiado</span>' : '<span class="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Contado</span>';
        const orderMoney = (usd) => { const r = getActiveRate(); return `${formatMoney(usd)}${r > 0 ? ` · Bs ${(usd * r).toFixed(2)}` : ''}`; };

        function openOrders() {
            orderOpenId = null;
            $('ordersModal').classList.remove('hidden');
            renderOrders();
        }

        function closeOrders() {
            $('ordersModal').classList.add('hidden');
            orderOpenId = null;
        }

        function backToOrders() { orderOpenId = null; renderOrders(); }

        function openOrderDetail(id) {
            orderOpenId = id;
            const o = currentOrder();
            const m = o && matchOrderClient(o, state.clients);
            orderClientId = null;
            orderSuggestId = m ? m.client.id : null;
            renderOrders();
        }

        function renderOrders() {
            if ($('ordersModal').classList.contains('hidden')) return;
            const body = $('ordersBody');
            if (orderOpenId && !currentOrder()) { // se borró (p. ej. desde otro dispositivo) mientras estaba abierto
                orderOpenId = null;
                customAlert('Pedido no disponible', 'Ese pedido ya no está en la bandeja.', 'info');
            }
            if (!orderOpenId) {
                $('ordersTitle').innerHTML = '<i class="fa-solid fa-inbox mr-2 text-amber-500"></i>Pedidos en línea';
                body.innerHTML = ordersList.length ? ordersList.map(o => {
                    const total = buildOrderCart(o, state.products).total;
                    return `<button onclick="openOrderDetail('${o.id}')" class="w-full text-left border border-gray-100 rounded-xl p-3 flex justify-between items-center gap-2 hover:bg-amber-50">
                        <div class="min-w-0"><div class="font-bold text-gray-800 truncate">${escapeHtml(o.name)}</div>
                        <div class="text-[11px] text-gray-500">${escapeHtml(orderTime(o.at))} · ${o.items.length} producto${o.items.length === 1 ? '' : 's'}</div></div>
                        <div class="text-right shrink-0">${orderPayChip(o.pay)}<div class="text-xs font-bold text-gray-700 mt-1">${formatMoney(total)}</div></div></button>`;
                }).join('') : '<p class="text-center text-sm text-gray-400 py-8">No hay pedidos nuevos.</p>';
                return;
            }
            const o = currentOrder(), { lines, cart, total } = buildOrderCart(o, state.products);
            const wa = clientWaNumber(o.phone);
            $('ordersTitle').innerHTML = `<button onclick="backToOrders()" class="mr-2 text-gray-400 hover:text-gray-600" aria-label="Volver"><i class="fa-solid fa-arrow-left"></i></button>Pedido de ${escapeHtml(o.name)}`;
            const rows = lines.map(l => l.missing
                ? `<div class="flex justify-between gap-2 text-xs text-gray-400 line-through"><span>${l.asked}× ${escapeHtml(l.name || 'Producto')}</span><span>ya no existe</span></div>`
                : `<div class="flex justify-between gap-2 text-xs"><span class="min-w-0">${l.asked}× ${escapeHtml(l.name)}${l.short ? `<span class="block text-[10px] font-bold text-red-600">${l.avail > 0 ? `Solo quedan ${l.avail}: se agregarán ${l.avail}` : 'Agotado: no se agregará'}</span>` : ''}</span><span class="font-bold shrink-0">${formatMoney(roundMoney(l.qty * l.price))}</span></div>`).join('');
            const isCredit = o.pay === 'fiado';
            const chosen = getClient(orderClientId), sug = getClient(orderSuggestId), shown = chosen || sug;
            const btn = 'flex-1 whitespace-nowrap text-xs font-bold px-2 py-2 rounded-lg border ';
            // Fiados abiertos del cliente mostrado: sirven para confirmar que es la misma persona
            // Cada fiado abierto como tarjeta completa: desde cuándo está abierto y todos sus productos
            const openList = (c) => clientSummary(c.id).open.slice(0, 3).map(cr => {
                const since = Date.parse(cr.date) ? new Date(cr.date).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
                const lines = (cr.items || []).map(i => `<div class="flex justify-between gap-2 text-xs"><span class="min-w-0">${escapeHtml(i.qty || 1)}× ${escapeHtml(i.name)}</span><span class="shrink-0 text-gray-500">${i.subtotal != null ? formatMoney(i.subtotal) : ''}</span></div>`).join('');
                return `<div class="bg-white border border-red-100 rounded-xl p-3 space-y-2">
                    <div class="flex justify-between items-center gap-2"><span class="flex items-center gap-1.5 text-xs font-bold text-gray-700"><i class="fa-solid fa-cart-shopping text-red-400"></i>Fiado abierto${since ? ' desde ' + escapeHtml(since) : ''}</span><span class="font-extrabold text-red-600 text-sm">${formatMoney(creditPending(cr))}</span></div>
                    <div class="space-y-1 border-t border-gray-100 pt-2">${lines || '<div class="text-xs text-gray-400">Sin productos</div>'}</div>
                    ${cr.paid > 0 ? `<div class="text-[10px] text-gray-400 text-right">Total ${formatMoney(cr.totalDebt)} · Abonado ${formatMoney(cr.paid)}</div>` : ''}</div>`;
            }).join('');
            const clientInfo = (c) => { const s = clientSummary(c.id); return `<div class="text-[11px] text-gray-500">${s.debt > 0.01 ? `Debe ${formatMoney(s.debt)} · ${s.open.length} fiado${s.open.length === 1 ? '' : 's'} abierto${s.open.length === 1 ? '' : 's'}` : 'Sin deuda'}${s.balance > 0.01 ? ` · Saldo a favor ${formatMoney(s.balance)}` : ''}</div>`; };
            const clientBox = !isCredit ? '' : `
                <div class="border rounded-xl p-3 bg-gray-50 space-y-2">
                    <div class="flex justify-between items-center gap-2"><span class="text-xs font-bold text-gray-600">Cliente (obligatorio para fiado)</span>${!chosen && sug ? '<span class="text-[11px] font-bold text-indigo-600">¿Es este cliente?</span>' : ''}</div>
                    ${shown ? `<div class="flex items-center gap-2"><i class="fa-solid ${chosen ? 'fa-circle-check text-green-600' : 'fa-user text-gray-400'}"></i><span class="font-bold text-sm truncate">${escapeHtml(shown.name)}</span></div>${clientInfo(shown)}${openList(shown)}`
                        : '<div class="text-xs text-gray-500">No hay un cliente que coincida.</div>'}
                    ${chosen && clientSummary(chosen.id).open.length ? '<p class="text-[10px] text-orange-600 font-bold">Al aceptar, los productos se sumarán a su fiado abierto más reciente.</p>' : ''}
                    <div class="flex gap-2">${!chosen && sug ? `<button onclick="orderClientId=orderSuggestId;renderOrders()" class="${btn}bg-indigo-600 text-white border-indigo-600">Es este</button>` : ''}<button onclick="orderPickOther()" class="${btn}bg-white text-gray-600 border-gray-200">Buscar otro</button><button onclick="orderNewClient()" class="${btn}bg-white text-gray-600 border-gray-200">Cliente nuevo</button></div>
                </div>`;
            body.innerHTML = `
                <div class="border rounded-xl p-3 space-y-1.5 text-sm">
                    <div class="flex justify-between items-center">${orderPayChip(o.pay)}<span class="text-[11px] text-gray-400">${escapeHtml(orderTime(o.at))}</span></div>
                    <div class="flex items-center gap-2"><i class="fa-solid fa-phone text-gray-400 w-4 text-center"></i><span>${escapeHtml(o.phone)}</span>${wa ? `<a href="https://wa.me/${wa}" target="_blank" rel="noopener" class="ml-auto text-xs font-bold text-green-600"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}</div>
                    <div class="flex items-center gap-2"><i class="fa-solid ${o.delivery === 'delivery' ? 'fa-motorcycle' : 'fa-store'} text-gray-400 w-4 text-center"></i><span class="min-w-0">${o.delivery === 'delivery' ? 'Delivery' + orderAddressHtml(o.address) : 'Retiro en tienda'}</span></div>
                </div>
                <div class="border rounded-xl p-3 space-y-1.5">${rows}<div class="border-t pt-1.5 flex justify-between text-sm font-extrabold"><span>Total</span><span>${orderMoney(total)}</span></div>
                    <p class="text-[10px] text-gray-400">Precios y existencias de tu inventario de hoy.</p></div>
                ${clientBox}
                <div class="flex gap-2">
                    <button onclick="rejectOrder()" class="flex-1 py-3 rounded-xl border border-red-200 text-red-600 font-bold text-sm">Rechazar</button>
                    <button onclick="acceptOrder()" ${cart.length ? '' : 'disabled'} class="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold text-sm disabled:opacity-40">Aceptar</button>
                </div>`;
        }

        // La dirección puede traer el enlace de Google Maps que arma la vitrina (solo ese formato, con números): se muestra como botón
        const ORDER_MAPS_RE = /https:\/\/maps\.google\.com\/\?q=-?\d{1,3}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?/;
        function orderAddressHtml(address) {
            const m = String(address || '').match(ORDER_MAPS_RE);
            const text = String(address || '').replace(ORDER_MAPS_RE, '').trim();
            return (text ? ': ' + escapeHtml(text) : '') + (m ? `<a href="${m[0]}" target="_blank" rel="noopener" class="mt-1 flex w-max items-center gap-1 text-xs font-bold text-indigo-600"><i class="fa-solid fa-location-dot"></i> Ver en Google Maps</a>` : '');
        }

        function orderPickOther() {
            openClientPick('Elegir cliente', null, (id) => { orderClientId = id; renderOrders(); });
        }

        function orderNewClient() {
            const o = currentOrder();
            if (!o) return;
            const r = createClient({ name: o.name, phone: o.phone });
            if (r.error) return customAlert('Revisa los datos', r.error, 'error');
            const cl = r.client || r.dup; // si ya existía uno con ese nombre o teléfono, se usa ese
            orderClientId = cl.id;
            saveData();
            renderAll();
            renderOrders();
        }

        // ---------- Aceptar y rechazar ----------
        function acceptOrder() {
            const o = currentOrder();
            if (!o) return;
            if (state.activeCreditId) return customAlert('Termina la edición', 'Estás editando un fiado. Termínalo antes de aceptar un pedido.', 'error');
            const { cart } = buildOrderCart(o, state.products);
            if (!cart.length) return customAlert('Sin productos', 'Ningún producto del pedido está disponible.', 'error');
            if (o.pay === 'fiado' && !getClient(orderClientId)) return customAlert('Elige el cliente', 'Para un fiado debes elegir o crear el cliente.', 'error');
            const go = () => {
                state.cart = cart;
                state.pendingOrderId = o.id;
                state.pendingOrderPhone = o.phone;
                state.pendingOrderName = o.name;
                state.pendingOrderMsg = `Hola ${o.name}, ya aprobamos tu pedido. ` + (o.delivery === 'delivery' ? 'En breve te lo haremos llegar.' : 'Ya puedes pasar a retirarlo.');
                const clientId = orderClientId;
                closeOrders();
                if (o.pay === 'fiado') {
                    // Si el cliente ya tiene un fiado abierto, los productos se suman a ese (el más reciente); si no, se abre uno nuevo
                    const open = clientSummary(clientId).open[0];
                    if (open) { switchTab('home'); editCredit(open.id); }
                    else newCreditForClient(clientId);
                }
                else {
                    switchTab('home');
                    if ($('isCreditSale').checked) { $('isCreditSale').checked = false; toggleCreditUI(false); }
                    toggleCartModal(true);
                    if (getClient(clientId)) pickClient(clientId, { askOpen: false });
                }
                renderCart();
            };
            if (state.cart.length) customConfirm('Reemplazar el carrito', 'El carrito de la caja tiene productos. ¿Reemplazarlos por este pedido?', 'warning', go);
            else go();
        }

        function rejectOrder() {
            const o = currentOrder();
            if (!o) return;
            customConfirm('Rechazar pedido', `¿Rechazar el pedido de ${o.name}? Se borrará de la bandeja.`, 'warning', async () => {
                try { await orderRef(o.id).delete(); }
                catch (e) { return customAlert('No se pudo rechazar', e.message || 'Intenta de nuevo.', 'error'); }
                orderOpenId = null;
                renderOrders();
                const wa = clientWaNumber(o.phone);
                if (wa) customConfirm('Avisar al cliente', '¿Avisarle por WhatsApp que no pudiste atender su pedido?', 'warning',
                    () => window.open(`https://wa.me/${wa}?text=${encodeURIComponent('No pudimos atender tu pedido.')}`, '_blank', 'noopener'));
            });
        }

        // Botón del cuadro de éxito: abre WhatsApp con el aviso de pedido aprobado (sin recibo)
        function notifyOrderApproved() {
            const d = tempReceiptData;
            if (d && d.waPhone) window.open(`https://wa.me/${d.waPhone}?text=${encodeURIComponent(d.waMsg || 'Ya aprobamos tu pedido.')}`, '_blank', 'noopener');
        }

        // Lo llama runCheckout al terminar: el pedido ya es venta o fiado, sale de la bandeja
        function finishOrder(id) {
            if (!id || !auth.currentUser) return;
            orderRef(id).delete().catch(e => console.warn('Pedido no borrado:', e.code || e.message || e));
        }

        // Prueba comprobable (consola: selfTestOrders()). Solo datos ficticios.
        function selfTestOrders() {
            const products = [{ id: 1, name: 'Harina', qty: 5, price: 0.1, cost: 0.05 }, { id: 'b2', name: 'Arroz', qty: 2, price: 2 }];
            const order = { items: [{ id: '1', n: 3, name: 'Harina', price: 99 }, { id: 'b2', n: 4, name: 'Arroz' }, { id: 'zz', n: 1, name: 'Viejo' }] };
            const r = buildOrderCart(order, products);
            console.assert(r.cart[0].price === 0.1 && r.cart[0].subtotal === 0.3 && r.cart[0].cost === 0.05, 'selfTestOrders: usa el precio de la app');
            console.assert(r.cart.length === 2 && r.lines[2].missing === true, 'selfTestOrders: id desconocido excluido');
            console.assert(r.lines[1].short === true && r.cart[1].qty === 2 && r.lines[1].avail === 2, 'selfTestOrders: n mayor que existencias');
            console.assert(r.total === 4.3, 'selfTestOrders: total con roundMoney');
            const ok = (n, id = 'a') => ({ id, n, name: 'X' });
            const clean = (items) => cleanOrder({ name: 'Ana', phone: '0414-123', items }, 'o1');
            console.assert(clean([ok(0), ok(1000), ok(1.5), { id: 5, n: 1 }, { n: 1 }]) === null, 'selfTestOrders: líneas malas descartadas');
            console.assert(clean([ok(0), ok(2)]).items.length === 1 && clean([ok(2), ok(3)]).items[0].n === 5, 'selfTestOrders: línea buena / duplicados');
            console.assert(cleanOrder({ items: [ok(1)] }, 'a b') === null && clean('x') === null, 'selfTestOrders: id o items inválidos');
            const clients = [{ id: 'c1', name: 'Otra', phone: '584141234567' }, { id: 'c2', name: 'Ana Ficticia', phone: '' }];
            console.assert(matchOrderClient({ name: 'Zeta', phone: '04141234567' }, clients, () => []).client.id === 'c1', 'selfTestOrders: coincide por teléfono');
            const byName = matchOrderClient({ name: 'Ana', phone: '' }, clients, (q) => clients.filter(c => c.name.startsWith(q)));
            console.assert(byName.client.id === 'c2' && byName.by === 'name', 'selfTestOrders: sin teléfono cae a nombre');
            console.assert(matchOrderClient({ name: 'Nadie', phone: '' }, clients, () => []) === null, 'selfTestOrders: sin coincidencia');
            console.log('selfTestOrders terminado');
        }

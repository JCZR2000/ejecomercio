        // ==========================================
        // 26. CLIENTES (Fase 13)
        // Base de clientes: nombre, teléfono, cédula, notas. El fiado guarda 'customer' (texto) y 'clientId'.
        // Las funciones de datos no tocan el DOM ni guardan: quien las llama hace saveData().
        // ==========================================
        const CLIENT_NAME_MAX = 60, CLIENT_DOC_MAX = 20, CLIENT_NOTES_MAX = 200;

        const clipClientText = (v, max) => String(v || '').trim().replace(/\s+/g, ' ').slice(0, max);
        const safeClientId = (id) => /^[\w-]+$/.test(String(id || '')) ? String(id) : ''; // para onclick="..."

        function normalizeClientName(s) {
            return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
        }
        const normalizeClientPhone = (v) => String(v || '').replace(/\D/g, '').slice(0, 15);

        // Número para wa.me: un teléfono local venezolano (0414...) se convierte con el código 58
        function clientWaNumber(phone) {
            let d = normalizeClientPhone(phone);
            if (/^0\d{10}$/.test(d)) d = '58' + d.slice(1);
            return isValidCatalogWhatsapp(d) ? d : '';
        }

        const newClientId = () => 'cl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const getClient = (id) => (id && state.clients.find(c => c.id === id)) || null;
        const creditPending = (c) => roundMoney(calculateRealDebt(c) - c.paid);

        // Resumen de un cliente: deuda pendiente, fiados abiertos y pagados que aún guarda la app, saldo a favor
        function clientSummary(id) {
            const client = getClient(id);
            const open = [], closed = [];
            let debt = 0;
            state.credits.filter(c => c.clientId === id).forEach(c => {
                const p = creditPending(c);
                if (p > 0.01) { open.push(c); debt += p; } else closed.push(c);
            });
            const newest = (a, b) => Number(b.id) - Number(a.id);
            return { client, debt: roundMoney(debt), open: open.sort(newest), closed: closed.sort(newest), balance: client ? roundMoney(client.balance || 0) : 0 };
        }

        // Agrupa los fiados sin cliente por nombre normalizado. Devuelve true si cambió algo; no toca 'customer'.
        // shortcut: los fiados ya saldados no crean cliente (así un cliente eliminado no reaparece); revisar si se quiere historial completo.
        function migrateClients() {
            if (!Array.isArray(state.clients)) state.clients = [];
            const byId = new Map(state.clients.map(c => [c.id, c]));
            const byName = new Map();
            state.clients.forEach(c => { const k = normalizeClientName(c.name); if (!byName.has(k)) byName.set(k, c); });
            let changed = false;
            state.credits.forEach(cr => {
                if (cr.clientId && byId.has(cr.clientId)) return;
                if (cr.paidDate || roundMoney(cr.totalDebt - cr.paid) <= 0.01) return; // misma regla que la lista de fiados
                const key = normalizeClientName(cr.customer);
                let cl = byName.get(key);
                if (!cl) {
                    let id = 'cl_' + hashText(key);
                    if (byId.has(id)) id = newClientId();
                    cl = { id, name: clipClientText(cr.customer, CLIENT_NAME_MAX) || 'Sin nombre', phone: '', doc: '', notes: '', balance: 0, moves: [], createdAt: new Date().toISOString() };
                    state.clients.push(cl);
                    byId.set(id, cl);
                    byName.set(key, cl);
                }
                cr.clientId = cl.id;
                changed = true;
            });
            return changed;
        }

        // Busca por nombre, teléfono o cédula. Primero los que tienen deuda.
        function findClients(query, limit = 20) {
            const q = normalizeClientName(query), d = String(query || '').replace(/\D/g, '');
            const debtOf = new Map();
            state.credits.forEach(c => { if (c.clientId && creditPending(c) > 0.01) debtOf.set(c.clientId, true); });
            return state.clients
                .filter(c => !q || normalizeClientName(c.name).includes(q) || (d && c.phone && c.phone.includes(d)) || normalizeClientName(c.doc).includes(q))
                .sort((a, b) => (debtOf.has(b.id) - debtOf.has(a.id)) || a.name.localeCompare(b.name, 'es'))
                .slice(0, limit);
        }

        // Valida y limpia los campos del formulario. Devuelve { error } o { fields }.
        function cleanClientFields(f) {
            const name = clipClientText(f.name, CLIENT_NAME_MAX);
            if (!name) return { error: 'Escribe el nombre del cliente.' };
            const phone = normalizeClientPhone(f.phone);
            if (phone && phone.length < 7) return { error: 'El teléfono debe tener al menos 7 dígitos.' };
            return { fields: { name, phone, doc: clipClientText(f.doc, CLIENT_DOC_MAX), notes: clipClientText(f.notes, CLIENT_NOTES_MAX) } };
        }

        const findClientDup = (fields, exceptId) => state.clients.find(c => c.id !== exceptId &&
            (normalizeClientName(c.name) === normalizeClientName(fields.name) || (fields.phone && c.phone === fields.phone)));

        // Devuelve { client }, { error } o { dup } (ya existe uno con el mismo nombre o teléfono)
        function createClient(f) {
            const r = cleanClientFields(f);
            if (r.error) return r;
            const dup = findClientDup(r.fields);
            if (dup && !f.allowDuplicate) return { dup };
            const client = { id: newClientId(), ...r.fields, balance: 0, moves: [], createdAt: new Date().toISOString() };
            state.clients.push(client);
            return { client };
        }

        function updateClient(id, f) {
            const client = getClient(id);
            if (!client) return { error: 'Cliente no encontrado.' };
            const r = cleanClientFields(f);
            if (r.error) return r;
            const dup = findClientDup(r.fields, id);
            if (dup && !f.allowDuplicate) return { dup };
            Object.assign(client, r.fields);
            state.credits.forEach(c => { if (c.clientId === id) c.customer = client.name; });
            return { client };
        }

        // Pasa los fiados, el saldo y los movimientos de fromId a toId y borra a fromId
        function mergeClients(fromId, toId) {
            const from = getClient(fromId), to = getClient(toId);
            if (!from || !to || from === to) return { error: 'Clientes no válidos.' };
            state.credits.forEach(c => { if (c.clientId === fromId) { c.clientId = toId; c.customer = to.name; } });
            const moves = [...(to.moves || []), ...(from.moves || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
            to.moves = moves.slice(0, 50);
            if (from.balance > 0) {
                to.balance = roundMoney((to.balance || 0) + from.balance);
                to.moves.unshift({ date: new Date().toISOString(), amount: from.balance, kind: 'MERGE', note: 'Unido desde ' + from.name });
                to.moves = to.moves.slice(0, 50);
            }
            state.clients = state.clients.filter(c => c !== from);
            return { client: to };
        }

        function deleteClient(id) {
            const client = getClient(id);
            if (!client) return { error: 'Cliente no encontrado.' };
            const s = clientSummary(id);
            if (s.open.length) return { error: 'Tiene fiados abiertos. Cóbralos o únelo con otro cliente.' };
            if (s.balance > 0.01) return { error: 'Tiene saldo a favor. Úsalo o ajústalo a 0 primero.' };
            state.credits.forEach(c => { if (c.clientId === id) delete c.clientId; });
            state.clients = state.clients.filter(c => c !== client);
            return { ok: true };
        }

        // Cliente de la caja: el elegido de la lista, uno con el mismo nombre, o uno nuevo solo con nombre
        function resolvePosClient(name) {
            const key = normalizeClientName(name);
            const picked = getClient(state.posClientId);
            if (picked && normalizeClientName(picked.name) === key) return picked;
            const exact = state.clients.find(c => normalizeClientName(c.name) === key);
            if (exact) return exact;
            const r = createClient({ name, allowDuplicate: true });
            return r.client;
        }

        function creditMatchesSearch(c, text) {
            if (!text) return true;
            if (String(c.customer).toLowerCase().includes(text)) return true;
            const cl = getClient(c.clientId), d = text.replace(/\D/g, '');
            return !!(cl && d && cl.phone && cl.phone.includes(d));
        }

        // Nombre de la tarjeta de fiado: abre la ficha si el cliente existe
        function clientNameHtml(c) {
            const id = safeClientId(c.clientId);
            if (!id || !getClient(id)) return escapeHtml(c.customer);
            return `<button onclick="openClientCard('${id}')" class="text-left hover:underline">${escapeHtml(c.customer)}</button>`;
        }

        // ---------- Sección Fiados: Deudas / Clientes ----------
        function setCreditsSection(sec) {
            const clients = sec === 'CLIENTS';
            $('creditsDebtsPane').classList.toggle('hidden', clients);
            $('clientsPanel').classList.toggle('hidden', !clients);
            const on = 'flex-1 py-2 rounded-xl text-sm font-bold border ', off = ' bg-white text-gray-600 border-gray-200';
            $('btnSectionDebts').className = on + (clients ? off.trim() : 'bg-red-600 text-white border-red-600');
            $('btnSectionClients').className = on + (clients ? 'bg-indigo-600 text-white border-indigo-600' : off.trim());
            if (clients) renderClientsList(); else renderCreditsList();
        }

        function renderClientsList() {
            const panel = $('clientsPanel');
            if (!panel || panel.classList.contains('hidden')) return;
            const rate = getFiadosActiveRate();
            const list = findClients($('clientSearchInput').value, Infinity);
            const box = $('clientsList');
            if (!list.length) {
                box.innerHTML = '<div class="col-span-full text-center text-gray-400 text-sm font-bold py-10">No hay clientes. Crea el primero con «+ Nuevo cliente».</div>';
                return;
            }
            box.innerHTML = list.map(c => {
                const s = clientSummary(c.id);
                return `<button onclick="openClientCard('${safeClientId(c.id)}')" class="bg-white border border-gray-100 rounded-xl shadow-sm p-3 text-left flex justify-between items-center gap-2 hover:shadow-md transition">
                    <div class="min-w-0">
                        <div class="font-bold text-gray-800 truncate"><i class="fa-solid fa-user text-gray-400 text-xs mr-1"></i>${escapeHtml(c.name)}</div>
                        <div class="text-[11px] text-gray-500 truncate">${escapeHtml(c.phone || 'Sin teléfono')}</div>
                    </div>
                    <div class="text-right shrink-0">
                        ${s.debt > 0.01 ? `<div class="font-bold text-red-600">${formatMoney(s.debt)}</div><div class="text-[10px] text-blue-600 font-bold">Bs ${(s.debt * rate).toFixed(2)}</div>` : ''}
                    </div>
                </button>`;
            }).join('');
        }

        // ---------- Formulario (crear y editar) ----------
        let clientFormOnSaved = null;

        function openClientForm(id = null, opts = {}) {
            const c = id ? getClient(id) : null;
            $('clientFormId').value = c ? c.id : '';
            $('clientFormTitle').textContent = c ? 'Editar cliente' : 'Nuevo cliente';
            $('clientFormName').value = c ? c.name : (opts.name || '');
            $('clientFormPhone').value = c ? c.phone : '';
            $('clientFormDoc').value = c ? c.doc : '';
            $('clientFormNotes').value = c ? c.notes : '';
            clientFormOnSaved = opts.onSaved || null;
            $('clientFormModal').classList.remove('hidden');
            $('clientFormName').focus();
        }

        function closeClientForm() {
            $('clientFormModal').classList.add('hidden');
            clientFormOnSaved = null;
        }

        function submitClientForm() {
            const id = $('clientFormId').value;
            const f = { name: $('clientFormName').value, phone: $('clientFormPhone').value, doc: $('clientFormDoc').value, notes: $('clientFormNotes').value };
            const res = id ? updateClient(id, f) : createClient(f);
            if (res.error) return customAlert('Revisa los datos', res.error, 'error');
            const done = (client) => {
                const cb = clientFormOnSaved;
                closeClientForm();
                saveData();
                renderAll();
                renderClientCard();
                if (cb) cb(client);
            };
            if (res.dup) {
                if (id) return customAlert('Cliente repetido', `Ya existe «${res.dup.name}» con ese nombre o teléfono. Usa «Unir con…» en su ficha para juntarlos.`, 'error');
                return customConfirm('Cliente repetido', `Ya existe «${res.dup.name}» con ese nombre o teléfono. ¿Usar ese cliente?`, 'warning', () => done(res.dup));
            }
            done(res.client);
        }

        // ---------- Elegir otro cliente (para unir) ----------
        let clientPickOnPick = null, clientPickExcept = null;

        function openClientPick(title, exceptId, onPick) {
            clientPickOnPick = onPick;
            clientPickExcept = exceptId;
            $('clientPickTitle').textContent = title;
            $('clientPickSearch').value = '';
            renderClientPick();
            $('clientPickModal').classList.remove('hidden');
        }

        function closeClientPick() {
            $('clientPickModal').classList.add('hidden');
            clientPickOnPick = null;
        }

        function renderClientPick() {
            const list = findClients($('clientPickSearch').value, 30).filter(c => c.id !== clientPickExcept);
            $('clientPickList').innerHTML = list.length ? list.map(c =>
                `<button onclick="pickClientFromModal('${safeClientId(c.id)}')" class="w-full text-left px-2 py-2 border-b text-sm font-bold hover:bg-indigo-50">${escapeHtml(c.name)} <span class="text-[11px] text-gray-400 font-normal">${escapeHtml(c.phone)}</span></button>`).join('')
                : '<div class="text-xs text-gray-400 p-2">No hay otros clientes.</div>';
        }

        function pickClientFromModal(id) {
            const cb = clientPickOnPick;
            closeClientPick();
            if (cb) cb(id);
        }

        // ---------- Ficha del cliente ----------
        let currentClientId = null;

        function openClientCard(id) {
            if (!getClient(id)) return;
            currentClientId = id;
            $('clientModal').classList.remove('hidden');
            renderClientCard();
        }

        function closeClientCard() {
            $('clientModal').classList.add('hidden');
            currentClientId = null;
        }

        function renderClientCard() {
            if (!currentClientId || $('clientModal').classList.contains('hidden')) return;
            const s = clientSummary(currentClientId);
            if (!s.client) return closeClientCard();
            const c = s.client, id = safeClientId(c.id), rate = getFiadosActiveRate();
            const wa = clientWaNumber(c.phone);
            const day = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(); };
            const openRows = s.open.map(cr => `<div class="flex justify-between items-center text-xs border-b py-1.5">
                    <span>${escapeHtml(day(cr.date))}</span>
                    <span class="font-bold text-red-600">${formatMoney(creditPending(cr))}</span>
                    <button onclick="viewClientCredits('${id}')" class="text-blue-600 font-bold hover:underline">Ver</button></div>`).join('')
                || '<div class="text-xs text-gray-400">Sin fiados abiertos.</div>';
            const closedRows = s.closed.slice(0, 5).map(cr => `<div class="flex justify-between text-xs border-b py-1.5 text-gray-500">
                    <span>${escapeHtml(day(cr.date))}</span><span>${formatMoney(cr.totalDebt)}</span><span>Pagado</span></div>`).join('')
                || '<div class="text-xs text-gray-400">Ninguno guardado.</div>';
            $('clientModalBody').innerHTML = `
                <div class="flex justify-between items-start gap-2">
                    <div class="min-w-0">
                        <h3 class="text-xl font-bold text-gray-800 break-words">${escapeHtml(c.name)}</h3>
                        <p class="text-xs text-gray-500">${escapeHtml(c.phone || 'Sin teléfono')}${c.doc ? ' · ' + escapeHtml(c.doc) : ''}</p>
                        ${c.notes ? `<p class="text-xs text-gray-400 italic mt-1">${escapeHtml(c.notes)}</p>` : ''}
                    </div>
                    <button onclick="openClientForm('${id}')" class="shrink-0 text-xs bg-gray-100 border border-gray-200 text-gray-700 px-3 py-1 rounded font-bold">Editar</button>
                </div>
                <div class="bg-red-50 border border-red-100 rounded-lg p-3 my-3 flex justify-between items-center">
                    <span class="text-[10px] font-bold text-red-400 uppercase">Deuda pendiente</span>
                    <span class="text-right"><span class="font-bold text-red-600 text-lg">${formatMoney(s.debt)}</span><br><span class="text-[11px] text-blue-600 font-bold">Bs ${(s.debt * rate).toFixed(2)}</span></span>
                </div>
                <h4 class="text-[10px] font-bold text-gray-500 uppercase mb-1">Fiados abiertos</h4>${openRows}
                <h4 class="text-[10px] font-bold text-gray-500 uppercase mt-3 mb-1">Pagados (últimos guardados)</h4>${closedRows}
                <div class="grid grid-cols-2 gap-2 mt-4">
                    ${wa ? `<button onclick="openClientWhatsapp('${id}')" class="bg-green-600 text-white py-2 rounded text-xs font-bold"><i class="fa-brands fa-whatsapp mr-1"></i>WhatsApp</button>` : ''}
                    <button onclick="newCreditForClient('${id}')" class="bg-orange-600 text-white py-2 rounded text-xs font-bold">Nuevo fiado</button>
                    <button onclick="startMergeClient('${id}')" class="bg-gray-100 border border-gray-200 text-gray-700 py-2 rounded text-xs font-bold">Unir con…</button>
                    <button onclick="requestDeleteClient('${id}')" class="bg-red-50 border border-red-200 text-red-600 py-2 rounded text-xs font-bold">Eliminar</button>
                </div>`;
        }

        function openClientWhatsapp(id) {
            const c = getClient(id), wa = c && clientWaNumber(c.phone);
            if (wa) window.open('https://wa.me/' + wa, '_blank');
        }

        function viewClientCredits(id) {
            const c = getClient(id);
            if (!c) return;
            closeClientCard();
            setCreditsSection('DEBTS');
            $('creditSearchInput').value = c.name;
            renderCreditsList();
        }

        function newCreditForClient(id) {
            closeClientCard();
            switchTab('home');
            $('isCreditSale').checked = true;
            toggleCreditUI(true);
            toggleCartModal(true);
            pickClient(id, { askOpen: false });
        }

        function startMergeClient(fromId) {
            const from = getClient(fromId);
            if (!from) return;
            openClientPick(`Unir «${from.name}» con…`, fromId, (toId) => {
                const to = getClient(toId);
                if (!to) return;
                customConfirm('Unir clientes', `Todo lo de «${from.name}» pasará a «${to.name}» y «${from.name}» se borrará.`, 'warning', () => {
                    const r = mergeClients(fromId, toId);
                    if (r.error) return customAlert('No se pudo unir', r.error, 'error');
                    saveData();
                    renderAll();
                    currentClientId = toId;
                    renderClientCard();
                });
            });
        }

        function requestDeleteClient(id) {
            const c = getClient(id);
            if (!c) return;
            customConfirm('Eliminar cliente', `¿Eliminar a «${c.name}»? Esta acción no se puede deshacer.`, 'warning', () => {
                const r = deleteClient(id);
                if (r.error) return customAlert('No se puede eliminar', r.error, 'error');
                saveData();
                closeClientCard();
                renderAll();
            });
        }

        // ---------- Buscador de la caja ----------
        function hideClientPicker() { const b = $('clientPickerList'); if (b) b.classList.add('hidden'); }
        function hideClientPickerDelayed() { setTimeout(hideClientPicker, 200); }

        function onClientPickerInput() {
            const input = $('customerName');
            if (state.posClientId) {
                const c = getClient(state.posClientId);
                if (c && c.name === input.value) return hideClientPicker();
                state.posClientId = null; // escribió otra cosa: ya no es el cliente elegido
            }
            const q = input.value.trim(), box = $('clientPickerList');
            box.innerHTML = '';
            findClients(q).forEach(c => {
                const s = clientSummary(c.id);
                const row = document.createElement('div');
                row.className = 'p-2 text-xs border-b hover:bg-orange-50 cursor-pointer flex justify-between gap-2';
                row.innerHTML = `<span class="min-w-0 truncate"><span class="font-bold">${escapeHtml(c.name)}</span> <span class="text-gray-400">${escapeHtml(c.phone)}</span></span>
                    <span class="shrink-0 font-bold text-red-600">${s.debt > 0.01 ? formatMoney(s.debt) : ''}</span>`;
                row.onmousedown = (e) => { e.preventDefault(); pickClient(c.id); };
                box.appendChild(row);
            });
            if (q && !state.clients.some(c => normalizeClientName(c.name) === normalizeClientName(q))) {
                const add = document.createElement('div');
                add.className = 'p-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 cursor-pointer';
                add.textContent = `+ Crear cliente "${q}"`;
                add.onmousedown = (e) => {
                    e.preventDefault();
                    hideClientPicker();
                    openClientForm(null, { name: q, onSaved: (c) => pickClient(c.id) });
                };
                box.appendChild(add);
            }
            box.classList.toggle('hidden', !box.children.length);
        }

        function pickClient(id, { askOpen = true } = {}) {
            const c = getClient(id);
            if (!c) return;
            state.posClientId = id;
            $('customerName').value = c.name;
            hideClientPicker();
            const open = clientSummary(id).open[0];
            if (askOpen && open && !state.activeCreditId) {
                customConfirm('Fiado abierto', `${c.name} tiene un fiado abierto de ${formatMoney(creditPending(open))}. ¿Sumar esta compra a ese fiado?`, 'warning', () => editCredit(open.id));
            }
        }

        // ---------- Recordatorio por WhatsApp al cliente ----------
        function updateShareClientWa() {
            const credit = getShareCredit(), cl = credit && getClient(credit.clientId);
            const num = cl ? clientWaNumber(cl.phone) : '';
            const btn = $('btnShareClientWa');
            btn.classList.toggle('hidden', !num);
            if (num) btn.textContent = `Enviar por WhatsApp a ${cl.phone}`;
        }

        function sendShareToClientWhatsapp() {
            const credit = getShareCredit(), cl = credit && getClient(credit.clientId), num = cl ? clientWaNumber(cl.phone) : '';
            if (num) window.open(`https://wa.me/${num}?text=${encodeURIComponent($('shareMessageInput').value)}`, '_blank');
        }

        // ---------- Autoprueba (datos ficticios). Ejecutar en consola: selfTestClients() ----------
        function selfTestClients() {
            const bak = structuredClone({ credits: state.credits, clients: state.clients, products: state.products, sales: state.sales, creditMode: state.creditMode });
            let fails = 0;
            const t = (cond, msg) => { console.assert(cond, msg); if (!cond) { fails++; console.error('FALLA: ' + msg); } };
            try {
                state.creditMode = 'FIXED';
                state.products = [];
                state.sales = [];
                const mk = (id, name) => ({ id, customer: name, items: [], totalDebt: 10, paid: 0, date: '' });
                const fresh = () => { state.clients = []; state.credits = [mk(1, ' pedro '), mk(2, 'Pedro'), mk(3, 'Pédro'), mk(4, 'Ana')]; };
                fresh();
                t(migrateClients() === true, 'la primera migración cambia algo');
                const [c1, c2, c3, c4] = state.credits;
                t(state.clients.length === 2 && c1.clientId === c2.clientId && c2.clientId === c3.clientId && c4.clientId !== c1.clientId, 'pedro/Pedro/Pédro son un cliente y Ana otro');
                t(state.credits.map(c => c.customer).join('|') === ' pedro |Pedro|Pédro|Ana', 'customer no se toca');
                const ids = state.clients.map(c => c.id).join();
                t(migrateClients() === false && state.clients.map(c => c.id).join() === ids, 'la segunda migración no cambia nada');
                const firstId = c1.clientId;
                fresh(); migrateClients();
                t(state.credits[0].clientId === firstId, 'el id migrado es determinista');
                state.credits[3].clientId = 'cl_noexiste';
                t(migrateClients() === true && getClient(state.credits[3].clientId), 'un clientId inexistente se reasigna');

                const pedro = getClient(firstId);
                pedro.phone = '04140000000';
                t(findClients('0414').some(c => c.id === firstId) && findClients('pedro').some(c => c.id === firstId) && findClients('zzz').length === 0, 'buscar por teléfono y por nombre');
                t(clientWaNumber('04140000000') === '584140000000' && clientWaNumber('123') === '', 'número de WhatsApp');
                t(updateClient(firstId, { name: 'Pedro Pérez', phone: '04140000000' }).client && state.credits.slice(0, 3).every(c => c.customer === 'Pedro Pérez'), 'renombrar actualiza customer en sus fiados');
                t(deleteClient(firstId).error, 'no se elimina a un cliente con deuda');
                const zoe = createClient({ name: 'Zoe' }).client;
                t(createClient({ name: 'zoé' }).dup === zoe, 'avisa del cliente repetido');
                t(deleteClient(zoe.id).ok && !getClient(zoe.id), 'se elimina a un cliente sin deuda');

                const a = state.clients.find(c => c.name === 'Ana'), p = getClient(firstId);
                a.balance = 0.1; p.balance = 0.2;
                t(mergeClients(a.id, p.id).client === p && p.balance === 0.3 && !getClient(a.id) && state.credits[3].clientId === p.id, 'unir pasa fiados, suma saldos y borra el origen');
            } finally {
                state.credits = bak.credits; state.clients = bak.clients; state.products = bak.products; state.sales = bak.sales; state.creditMode = bak.creditMode;
            }
            console.log(fails ? `selfTestClients: ${fails} fallas` : 'selfTestClients: OK');
            return fails;
        }

        // Al arrancar: fiados de versiones viejas reciben su cliente. Solo local: la nube se actualiza cuando se sincroniza.
        try {
            if (migrateClients()) {
                localStorage.setItem('inv_credits', JSON.stringify(state.credits));
                localStorage.setItem('inv_clients', JSON.stringify(state.clients));
            }
        } catch (e) { console.warn('No se pudo preparar la lista de clientes:', e); }

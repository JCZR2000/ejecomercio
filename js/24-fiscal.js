        // ==========================================
        // 🎫 SISTEMA DE FACTURACIÓN FISCAL (SENIAT)
        // ==========================================

        function setInvoiceType(type) {
            state.receiptType = type;
            saveData();
            updateConfigUI(); // Actualizar botones en el modal
        }

        function selectInvoiceType(type) {
            $('invoiceTypeModal').classList.add('hidden');
            setInvoiceType(type);
            routeReceipt(tempReceiptData); // Continuar flujo
        }

        function updateConfigUI() {
            if(!$('btnTypePers')) return;
            const fiscal = state.receiptType === 'FISCAL';
            $('btnTypeFisc').className = optionClass(fiscal ? 'blue' : '') + ' cursor-pointer';
            $('btnTypePers').className = optionClass(fiscal ? '' : 'indigo') + ' cursor-pointer';
            $('chipTypeFisc').classList.toggle('hidden', !fiscal);
            $('chipTypePers').classList.toggle('hidden', fiscal);
        }

        function openFiscalConfigFromMenu() {
                // NUEVO: Cargamos el nombre de la empresa (si está vacío, intentamos heredar el de la configuración normal para ahorrarle tiempo al usuario)
                $('fiscCfgCompany').value = state.fiscalConfig.companyName || state.receiptConfig.companyName || '';
                $('fiscCfgRif').value = state.fiscalConfig.rif || '';
                $('fiscCfgAddress').value = state.fiscalConfig.address || '';
                $('fiscCfgZip').value = state.fiscalConfig.zip || '';
                $('fiscCfgIva').checked = state.fiscalConfig.ivaIncluded;
                $('fiscalConfigModal').classList.remove('hidden');
            }

        function closeFiscalConfig() {
            $('fiscalConfigModal').classList.add('hidden');
        }

        function saveFiscalConfig() {
            state.fiscalConfig.companyName = $('fiscCfgCompany').value.trim(); // NUEVO CAMPO
            state.fiscalConfig.rif = $('fiscCfgRif').value.trim();
            state.fiscalConfig.address = $('fiscCfgAddress').value.trim();
            state.fiscalConfig.zip = $('fiscCfgZip').value.trim();
            state.fiscalConfig.ivaIncluded = $('fiscCfgIva').checked;
            
            if (!state.fiscalConfig.companyName) return alert("La Razón Social es obligatoria."); // VALIDACIÓN
            if (!state.fiscalConfig.rif) return alert("El RIF es obligatorio.");
            
            saveData();
            closeFiscalConfig();
            
            // Si venía del flujo de generar factura, continuar
            if (tempReceiptData && !document.getElementById('fiscalReceiptModal').classList.contains('hidden') === false) {
                prepareFiscalReceiptModal(tempReceiptData);
            } else {
                alert("Configuración Fiscal Guardada.");
            }
        }

        // ------------------------------------------
        // MÉTODOS DE PAGO (Fase 22)
        // ------------------------------------------
        const PAY_METHODS = [
            { key: 'EFECTIVO', text: 'Efectivo Bs' }, { key: 'DIVISAS', text: 'Divisas' }, { key: 'PAGO_MOVIL', text: 'Pago móvil' },
            { key: 'TRANSFERENCIA', text: 'Transferencia' }, { key: 'PUNTO', text: 'Punto de venta' }, { key: 'OTRO', text: 'Otro' }
        ];
        const REF_METHODS = ['PAGO_MOVIL', 'TRANSFERENCIA', 'PUNTO']; // los que llevan referencia
        const LEGACY_PAY_KEYS = { 'PAGO MOVIL': 'PAGO_MOVIL', 'PUNTO DE VENTA': 'PUNTO' }; // selector de las facturas de la v60.0

        // Pura: clave válida o '' (también traduce las claves viejas; 'CREDITO' y lo desconocido dan '')
        function payMethodKey(raw) {
            const k = LEGACY_PAY_KEYS[raw] || raw;
            return PAY_METHODS.some(m => m.key === k) ? k : '';
        }
        function payMethodLabel(raw) { const m = PAY_METHODS.find(x => x.key === payMethodKey(raw)); return m ? m.text : ''; }
        // Pura: referencia limpia (una línea, ≤ 20); vacía si el método no la lleva
        function cleanPayRef(key, ref) { return REF_METHODS.includes(key) ? String(ref || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 20) : ''; }
        // Pura: lo que se guarda en la venta o el abono ({} si no hay método válido)
        function payFields(pay) {
            const method = payMethodKey(pay && pay.method);
            if (!method) return {};
            const methodRef = cleanPayRef(method, pay.methodRef);
            return { method, ...(methodRef ? { methodRef } : {}) };
        }
        // Comodidad del dispositivo: el último método usado (no viaja a la nube)
        function lastPayMethod() { try { return payMethodKey(localStorage.getItem('inv_last_pay_method')) || 'EFECTIVO'; } catch (e) { return 'EFECTIVO'; } }
        function rememberPayMethod(key) { try { if (key) localStorage.setItem('inv_last_pay_method', key); } catch (e) { /* sin almacenamiento */ } }

        // Controles que salen de PAY_METHODS (factura, caja y pagos múltiples)
        const payChips = fn => PAY_METHODS.map(m => `<button type="button" data-pay="${m.key}" onclick="${fn}('${m.key}')">${m.text}</button>`).join('');
        $('fiscalPayChips').innerHTML = payChips('setFiscalMethod');
        $('posPayChips').innerHTML = payChips('setPosPayMethod');
        $('multiPayMethod').innerHTML = PAY_METHODS.map(m => `<option value="${m.key}">${m.text}</option>`).join('');
        updatePosPayRow();

        function closeFiscalReceiptModal() {
            $('fiscalReceiptModal').classList.add('hidden');
        }

        // Datos del cliente de la factura: nada se inventa; el documento muestra «Consumidor final» si se deja vacío
        const FISCAL_NO_ID = 'V-00000000', FISCAL_NO_NAME = 'CONSUMIDOR FINAL';
        let fiscalClientId = null; // cliente de la base elegido en esta factura
        let fiscalSel = 0;         // 0 = factura principal; n = n-ésima factura de lo agregado a un fiado
        let fiscalMethod = 'EFECTIVO';

        function fillGenericClient() {
            fiscalClientId = null;
            $('fiscalClientSearch').value = '';
            $('fiscalClientRif').value = FISCAL_NO_ID;
            $('fiscalClientName').value = FISCAL_NO_NAME;
            $('fiscalClientAddress').value = '';
            $('fiscalClientPhone').value = '';
            updateFiscalPreview();
        }

        function pickFiscalClient(id) {
            const c = getClient(id);
            if (!c) return;
            fiscalClientId = id;
            $('fiscalClientSearch').value = '';
            $('fiscalClientList').classList.add('hidden');
            $('fiscalClientRif').value = c.doc || '';
            $('fiscalClientName').value = c.name || '';
            $('fiscalClientPhone').value = c.phone || '';
            $('fiscalClientAddress').value = c.address || '';
            updateFiscalPreview();
        }

        function onFiscalClientSearch() {
            const q = $('fiscalClientSearch').value.trim(), box = $('fiscalClientList');
            box.innerHTML = '';
            if (q) findClients(q, 6).forEach(c => {
                const row = document.createElement('div');
                row.className = 'px-3 py-2 text-xs border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer min-w-0 truncate';
                row.innerHTML = `<span class="font-bold text-slate-700">${escapeHtml(c.name)}</span> <span class="text-slate-400">${escapeHtml(c.doc || c.phone)}</span>`;
                row.onmousedown = (e) => { e.preventDefault(); pickFiscalClient(c.id); };
                box.appendChild(row);
            });
            box.classList.toggle('hidden', !box.children.length);
        }

        function setFiscalMethod(key) {
            fiscalMethod = payMethodKey(key) || 'EFECTIVO';
            $('fiscalPayChips').querySelectorAll('button').forEach(b => {
                const on = b.dataset.pay === fiscalMethod;
                b.className = 'shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition active:scale-95 disabled:cursor-not-allowed ' + (on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600');
            });
            $('fiscalPayRef').classList.toggle('hidden', !REF_METHODS.includes(fiscalMethod));
            updateFiscalPreview();
        }

        // ------------------------------------------
        // NUMERACIÓN CONTINUA (Fase 21)
        // Cada venta de contado y cada fiado nuevo recibe su número al cerrarse la venta; los abonos llevan su propia
        // serie (A-000001) y no generan factura. Con sesión, los números salen de users/{uid}/counters/fiscal por
        // transacción; sin conexión la operación queda «por asignar» y se numera al reconectar, en orden de fecha.
        // ------------------------------------------
        const BCV_HISTORY_URL = 'https://raw.githubusercontent.com/JCZR2000/ComercioPrecioAPI/main/base_datos_bcv.json';
        let assignPromise = null, assignAgain = false;
        let fiscalCtx = { bcvRate: null, note: '' };
        let bcvHistoryCache = null; // solo en memoria: ni localStorage ni nube

        // Tasa oficial BCV del momento (USD o EUR según el modo de tasa)
        function currentBcvRate() { return (state.rateMode === 'EUR' ? state.bcvEur : state.bcvUsd) || 0; }

        // Campos que lleva toda operación nueva que necesita número
        function numFields() {
            const b = currentBcvRate();
            return { numPending: true, ...(b > 0 ? { bcvRate: b } : {}) };
        }

        // Pura: operaciones esperando número, de la más antigua a la más nueva. st = { sales, credits }
        function pendingDocs(st) {
            const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
            const sales = (st.credits || []).filter(c => c.numPending);
            const payments = [];
            (st.sales || []).forEach(s => { if (s.numPending) (s.type === 'payment' ? payments : sales).push(s); });
            return { sales: sales.sort(byDate), payments: payments.sort(byDate) };
        }

        // Pura: [{ ref, num }] consecutivos desde start
        function numberPlan(list, start) {
            return list.map((ref, i) => ({ ref, num: start + i }));
        }

        // Pura: primer número de venta a usar. Si nadie reservó después del bloque viejo de este dispositivo, se sigue desde lo que le quedaba.
        function fiscalStart(cloudNext, block, currentNumber) {
            if (block && block.next <= block.end && cloudNext === block.end + 1) return block.next;
            return Math.max(cloudNext, currentNumber || 1);
        }

        function maxPayNum(st) {
            return (st.sales || []).reduce((m, s) => Math.max(m, parseInt(s.payNum, 10) || 0), 0);
        }

        // Una sola asignación a la vez; si llega otra petición mientras corre, se repite al terminar
        function assignPendingNumbers() {
            if (assignPromise) { assignAgain = true; return assignPromise; }
            assignPromise = runAssign().finally(() => {
                assignPromise = null;
                if (assignAgain) { assignAgain = false; assignPendingNumbers(); }
            });
            return assignPromise;
        }

        async function runAssign() {
            const p = pendingDocs(state);
            const N = p.sales.length, M = p.payments.length;
            if (!N && !M) return;
            const cfg = state.fiscalConfig;
            const user = auth.currentUser;
            const wasPending = !!(tempReceiptData && tempReceiptData.numPending);
            try {
                let s, a, recovered = false;
                if (!user) { // Modo sin sesión: un solo dispositivo
                    s = cfg.currentNumber || 1;
                    a = cfg.currentPayment || maxPayNum(state) + 1;
                } else {
                    if (!navigator.onLine) return;
                    let block = null;
                    try { block = N ? JSON.parse(localStorage.getItem('inv_fiscal_block')) : null; } catch (e) { /* sin bloque */ }
                    const ref = db.collection('users').doc(user.uid).collection('counters').doc('fiscal');
                    ({ s, a } = await db.runTransaction(async tx => {
                        const d = (await tx.get(ref)).data() || {};
                        const s = fiscalStart(d.next || 1, block, cfg.currentNumber);
                        const a = Math.max(d.nextPayment || 1, maxPayNum(state) + 1);
                        tx.set(ref, { ...(N ? { next: s + N } : {}), ...(M ? { nextPayment: a + M } : {}) }, { merge: true });
                        return { s, a };
                    }));
                    recovered = !!block && s === block.next;
                }
                // El estado pudo cambiar mientras esperaba la nube: se vuelve a leer y solo se numeran los N y M reservados
                const now = pendingDocs(state);
                const stamp = new Date().toISOString();
                numberPlan(now.sales.slice(0, N), s).forEach(({ ref, num }) => { ref.fiscalNum = String(num).padStart(6, '0'); ref.numAt = stamp; delete ref.numPending; });
                numberPlan(now.payments.slice(0, M), a).forEach(({ ref, num }) => { ref.payNum = String(num).padStart(6, '0'); ref.numAt = stamp; delete ref.numPending; });
                if (N) cfg.currentNumber = recovered ? s + N : Math.max(cfg.currentNumber || 1, s + N);
                if (M) cfg.currentPayment = Math.max(cfg.currentPayment || 1, a + M);
                if (N && user) { try { localStorage.removeItem('inv_fiscal_block'); } catch (e) { /* sin almacenamiento */ } }
                saveData();
                renderAll();
                // Si había un recibo abierto esperando su número, se repinta
                if (tempReceiptData) {
                    syncReceiptRecord(tempReceiptData);
                    if (wasPending && !$('fiscalReceiptModal').classList.contains('hidden')) prepareFiscalReceiptModal(tempReceiptData);
                    else if (!$('receiptModal').classList.contains('hidden')) updateReceiptPreview();
                }
            } catch (e) {
                console.warn('No se pudieron asignar los números:', e);
            }
        }

        // ------------------------------------------
        // TASA DE LA FACTURA (Fase 21)
        // ------------------------------------------

        // Pura: tasa de la mayor `fecha` <= el día (hora de Venezuela) de isoDate. currency: 'dolar' | 'euro'. null si no hay.
        function bcvRateOn(history, isoDate, currency) {
            if (!Array.isArray(history) || !history.length) return null;
            const day = new Date(isoDate).toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
            let best = null;
            history.forEach(h => { if (h.fecha <= day && h[currency] > 0 && (!best || h.fecha > best.fecha)) best = h; });
            return best ? best[currency] : null;
        }

        // Solo se descarga cuando hace falta (factura de un registro viejo); null si falla
        async function getBcvHistory() {
            if (bcvHistoryCache) return bcvHistoryCache;
            try {
                const r = await fetch(BCV_HISTORY_URL);
                if (!r.ok) throw new Error('HTTP ' + r.status);
                const j = await r.json();
                if (Array.isArray(j)) bcvHistoryCache = j;
            } catch (e) { console.warn('No se pudo leer el historial del BCV:', e); }
            return bcvHistoryCache;
        }

        // Tasa BCV que lleva la factura de esta operación: { bcvRate, note }
        async function invoiceRates(data) {
            if (data.bcvRate > 0) return { bcvRate: data.bcvRate, note: '' };
            if (!data.fiscalNum) return { bcvRate: currentBcvRate() || null, note: '' }; // se emitirá hoy
            const hist = await getBcvHistory();
            const r = hist ? bcvRateOn(hist, data.date, data.isCredit || state.rateMode !== 'EUR' ? 'dolar' : 'euro') : null;
            if (r) return { bcvRate: r, note: '' };
            return data.isCredit ? { bcvRate: state.bcvUsd || null, note: 'Tasa del día de emisión' } : { bcvRate: null, note: '' };
        }

        // Pura: productos entre dos cortes (los agregados después no entran). Sin `from`, entran también los que no tienen fecha.
        function invoiceItems(items, to, from) {
            return (items || []).filter(i => from ? (i.at && i.at > from && i.at <= to) : (!i.at || i.at <= to));
        }

        const fmtBs = n => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Pura: todo lo que muestra la factura. rec = { kind: 'sale'|'credit'|'payment', total, items, rate, paid, toBalance, creditDate, cutFrom, cutTo, invoice }
        // ctx = { ivaIncluded, bcvRate, fallbackRate, method, methodRef, note, company, client, number, date }. Con rec.invoice (copia fija) todo sale de ahí.
        function buildInvoiceView(rec, ctx) {
            const inv = rec.invoice;
            const credit = rec.kind === 'credit';
            const ivaIncluded = inv ? inv.ivaIncluded : ctx.ivaIncluded;
            const bcv = inv ? inv.bcvRate : ctx.bcvRate;
            const key = inv ? payMethodKey(inv.method) : credit ? '' : payMethodKey(ctx.method) || 'EFECTIVO';
            // Pagada en divisas no entraron bolívares: Bs = $ × tasa BCV
            const rate = inv ? inv.rate : credit ? (ctx.bcvRate || 0) : key === 'DIVISAS' && bcv > 0 ? bcv : (rec.rate > 0 ? rec.rate : ctx.fallbackRate);
            const base = inv ? inv.items
                : rec.kind === 'payment' ? [{ qty: 1, name: 'ABONO A CUENTA', price: rec.total }]
                : credit ? invoiceItems(rec.items, rec.cutTo || rec.creditDate, rec.cutFrom)
                : (rec.items || []);
            const items = base.map(i => ({ qty: i.qty, name: i.name, price: i.price, bs: roundMoney(i.qty * i.price * rate) }));
            const sum = roundMoney(items.reduce((t, i) => t + i.bs, 0));
            let bi, iva, total;
            if (inv) { bi = inv.bi; iva = inv.iva; total = inv.totalBs; }
            else if (ivaIncluded) { total = sum; bi = roundMoney(sum / 1.16); iva = roundMoney(total - bi); }
            else { bi = sum; iva = roundMoney(sum * 0.16); total = roundMoney(bi + iva); }
            const equivUsd = inv ? inv.equivUsd : (rec.kind !== 'payment' && bcv > 0 ? roundMoney(total / bcv) : null);
            const condition = inv ? (inv.condition || (inv.method === 'CREDITO' ? 'CRÉDITO' : 'CONTADO')) : credit ? 'CRÉDITO' : 'CONTADO';
            const methodText = condition === 'CRÉDITO' ? 'Crédito' : key === 'DIVISAS' && equivUsd ? `DIVISAS $${fmtBs(equivUsd)}` : payMethodLabel(key) || 'Efectivo Bs';
            return {
                company: inv ? inv.company : ctx.company, client: inv ? inv.client : ctx.client, number: ctx.number, date: ctx.date,
                items, rate, ivaIncluded, bi, iva, total, condition,
                bcvRate: bcv > 0 ? bcv : null, equivUsd,
                method: key, methodRef: inv ? (inv.methodRef || '') : cleanPayRef(key, ctx.methodRef), methodText,
                cutAt: inv ? inv.cutAt : credit ? (rec.cutTo || rec.creditDate) : undefined,
                paidBs: inv ? inv.paidBs : roundMoney((rec.paid || 0) * rate),
                note: inv ? inv.note : [rec.toBalance > 0 ? `Esta factura incluye Bs ${fmtBs(roundMoney(rec.toBalance * rate))} de saldo a favor del cliente.` : '', ctx.note].filter(Boolean).join(' ')
            };
        }

        // Pura: la copia fija que se guarda en la venta o el fiado al emitir (sin campos `undefined`: Firestore los rechaza)
        function invoiceCopy(model, company, client, stamp) {
            return {
                emittedAt: stamp, company, client, method: model.method, condition: model.condition, rate: model.rate, ivaIncluded: model.ivaIncluded,
                ...(model.methodRef ? { methodRef: model.methodRef } : {}), ...(model.cutAt ? { cutAt: model.cutAt } : {}),
                items: model.items.map(({ qty, name, price }) => ({ qty, name, price })),
                totalBs: model.total, bi: model.bi, iva: model.iva,
                bcvRate: model.bcvRate, equivUsd: model.equivUsd, paidBs: model.paidBs, note: model.note
            };
        }

        // Pura: HTML del documento (ticket de 300 px en Courier, como el diseño de siempre). Todo texto variable pasa por escapeHtml.
        function fiscalCanvasHtml(v) {
            const e = escapeHtml;
            const co = v.company || {}, cl = v.client || {};
            const d = new Date(v.date);
            const dateText = d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
            const timeText = d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
            const credit = v.condition === 'CRÉDITO';
            const rule = '<div class="border-b border-dashed border-gray-600 mb-2"></div>';
            const items = v.items.map(i => `<div class="flex justify-between mb-1"><span class="w-6">${e(i.qty)}</span><span class="flex-1">${e(i.name)}</span></div>
                <div class="text-right mb-2 pr-1">Bs ${fmtBs(i.bs)}</div>`).join('');
            return `<div class="text-center text-xs leading-tight mb-3">
                    <div class="font-bold text-sm">FACTURA</div>
                    <div>RIF ${e(co.rif)}</div>
                    <div class="uppercase">${e(co.name || 'EMPRESA')}</div>
                    <div class="uppercase">${e(co.address)}</div>
                    <div>ZONA POSTAL ${e(co.zip)}</div>
                </div>
                <div class="text-[10px] leading-tight mb-3 uppercase">
                    <div>R.I.F/C.I. : ${e(cl.rif || FISCAL_NO_ID)}</div>
                    <div>RAZON SOCIAL: ${e(cl.name || FISCAL_NO_NAME)}</div>
                    ${cl.address ? `<div>Dir: ${e(cl.address)}</div>` : ''}
                    ${cl.phone ? `<div>Tlf: ${e(cl.phone)}</div>` : ''}
                    ${v.methodRef ? `<div>Num Ref: ${e(v.methodRef)}</div>` : ''}
                </div>
                <div class="flex justify-between text-[10px] mb-2 uppercase font-bold"><div>FECHA: ${e(dateText)}</div><div>FACTURA: ${e(v.number)}</div></div>
                <div class="text-right text-[10px] mb-2 uppercase font-bold">HORA: ${e(timeText)}</div>
                ${rule}
                <div class="text-[10px] uppercase font-medium">${items}</div>
                ${rule}
                <div class="text-[11px] uppercase">
                    <div class="flex justify-between mb-1"><span>SUBTTL:</span><span class="font-bold">Bs ${fmtBs(v.bi)}</span></div>
                    <div class="flex justify-between text-[10px] mb-2 text-gray-700"><span>BI G16.00% Bs ${fmtBs(v.bi)}</span><span>IVA G16.00% Bs ${fmtBs(v.iva)}</span></div>
                    ${rule}
                    <div class="flex justify-between mb-2"><span>${e(v.methodText)}</span><span class="font-bold">Bs ${fmtBs(credit ? v.paidBs : v.total)}</span></div>
                    <div class="border-b border-gray-800 mb-1 border-2"></div>
                    <div class="flex justify-between text-sm font-black"><span>TOTAL</span><span>Bs ${fmtBs(v.total)}</span></div>
                    ${v.bcvRate ? `<p class="text-[9px] mt-2 text-gray-700">Tasa BCV: ${fmtBs(v.bcvRate)}${v.equivUsd ? ` · Equivale a $${fmtBs(v.equivUsd)}` : ''}</p>` : ''}
                    ${v.note ? `<p class="text-[9px] mt-2 text-gray-700">${e(v.note)}</p>` : ''}
                </div>`;
        }

        function invoiceRec(data) {
            const credit = data.isCredit ? state.credits.find(c => c.id == data.id) : null;
            return {
                kind: data.isCredit ? 'credit' : data.type === 'payment' ? 'payment' : 'sale',
                total: data.total, items: data.items, rate: data.rate, paid: data.paid, toBalance: data.toBalance,
                creditDate: credit ? credit.date : data.date, invoice: data.invoice
            };
        }

        // Documento que se está viendo: la factura principal o una de «lo agregado» de un fiado
        function fiscalDoc(data) {
            const credit = data.isCredit ? state.credits.find(c => c.id == data.id) : null;
            const ex = credit && fiscalSel > 0 ? (credit.extraInvoices || [])[fiscalSel - 1] : null;
            if (ex) return { rec: { ...invoiceRec(data), invoice: ex.invoice }, number: ex.fiscalNum, date: ex.numAt };
            // Fecha: la de cuando se asignó el número (en datos viejos con número, la de la venta)
            return {
                rec: invoiceRec(data),
                number: data.fiscalNum && !data.numPending ? data.fiscalNum : 'POR ASIGNAR',
                date: data.numAt || (data.fiscalNum ? data.date : new Date().toISOString())
            };
        }

        const fiscalTyped = id => $(id).value.trim();

        function fiscalView(data) {
            const d = fiscalDoc(data), cfg = state.fiscalConfig;
            return buildInvoiceView(d.rec, {
                ivaIncluded: cfg.ivaIncluded, bcvRate: fiscalCtx.bcvRate, fallbackRate: getActiveRate(), note: fiscalCtx.note,
                method: fiscalMethod, methodRef: fiscalTyped('fiscalPayRef'), number: d.number, date: d.date,
                company: { name: cfg.companyName, rif: cfg.rif, address: cfg.address, zip: cfg.zip },
                client: { rif: fiscalTyped('fiscalClientRif'), name: fiscalTyped('fiscalClientName'), address: fiscalTyped('fiscalClientAddress'), phone: fiscalTyped('fiscalClientPhone') }
            });
        }

        const FISCAL_LOCK_FIELDS = ['fiscalClientSearch', 'fiscalClientRif', 'fiscalClientPhone', 'fiscalClientName', 'fiscalClientAddress', 'fiscalPayRef'];

        async function prepareFiscalReceiptModal(data, sel = 0) {
            tempReceiptData = data;
            fiscalSel = sel;
            fiscalCtx = await invoiceRates(data);
            const credit = data.isCredit ? state.credits.find(c => c.id == data.id) : null;
            const doc = fiscalDoc(data);
            const inv = doc.rec.invoice;

            $('fiscalClientSearch').value = '';
            $('fiscalClientList').classList.add('hidden');
            if (inv) {
                fiscalClientId = null;
                $('fiscalClientRif').value = inv.client.rif;
                $('fiscalClientPhone').value = inv.client.phone;
                $('fiscalClientName').value = inv.client.name;
                $('fiscalClientAddress').value = inv.client.address;
                $('fiscalPayRef').value = inv.methodRef || '';
                fiscalMethod = payMethodKey(inv.method) || 'EFECTIVO';
            } else {
                $('fiscalPayRef').value = data.methodRef || '';
                fiscalMethod = payMethodKey(data.method) || 'EFECTIVO';
                if (getClient(data.clientId)) pickFiscalClient(data.clientId);
                else if (data.customer && data.customer.toLowerCase() !== 'cliente genérico') {
                    fiscalClientId = null;
                    $('fiscalClientRif').value = ''; $('fiscalClientPhone').value = ''; $('fiscalClientAddress').value = '';
                    $('fiscalClientName').value = data.customer;
                } else fillGenericClient();
            }
            FISCAL_LOCK_FIELDS.forEach(id => { $(id).disabled = !!inv; });
            $('fiscalFields').classList.toggle('hidden', !!inv); // emitida: los datos ya no se editan y se ven en la factura
            $('fiscalClientBtn').disabled = !!inv;
            $('fiscalPayChips').querySelectorAll('button').forEach(b => { b.disabled = !!inv; });
            $('fiscalPayRow').classList.toggle('hidden', !!(credit || data.isCredit));

            // Aviso de estado y botones
            let status = '';
            if (inv) {
                status = `Factura emitida el ${new Date(inv.emittedAt).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })}.`;
                if (creditHasUnbilled(credit)) status += ' Se agregaron productos después de la última factura.';
            } else if (data.numPending) status = 'Conéctate para asignar el número de esta factura.';
            else status = 'Sin emitir: se bloqueará al generar la imagen, el PDF o al compartir.' + (data.fiscalNum ? '' : ' Se asignará un número.');
            $('fiscalStatusNote').textContent = status;
            $('fiscalStatusNote').classList.toggle('hidden', !status);
            const blocked = !!data.numPending && !inv;
            $('fiscalActions').querySelectorAll('button').forEach(b => { b.disabled = blocked; b.classList.toggle('opacity-50', blocked); });

            renderFiscalTabs(credit);
            setFiscalMethod(fiscalMethod); // repinta la vista previa
            $('fiscalReceiptModal').classList.remove('hidden');
        }

        // Pura: ¿tiene el fiado facturado productos agregados después de su última factura?
        function creditHasUnbilled(credit) {
            if (!credit || !credit.invoice) return false;
            const extras = credit.extraInvoices || [];
            const from = extras.length ? extras[extras.length - 1].cutAt : (credit.invoice.cutAt || credit.date);
            return invoiceItems(credit.items, new Date().toISOString(), from).length > 0;
        }

        // Fiado ya facturado: botones para cambiar de factura y, si se agregaron productos, el de emitir la nueva
        function renderFiscalTabs(credit) {
            const box = $('fiscalDocTabs');
            const extras = credit ? credit.extraInvoices || [] : [];
            const canAdd = creditHasUnbilled(credit) && !!credit.fiscalNum;
            box.classList.toggle('hidden', !credit || !credit.invoice || (!extras.length && !canAdd));
            if (box.classList.contains('hidden')) return;
            const tab = (n, num) => `<button onclick="prepareFiscalReceiptModal(tempReceiptData, ${n})" class="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border ${fiscalSel === n ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-600'}">N° ${escapeHtml(num)}</button>`;
            box.innerHTML = tab(0, credit.fiscalNum) + extras.map((x, i) => tab(i + 1, x.fiscalNum)).join('') +
                (canAdd ? `<button onclick="startExtraInvoice()" class="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold bg-blue-50 border border-blue-200 text-blue-700"><i class="fa-solid fa-plus mr-1"></i>Emitir factura de lo agregado</button>` : '');
        }

        function updateFiscalPreview() {
            if (!tempReceiptData) return;
            $('fiscalCanvas').innerHTML = fiscalCanvasHtml(fiscalView(tempReceiptData));
        }

        // Reserva el siguiente número de la serie de ventas (transacción con sesión; sin sesión, el contador local). null si no hay conexión.
        async function reserveFiscalNumber() {
            const cfg = state.fiscalConfig, user = auth.currentUser;
            if (!user) { const n = cfg.currentNumber || 1; cfg.currentNumber = n + 1; return n; }
            if (!navigator.onLine) return null;
            const ref = db.collection('users').doc(user.uid).collection('counters').doc('fiscal');
            const n = await db.runTransaction(async tx => {
                const d = (await tx.get(ref)).data() || {};
                const s = fiscalStart(d.next || 1, null, cfg.currentNumber);
                tx.set(ref, { next: s + 1 }, { merge: true });
                return s;
            });
            cfg.currentNumber = Math.max(cfg.currentNumber || 1, n + 1);
            return n;
        }

        // Factura de lo agregado a un fiado ya facturado: número nuevo, fecha y tasa de hoy. false si no se pudo.
        async function emitExtraInvoice(credit) {
            const extras = credit.extraInvoices || [];
            const from = extras.length ? extras[extras.length - 1].cutAt : (credit.invoice.cutAt || credit.date);
            const to = new Date().toISOString();
            if (!invoiceItems(credit.items, to, from).length) { alert('No hay productos nuevos para facturar.'); return false; }
            if (!(currentBcvRate() > 0)) { alert('No hay tasa BCV del día para esta factura.'); return false; }
            let n;
            try { n = await reserveFiscalNumber(); } catch (e) { console.warn('No se pudo reservar el número:', e); n = null; }
            if (n === null) { alert('Conéctate para emitir esta factura: el número se asigna en línea.'); return false; }
            const cfg = state.fiscalConfig;
            const view = buildInvoiceView({ kind: 'credit', items: credit.items, creditDate: credit.date, cutFrom: from, cutTo: to }, {
                ivaIncluded: cfg.ivaIncluded, bcvRate: currentBcvRate(), note: '',
                company: { name: cfg.companyName, rif: cfg.rif, address: cfg.address, zip: cfg.zip }, client: credit.invoice.client
            });
            extras.push({ fiscalNum: String(n).padStart(6, '0'), numAt: to, cutAt: to, invoice: invoiceCopy(view, view.company, view.client, to) });
            credit.extraInvoices = extras;
            saveData();
            return true;
        }

        function startExtraInvoice() {
            const credit = state.credits.find(c => c.id == tempReceiptData.id);
            if (!credit) return;
            customConfirm('Factura de lo agregado', 'Se emitirá una factura nueva con los productos agregados desde la última factura. Recibirá el número siguiente, con la fecha y la tasa de hoy. ¿Continuar?', 'warning', async () => {
                if (await emitExtraInvoice(credit)) prepareFiscalReceiptModal(tempReceiptData, credit.extraInvoices.length);
            });
        }

        // Guarda la copia fija de la factura en la venta o el fiado (y le da número si es un dato viejo sin él). false si no se pudo.
        async function emitInvoice(data) {
            if (fiscalSel > 0) return true; // las facturas de «lo agregado» ya salen emitidas
            const rec = (data.isCredit ? state.credits : state.sales).find(x => x.id == data.id);
            if (!rec) { alert('No se encontró la operación de esta factura.'); return false; }
            if (rec.invoice) return true;
            if (!rec.fiscalNum) {
                rec.numPending = true;
                await assignPendingNumbers();
                if (!rec.fiscalNum) await assignPendingNumbers(); // había otra asignación en curso
                if (!rec.fiscalNum) {
                    delete rec.numPending;
                    alert('No se pudo asignar el número de la factura. Conéctate e inténtalo de nuevo.');
                    return false;
                }
            }
            syncReceiptRecord(data);
            const cfg = state.fiscalConfig;
            const typed = { rif: fiscalTyped('fiscalClientRif'), name: fiscalTyped('fiscalClientName'), address: fiscalTyped('fiscalClientAddress'), phone: fiscalTyped('fiscalClientPhone') };
            const client = { ...typed, rif: typed.rif || FISCAL_NO_ID, name: typed.name || FISCAL_NO_NAME };
            const m = fiscalView(data);
            rec.invoice = invoiceCopy(m, { name: cfg.companyName, rif: cfg.rif, address: cfg.address, zip: cfg.zip }, client, new Date().toISOString());
            saveClientFromInvoice(fiscalClientId, { doc: typed.rif, address: typed.address });
            saveData();
            syncReceiptRecord(data);
            await prepareFiscalReceiptModal(data); // se repinta desde la copia, con los campos bloqueados
            return true;
        }

        function selfTestFiscal() {
            const iso = n => `2026-10-${String(n).padStart(2, '0')}T12:00:00.000Z`;
            const ids = a => a.map(x => x.id).join();

            // Pendientes y plan de números
            const st = {
                sales: [
                    { id: 1, type: 'sale', date: iso(3), numPending: true },
                    { id: 2, type: 'payment', date: iso(2), numPending: true },
                    { id: 3, type: 'sale', date: iso(1), numPending: true },
                    { id: 4, type: 'sale', date: iso(4), fiscalNum: '000001' }
                ],
                credits: [{ id: 5, date: iso(2), numPending: true }, { id: 6, date: iso(5), fiscalNum: '000002' }]
            };
            const p = pendingDocs(st);
            console.assert(ids(p.sales) === '3,5,1' && ids(p.payments) === '2', 'selfTestFiscal: pendientes separados y por fecha');
            const plan = numberPlan(p.sales, 10);
            console.assert(plan.map(x => x.num).join() === '10,11,12' && ids(plan.map(x => x.ref)) === '3,5,1', 'selfTestFiscal: números consecutivos en orden de fecha');
            console.assert(fiscalStart(76, { next: 51, end: 75 }, 76) === 51, 'selfTestFiscal: recupera el bloque');
            console.assert(fiscalStart(101, { next: 51, end: 75 }, 76) === 101, 'selfTestFiscal: otro reservó después');
            console.assert(fiscalStart(30, null, 40) === 40 && fiscalStart(50, null, 40) === 50, 'selfTestFiscal: sin bloque');

            // Factura: venta en modo personalizado, copia fija, fiado
            const ctx = { ivaIncluded: true, bcvRate: 50, fallbackRate: 99, method: 'EFECTIVO', note: '' };
            const sale = { kind: 'sale', total: 10, items: [{ qty: 1, name: 'A', price: 10 }], rate: 60 };
            let m = buildInvoiceView(sale, ctx);
            console.assert(m.total === 600 && m.equivUsd === 12 && roundMoney(m.bi + m.iva) === m.total, 'selfTestFiscal: venta con tasa propia');
            const copy = invoiceCopy(m, {}, {}, iso(1));
            const again = buildInvoiceView({ ...sale, invoice: copy }, { ivaIncluded: false, bcvRate: 70, fallbackRate: 1, method: 'PAGO MOVIL', note: '' });
            console.assert(again.total === 600 && again.method === 'EFECTIVO' && again.rate === 60 && again.bi === m.bi, 'selfTestFiscal: la copia no cambia con otra tasa');
            m = buildInvoiceView({ ...sale, items: [{ qty: 1, name: 'A', price: 100 }] }, { ...ctx, ivaIncluded: false, bcvRate: 0 });
            console.assert(m.bi === 6000 && m.iva === 960 && m.total === 6960 && m.equivUsd === null, 'selfTestFiscal: IVA no incluido');
            const credit = { kind: 'credit', total: 15, rate: 60, paid: 0, creditDate: iso(1), items: [{ qty: 1, name: 'A', price: 10, at: iso(1) }, { qty: 1, name: 'B', price: 5, at: iso(9) }] };
            m = buildInvoiceView(credit, ctx);
            console.assert(m.total === 500 && m.condition === 'CRÉDITO' && m.items.length === 1, 'selfTestFiscal: fiado con tasa BCV y solo lo entregado ese día');

            // Tasa histórica del BCV
            const h = [{ fecha: '2026-10-30', dolar: 10 }, { fecha: '2026-11-02', dolar: 11 }];
            console.assert(bcvRateOn(h, '2026-10-31T15:00:00-04:00', 'dolar') === 10, 'selfTestFiscal: sábado usa el viernes');
            console.assert(bcvRateOn(h, '2026-11-02T09:00:00-04:00', 'dolar') === 11, 'selfTestFiscal: lunes');
            console.assert(bcvRateOn(h, '2026-10-30T23:30:00-04:00', 'dolar') === 10, 'selfTestFiscal: hora de Venezuela, no UTC');
            console.assert(bcvRateOn(h, '2026-10-01T12:00:00-04:00', 'dolar') === null && bcvRateOn([], iso(1), 'dolar') === null, 'selfTestFiscal: sin historial');

            // Un abono sin número va al recibo personalizado aunque el modo sea fiscal
            const bak = { t: state.receiptType, rif: state.fiscalConfig.rif };
            try {
                state.receiptType = 'FISCAL'; state.fiscalConfig.rif = 'J-1';
                console.assert(receiptTarget({ type: 'payment' }) === 'personalized', 'selfTestFiscal: abono nuevo al recibo personalizado');
                console.assert(receiptTarget({ type: 'payment', fiscalNum: '000001' }) === 'fiscal' && receiptTarget({ type: 'sale' }) === 'fiscal', 'selfTestFiscal: abono viejo y venta a la factura');
            } finally { state.receiptType = bak.t; state.fiscalConfig.rif = bak.rif; }
            console.log('selfTestFiscal terminado');
        }

        // Autoprueba de la factura (Fase 22): consola, datos ficticios
        function selfTestInvoice() {
            const iso = n => `2026-10-${String(n).padStart(2, '0')}T12:00:00.000Z`;
            const co = { name: 'Tienda Prueba', rif: 'J-1', address: 'Calle 1', zip: '1010' }, cl = { rif: 'V-1', name: 'Ana', address: '', phone: '' };
            const base = { company: co, client: cl, number: '000001', date: iso(1), note: '' };
            const sale = { kind: 'sale', total: 10, items: [{ qty: 1, name: 'A', price: 10 }], rate: 50 };
            [true, false].forEach(ivaIncluded => {
                const ctx = { ...base, ivaIncluded, bcvRate: 50, fallbackRate: 99, method: 'EFECTIVO' };
                const tag = ivaIncluded ? ' (IVA incluido)' : ' (IVA aparte)';
                let v = buildInvoiceView(sale, ctx);
                console.assert(v.items[0].bs === 500 && roundMoney(v.bi + v.iva) === v.total && v.total === (ivaIncluded ? 500 : 580), 'selfTestInvoice: contado BCV' + tag);
                console.assert(v.equivUsd === (ivaIncluded ? 10 : 11.6) && v.condition === 'CONTADO', 'selfTestInvoice: equivale a $' + tag);
                v = buildInvoiceView({ ...sale, rate: 60 }, ctx);
                console.assert(v.items[0].bs === 600 && v.equivUsd === (ivaIncluded ? 12 : 13.92), 'selfTestInvoice: tasa personalizada' + tag);
                v = buildInvoiceView({ ...sale, rate: 60 }, { ...ctx, method: 'DIVISAS' });
                console.assert(v.items[0].bs === 500 && v.rate === 50 && v.methodText === 'DIVISAS $' + fmtBs(ivaIncluded ? 10 : 11.6), 'selfTestInvoice: divisas' + tag);
                v = buildInvoiceView({ ...sale, invoice: invoiceCopy(v, co, cl, iso(1)) }, { ...ctx, bcvRate: 70, method: 'PUNTO' });
                console.assert(v.items[0].bs === 500 && v.rate === 50 && v.method === 'DIVISAS', 'selfTestInvoice: la copia emitida no cambia' + tag);
            });
            const ctx = { ...base, ivaIncluded: true, bcvRate: 50, fallbackRate: 99, method: 'PAGO MOVIL', methodRef: ' 12\n34 ' };
            let v = buildInvoiceView(sale, ctx);
            console.assert(v.methodText === 'Pago móvil' && v.method === 'PAGO_MOVIL' && v.methodRef === '12 34', 'selfTestInvoice: claves viejas y referencia limpia');
            console.assert(buildInvoiceView(sale, { ...ctx, method: 'EFECTIVO' }).methodRef === '' && payMethodLabel('PUNTO DE VENTA') === 'Punto de venta', 'selfTestInvoice: sin referencia en efectivo');
            console.assert(payFields({ method: 'TRANSFERENCIA', methodRef: 'x'.repeat(30) }).methodRef.length === 20 && !('method' in payFields({ method: 'CREDITO' })), 'selfTestInvoice: lo que se guarda');
            // Fiado y lo agregado
            const items = [{ qty: 1, name: 'A', price: 10, at: iso(1) }, { qty: 1, name: 'B', price: 5, at: iso(5) }, { qty: 1, name: 'C', price: 2, at: iso(8) }];
            const credit = { kind: 'credit', items, creditDate: iso(1), paid: 0 };
            v = buildInvoiceView(credit, ctx);
            console.assert(v.items.length === 1 && v.condition === 'CRÉDITO' && v.method === '' && v.methodText === 'Crédito', 'selfTestInvoice: fiado solo con lo entregado ese día');
            v = buildInvoiceView({ ...credit, cutFrom: iso(1), cutTo: iso(6) }, ctx);
            console.assert(v.items.map(i => i.name).join() === 'B' && v.cutAt === iso(6), 'selfTestInvoice: lo agregado entre cortes');
            v = buildInvoiceView({ ...credit, cutFrom: iso(6), cutTo: iso(9) }, ctx);
            console.assert(v.items.map(i => i.name).join() === 'C', 'selfTestInvoice: la siguiente factura sigue del corte anterior');
            // Texto del usuario escapado
            const html = fiscalCanvasHtml({ ...buildInvoiceView(sale, ctx), client: { ...cl, name: '<b>x</b>' } });
            console.assert(!html.includes('<b>') && html.includes('&lt;b&gt;x'), 'selfTestInvoice: el nombre del cliente va escapado');
            console.log('selfTestInvoice terminado');
        }

        // Funciones de descarga para Fiscal
        async function generateFiscalImage(btn) {
            const node = document.getElementById('fiscalCanvas');
            const options = { backgroundColor: '#ffffff', pixelRatio: 3, width: node.scrollWidth, height: node.scrollHeight };
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
            btn.disabled = true;
            try {
                const dataUrl = await htmlToImage.toPng(node, options);
                btn.innerHTML = originalText; btn.disabled = false;
                return dataUrl;
            } catch (error) {
                alert('Error generando la imagen.');
                btn.innerHTML = originalText; btn.disabled = false; throw error;
            }
        }

        async function downloadFiscalReceipt(type) {
            const btn = event.currentTarget; // se lee antes de esperar: después `event` ya no existe
            try {
                if (!(await emitInvoice(tempReceiptData))) return;
                const imgData = await generateFiscalImage(btn);
                const fileName = `factura_${fiscalDoc(tempReceiptData).number}`;
                if (type === 'img') {
                    const link = document.createElement('a'); link.download = `${fileName}.png`; link.href = imgData; link.click();
                } else {
                    const { jsPDF } = window.jspdf;
                    const imgProps = new Image(); imgProps.src = imgData;
                    await new Promise(resolve => imgProps.onload = resolve);
                    const pdfWidth = 80; const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, pdfHeight] });
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
                    pdf.save(`${fileName}.pdf`);
                }
            } catch (e) { console.error(e); }
        }

        async function shareFiscalReceipt() {
            const btn = event.currentTarget, original = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>...';
            try {
                if (!(await emitInvoice(tempReceiptData))) return;
                const imgData = await generateFiscalImage(btn);
                const num = fiscalDoc(tempReceiptData).number;
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (isMobile && navigator.share) {
                    const blob = await (await fetch(imgData)).blob();
                    const file = new File([blob], "factura.png", { type: "image/png" });
                    await navigator.share({ files: [file], title: 'Factura', text: `Factura ${num}` });
                } else {
                    const link = document.createElement('a'); link.download = `factura_para_enviar.png`; link.href = imgData; link.click();
                    alert('Imagen descargada. Se abrirá WhatsApp para que la adjuntes.');
                    window.open(`https://wa.me/?text=Factura%20${num}`, '_blank');
                }
            } catch (e) { console.error(e); } finally { btn.innerHTML = original; }
        }

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

        function fillGenericClient() {
            $('fiscalClientRif').value = 'J-00000000';
            $('fiscalClientName').value = 'CLIENTE GENERICO';
            $('fiscalClientAddress').value = 'GENERICO';
            $('fiscalClientPhone').value = '0000-0000000';
            updateFiscalPreview();
        }

        function closeFiscalReceiptModal() {
            $('fiscalReceiptModal').classList.add('hidden');
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

        // Pura: lo entregado el día del fiado (los productos agregados después no entran)
        function invoiceItems(items, creditDate) {
            return (items || []).filter(i => !i.at || i.at <= creditDate);
        }

        const fmtBs = n => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Pura: todo lo que muestra la factura. rec = { kind: 'sale'|'credit'|'payment', total, items, rate, paid, toBalance, creditDate, invoice }
        // ctx = { ivaIncluded, bcvRate, fallbackRate, method, note }. Con rec.invoice (copia fija) todo sale de ahí.
        function invoiceModel(rec, ctx) {
            const inv = rec.invoice;
            const ivaIncluded = inv ? inv.ivaIncluded : ctx.ivaIncluded;
            const rate = inv ? inv.rate : rec.kind === 'credit' ? (ctx.bcvRate || 0) : (rec.rate > 0 ? rec.rate : ctx.fallbackRate);
            const base = inv ? inv.items
                : rec.kind === 'payment' ? [{ qty: 1, name: 'ABONO A CUENTA', price: rec.total }]
                : rec.kind === 'credit' ? invoiceItems(rec.items, rec.creditDate)
                : (rec.items || []);
            const items = base.map(i => ({ qty: i.qty, name: i.name, price: i.price, bs: roundMoney(i.qty * i.price * rate) }));
            const sum = roundMoney(items.reduce((t, i) => t + i.bs, 0));
            let bi, iva, total;
            if (inv) { bi = inv.bi; iva = inv.iva; total = inv.totalBs; }
            else if (ivaIncluded) { total = sum; bi = roundMoney(sum / 1.16); iva = roundMoney(total - bi); }
            else { bi = sum; iva = roundMoney(sum * 0.16); total = roundMoney(bi + iva); }
            const bcv = inv ? inv.bcvRate : ctx.bcvRate;
            return {
                items, rate, ivaIncluded, bi, iva, total,
                bcvRate: bcv > 0 ? bcv : null,
                equivUsd: inv ? inv.equivUsd : (rec.kind === 'sale' && bcv > 0 ? roundMoney(total / bcv) : null),
                method: inv ? inv.method : rec.kind === 'credit' ? 'CREDITO' : ctx.method,
                paidBs: inv ? inv.paidBs : roundMoney((rec.paid || 0) * rate),
                note: inv ? inv.note : [rec.toBalance > 0 ? `Esta factura incluye Bs ${fmtBs(roundMoney(rec.toBalance * rate))} de saldo a favor del cliente.` : '', ctx.note].filter(Boolean).join(' ')
            };
        }

        // Pura: la copia fija que se guarda en la venta o el fiado al emitir
        function invoiceCopy(model, company, client, stamp) {
            return {
                emittedAt: stamp, company, client, method: model.method, rate: model.rate, ivaIncluded: model.ivaIncluded,
                items: model.items.map(({ qty, name, price }) => ({ qty, name, price })),
                totalBs: model.total, bi: model.bi, iva: model.iva,
                bcvRate: model.bcvRate, equivUsd: model.equivUsd, paidBs: model.paidBs, note: model.note
            };
        }

        function invoiceRec(data) {
            const credit = data.isCredit ? state.credits.find(c => c.id == data.id) : null;
            return {
                kind: data.isCredit ? 'credit' : data.type === 'payment' ? 'payment' : 'sale',
                total: data.total, items: data.items, rate: data.rate, paid: data.paid, toBalance: data.toBalance,
                creditDate: credit ? credit.date : data.date, invoice: data.invoice
            };
        }

        function fiscalModelCtx() {
            return { ivaIncluded: state.fiscalConfig.ivaIncluded, bcvRate: fiscalCtx.bcvRate, fallbackRate: getActiveRate(), method: $('fiscalPaymentMethod').value, note: fiscalCtx.note };
        }

        const FISCAL_CLIENT_FIELDS = ['fiscalClientRif', 'fiscalClientPhone', 'fiscalClientName', 'fiscalClientAddress', 'fiscalPaymentMethod'];

        async function prepareFiscalReceiptModal(data) {
            tempReceiptData = data;
            const inv = data.invoice;
            fiscalCtx = await invoiceRates(data);

            // Datos de la empresa (en una factura emitida, los de ese momento)
            const co = inv ? inv.company : { name: state.fiscalConfig.companyName, rif: state.fiscalConfig.rif, address: state.fiscalConfig.address, zip: state.fiscalConfig.zip };
            $('printFiscRif').textContent = co.rif;
            $('printFiscCompany').textContent = co.name || 'EMPRESA';
            $('printFiscAddress').textContent = co.address;
            $('printFiscZip').textContent = co.zip;

            if (inv) {
                $('fiscalClientRif').value = inv.client.rif;
                $('fiscalClientPhone').value = inv.client.phone;
                $('fiscalClientName').value = inv.client.name;
                $('fiscalClientAddress').value = inv.client.address;
                $('fiscalPaymentMethod').value = inv.method;
            } else {
                if (data.customer && data.customer.toLowerCase() !== 'cliente genérico') {
                    $('fiscalClientName').value = data.customer;
                } else {
                    fillGenericClient();
                }
                $('fiscalPaymentMethod').value = data.isCredit ? 'CREDITO' : 'EFECTIVO';
            }
            FISCAL_CLIENT_FIELDS.forEach(id => { $(id).disabled = !!inv; });

            // Aviso de estado y botones
            let status = '';
            if (inv) {
                status = `Factura emitida el ${new Date(inv.emittedAt).toLocaleDateString('es-VE').replace(/\//g, '-')}.`;
                const credit = data.isCredit && state.credits.find(c => c.id == data.id);
                if (credit && invoiceItems(credit.items, credit.date).length < credit.items.length) status += ' Se agregaron productos después de esta factura.';
            } else if (data.numPending) status = 'Conéctate para asignar el número de esta factura.';
            else if (!data.fiscalNum) status = 'Se asignará un número al emitir.';
            $('fiscalStatusNote').textContent = status;
            $('fiscalStatusNote').classList.toggle('hidden', !status);
            const blocked = !!data.numPending && !inv;
            $('fiscalActions').querySelectorAll('button').forEach(b => { b.disabled = blocked; b.classList.toggle('opacity-50', blocked); });

            updateFiscalPreview();
            $('fiscalReceiptModal').classList.remove('hidden');
        }

        function updateFiscalPreview() {
            const data = tempReceiptData;
            if (!data) return;

            const m = invoiceModel(invoiceRec(data), fiscalModelCtx());

            // Actualizar inputs de cliente en el ticket
            $('printFiscCliRif').textContent = $('fiscalClientRif').value || 'J-00000000';
            $('printFiscCliName').textContent = $('fiscalClientName').value || 'CLIENTE GENERICO';
            $('printFiscCliAddress').textContent = $('fiscalClientAddress').value || 'GENERICO';
            $('printFiscCliPhone').textContent = $('fiscalClientPhone').value || '0000-0000000';

            // Meta: la fecha es la de cuando se asignó el número (en datos viejos con número, la de la venta)
            const d = new Date(data.numAt || (data.fiscalNum ? data.date : new Date().toISOString()));
            $('printFiscDate').textContent = d.toLocaleDateString('es-VE').replace(/\//g, '-');
            $('printFiscTime').textContent = d.toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit'});
            $('printFiscNum').textContent = data.fiscalNum && !data.numPending ? data.fiscalNum : 'POR ASIGNAR';

            // Items (Renderizados en Bolívares)
            $('printFiscItems').innerHTML = m.items.map(item => `
                        <div class="flex justify-between mb-1">
                            <span class="w-6">${escapeHtml(item.qty)}</span>
                            <span class="flex-1">${escapeHtml(item.name)}</span>
                        </div>
                        <div class="text-right mb-2 pr-1">Bs ${fmtBs(item.bs)}</div>`).join('');

            $('printFiscNote').classList.toggle('hidden', !m.note);
            $('printFiscNote').textContent = m.note;
            $('printFiscRateLine').classList.toggle('hidden', !m.bcvRate);
            $('printFiscRateLine').textContent = m.bcvRate ? `Tasa BCV: ${fmtBs(m.bcvRate)}` + (m.equivUsd ? ` · Equivale a $${fmtBs(m.equivUsd)}` : '') : '';

            $('printFiscSubtotal').textContent = `Bs ${fmtBs(m.bi)}`;
            $('printFiscBI').textContent = `Bs ${fmtBs(m.bi)}`;
            $('printFiscIVA').textContent = `Bs ${fmtBs(m.iva)}`;
            $('printFiscTotal').textContent = `Bs ${fmtBs(m.total)}`;

            // Pago: si es crédito, lo abonado
            $('printFiscPaymentMethod').textContent = m.method;
            $('printFiscPaymentAmount').textContent = `Bs ${fmtBs(m.method === 'CREDITO' ? m.paidBs : m.total)}`;
        }

        // Guarda la copia fija de la factura en la venta o el fiado (y le da número si es un dato viejo sin él). false si no se pudo.
        async function emitInvoice(data) {
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
            const client = {
                rif: $('fiscalClientRif').value || 'J-00000000', name: $('fiscalClientName').value || 'CLIENTE GENERICO',
                address: $('fiscalClientAddress').value || 'GENERICO', phone: $('fiscalClientPhone').value || '0000-0000000'
            };
            const m = invoiceModel(invoiceRec(data), fiscalModelCtx());
            rec.invoice = invoiceCopy(m, { name: cfg.companyName, rif: cfg.rif, address: cfg.address, zip: cfg.zip }, client, new Date().toISOString());
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
            let m = invoiceModel(sale, ctx);
            console.assert(m.total === 600 && m.equivUsd === 12 && roundMoney(m.bi + m.iva) === m.total, 'selfTestFiscal: venta con tasa propia');
            const copy = invoiceCopy(m, {}, {}, iso(1));
            const again = invoiceModel({ ...sale, invoice: copy }, { ivaIncluded: false, bcvRate: 70, fallbackRate: 1, method: 'PAGO MOVIL', note: '' });
            console.assert(again.total === 600 && again.method === 'EFECTIVO' && again.rate === 60 && again.bi === m.bi, 'selfTestFiscal: la copia no cambia con otra tasa');
            m = invoiceModel({ ...sale, items: [{ qty: 1, name: 'A', price: 100 }] }, { ...ctx, ivaIncluded: false, bcvRate: 0 });
            console.assert(m.bi === 6000 && m.iva === 960 && m.total === 6960 && m.equivUsd === null, 'selfTestFiscal: IVA no incluido');
            const credit = { kind: 'credit', total: 15, rate: 60, paid: 0, creditDate: iso(1), items: [{ qty: 1, name: 'A', price: 10, at: iso(1) }, { qty: 1, name: 'B', price: 5, at: iso(9) }] };
            m = invoiceModel(credit, ctx);
            console.assert(m.total === 500 && m.method === 'CREDITO' && m.items.length === 1, 'selfTestFiscal: fiado con tasa BCV y solo lo entregado ese día');

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
                const fileName = `factura_${tempReceiptData.fiscalNum}`;
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
            const btn = event.currentTarget; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>...';
            try {
                if (!(await emitInvoice(tempReceiptData))) return;
                const imgData = await generateFiscalImage(btn);
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (isMobile && navigator.share) {
                    const blob = await (await fetch(imgData)).blob();
                    const file = new File([blob], "factura.png", { type: "image/png" });
                    await navigator.share({ files: [file], title: 'Factura', text: `Factura ${tempReceiptData.fiscalNum}` });
                } else {
                    const link = document.createElement('a'); link.download = `factura_para_enviar.png`; link.href = imgData; link.click();
                    alert('Imagen descargada. Se abrirá WhatsApp para que la adjuntes.');
                    window.open(`https://wa.me/?text=Factura%20${tempReceiptData.fiscalNum}`, '_blank');
                }
            } catch (e) { console.error(e); } finally { btn.innerHTML = '<i class="fa-brands fa-whatsapp text-xl mr-2"></i> Compartir documento'; }
        }

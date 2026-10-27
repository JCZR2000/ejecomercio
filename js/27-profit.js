        // ==========================================
        // 27. GANANCIAS Y COSTOS (Fase 14)
        // Ganancia = vendido - costo de lo vendido. Sin gastos ni compras.
        // El fiado cuenta el día que se hizo; recargos e isStub no entran.
        // ==========================================
        const PROFIT_ARCHIVE_MONTHS = 24;

        const profitMonthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        // Importe y costo de una línea. cost: item.cost -> costo actual (est) -> null (sin costo)
        function profitLine(item, products) {
            const amount = roundMoney(item.subtotal ?? (item.price * item.qty));
            if (item.cost > 0) return { amount, cost: roundMoney(item.cost * item.qty), est: false };
            const p = products.find(x => x.id == item.id);
            if (p && p.cost > 0) return { amount, cost: roundMoney(p.cost * item.qty), est: true };
            return { amount, cost: null, est: false };
        }

        // Todas las líneas que son venta: [{ item, date }] (contado + fiados, sin isStub ni abonos)
        function profitLines(sales, credits) {
            const out = [];
            sales.forEach(s => { if (s.type !== 'payment') (s.items || []).forEach(it => { if (!it.isStub) out.push({ item: it, date: new Date(s.date) }); }); });
            credits.forEach(c => (c.items || []).forEach(it => { if (!it.isStub) out.push({ item: it, date: new Date(it.at || c.date) }); }));
            return out;
        }

        function computeProfit({ sales, credits, archive, products, from, to }) {
            const r = { sold: 0, soldWithCost: 0, cost: 0, profit: 0, margin: 0, est: 0, noCost: 0, collected: 0, byProduct: {} };
            profitLines(sales, credits).forEach(({ item, date }) => {
                if (!(date >= from && date < to)) return;
                const l = profitLine(item, products);
                r.sold += l.amount;
                const bp = r.byProduct[item.id] || (r.byProduct[item.id] = { name: item.name, qty: 0, sold: 0, profit: 0 });
                bp.qty += item.qty; bp.sold += l.amount;
                if (l.cost === null) { r.noCost += l.amount; return; }
                r.soldWithCost += l.amount; r.cost += l.cost; bp.profit += l.amount - l.cost;
                if (l.est) r.est += l.amount;
            });
            // Meses del archivo que caen enteros dentro del rango
            Object.entries(archive || {}).forEach(([key, m]) => {
                const [y, mo] = key.split('-').map(Number);
                if (new Date(y, mo - 1, 1) >= from && new Date(y, mo, 1) <= to) {
                    r.sold += m.sold + m.noCost; r.soldWithCost += m.sold; r.cost += m.cost; r.est += m.est; r.noCost += m.noCost;
                }
            });
            sales.forEach(s => { const d = new Date(s.date); if (d >= from && d < to) r.collected += s.total; });
            ['sold', 'soldWithCost', 'cost', 'est', 'noCost', 'collected'].forEach(k => r[k] = roundMoney(r[k]));
            Object.values(r.byProduct).forEach(b => { b.sold = roundMoney(b.sold); b.profit = roundMoney(b.profit); });
            r.profit = roundMoney(r.soldWithCost - r.cost);
            r.margin = r.soldWithCost > 0 ? r.profit / r.soldWithCost : 0;
            return r;
        }

        // Antes de que autoPruneCredits borre un fiado pagado, su resumen pasa al mes que toca
        function archiveCredit(credit) {
            const arch = state.profitArchive;
            (credit.items || []).forEach(it => {
                if (it.isStub) return;
                const d = new Date(it.at || credit.date);
                if (isNaN(d)) return;
                const l = profitLine(it, state.products);
                const m = arch[profitMonthKey(d)] || (arch[profitMonthKey(d)] = { sold: 0, cost: 0, est: 0, noCost: 0 });
                if (l.cost === null) { m.noCost = roundMoney(m.noCost + l.amount); return; }
                m.sold = roundMoney(m.sold + l.amount); m.cost = roundMoney(m.cost + l.cost);
                if (l.est) m.est = roundMoney(m.est + l.amount);
            });
            Object.keys(arch).sort().slice(0, -PROFIT_ARCHIVE_MONTHS).forEach(k => delete arch[k]);
        }

        // ---------- Rangos y panel ----------
        let profitPeriod = 'month';
        function profitRange(p) {
            const n = new Date(), day = new Date(n.getFullYear(), n.getMonth(), n.getDate());
            const mo = (k) => new Date(n.getFullYear(), n.getMonth() + k, 1);
            if (p === 'today') return { from: day, to: new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1) };
            if (p === 'last') return { from: mo(-1), to: mo(0) };
            if (p === '12m') return { from: mo(-11), to: mo(1) };
            return { from: mo(0), to: mo(1) };
        }

        function showDashTab(tab) {
            const isProfit = tab === 'profit';
            $('dashSales').classList.toggle('hidden', isProfit);
            $('dashProfit').classList.toggle('hidden', !isProfit);
            $('tabDashSales').className = `flex-1 py-2 text-xs font-bold rounded transition ${isProfit ? 'text-gray-500 hover:bg-gray-200' : 'shadow bg-white text-indigo-600'}`;
            $('tabDashProfit').className = `flex-1 py-2 text-xs font-bold rounded transition ${isProfit ? 'shadow bg-white text-indigo-600' : 'text-gray-500 hover:bg-gray-200'}`;
            if (isProfit) renderProfit();
        }
        function openProfitTab() { checkAuth('profit', () => showDashTab('profit')); }

        function setProfitPeriod(p) { profitPeriod = p; renderProfit(); }

        function renderProfit() {
            const money = (v) => formatMoney(v);
            ['today', 'month', 'last', '12m'].forEach(p => {
                $('profPer_' + p).className = `flex-1 py-1 text-[11px] font-bold rounded transition ${p === profitPeriod ? 'shadow bg-white text-indigo-600' : 'text-gray-500 hover:bg-gray-200'}`;
            });
            const { from, to } = profitRange(profitPeriod);
            const r = computeProfit({ sales: state.sales, credits: state.credits, archive: state.profitArchive, products: state.products, from, to });
            const pending = roundMoney(state.credits.reduce((a, c) => a + Math.max(0, creditPending(c)), 0));
            const pc = r.profit < 0 ? 'text-red-600' : 'text-green-600';
            const card = (label, value, cls = 'text-gray-800') => `<div class="bg-gray-50 border rounded-lg p-2"><p class="text-[10px] text-gray-500 font-bold uppercase">${label}</p><p class="font-bold text-sm ${cls}">${value}</p></div>`;
            let h = `<div class="grid grid-cols-2 gap-2">
                ${card('Vendido', money(r.sold))}
                ${card('Costo de lo vendido', money(r.cost))}
                <div class="bg-gray-50 border rounded-lg p-2 col-span-2"><p class="text-[10px] text-gray-500 font-bold uppercase">Ganancia</p><p class="font-bold text-xl ${pc}">${money(r.profit)} <span class="text-xs">(${(r.margin * 100).toFixed(1)} % de margen)</span></p></div>
                ${card('Cobrado', money(r.collected))}
                ${card('Por cobrar (hoy, no del periodo)', money(pending), 'text-orange-600')}
            </div>`;
            if (r.est > 0) h += `<p class="text-[11px] text-gray-500">Incluye ${money(r.est)} estimado con el costo actual.</p>`;
            if (r.noCost > 0) h += `<p class="text-[11px] text-orange-600 font-bold">${money(r.noCost)} vendido sin costo. <button onclick="openCosts()" class="underline">Completa los costos</button></p>`;

            // Dinero en mercancía (no depende del periodo)
            const withCost = state.products.filter(p => p.cost > 0 && p.qty > 0);
            const atCost = roundMoney(withCost.reduce((a, p) => a + p.qty * p.cost, 0));
            const atPrice = roundMoney(withCost.reduce((a, p) => a + p.qty * p.price, 0));
            const noCostN = state.products.filter(p => !(p.cost > 0) && p.qty > 0).length;
            h += `<div class="border rounded-lg p-3 bg-indigo-50"><p class="text-[10px] text-indigo-700 font-bold uppercase">Dinero en mercancía</p>
                <p class="text-sm text-gray-800">A costo: <b>${money(atCost)}</b> · A precio de venta: <b>${money(atPrice)}</b></p>
                <p class="text-xs text-gray-600">Ganancia posible: <b>${money(roundMoney(atPrice - atCost))}</b>${noCostN ? ` · ${noCostN} producto(s) sin costo` : ''}</p></div>`;

            // Listas cortas
            const list = (title, rows, empty) => `<div><p class="text-xs font-bold text-gray-700 mb-1">${title}</p>${rows.length ? rows.join('') : `<p class="text-xs text-gray-400">${empty}</p>`}</div>`;
            const row = (name, val, cls = 'text-gray-700') => `<div class="flex justify-between text-xs py-0.5 border-b"><span class="truncate pr-2">${escapeHtml(name)}</span><span class="font-bold shrink-0 ${cls}">${val}</span></div>`;
            const prods = Object.values(r.byProduct);
            h += list('Los que más ganancia dejan', prods.filter(b => b.profit > 0).sort((a, b) => b.profit - a.profit).slice(0, 5).map(b => row(b.name, money(b.profit), 'text-green-600')), 'Sin datos en este periodo.');
            h += list('Vendidos por debajo del costo', prods.filter(b => b.profit < 0).sort((a, b) => a.profit - b.profit).slice(0, 5).map(b => row(b.name, money(b.profit), 'text-red-600')), 'Ninguno.');
            const since = new Date(Date.now() - 30 * 86400000), sold30 = new Set();
            profitLines(state.sales, state.credits).forEach(({ item, date }) => { if (date >= since) sold30.add(String(item.id)); });
            const idle = state.products.filter(p => p.qty > 0 && !sold30.has(String(p.id)))
                .sort((a, b) => (b.qty * (b.cost || 0)) - (a.qty * (a.cost || 0))).slice(0, 5);
            h += list('Sin ventas en 30 días', idle.map(p => row(p.name, p.cost > 0 ? money(roundMoney(p.qty * p.cost)) : `${p.qty} u.`)), 'Todo se movió.');
            $('profitBody').innerHTML = h;
        }

        // ---------- Lista de Costos ----------
        function openCosts() { $('costsModal').classList.remove('hidden'); renderCosts(); }
        function closeCosts() { $('costsModal').classList.add('hidden'); }

        function renderCosts() {
            const q = norm($('costsSearch').value || ''), onlyMissing = $('costsOnlyMissing').checked;
            const rows = state.products.filter(p => (!onlyMissing || !(p.cost > 0)) && (!q || norm(p.name).includes(q) || norm(p.barcode || '').includes(q)));
            $('costsList').innerHTML = rows.map(p => `<div class="flex items-center gap-2 py-2 border-b">
                <div class="flex-1 min-w-0"><p class="text-sm font-bold truncate">${escapeHtml(p.name)}</p><p class="text-[11px] text-gray-500">Precio ${formatMoney(p.price)} · <span data-margin="${escapeHtml(String(p.id))}">${costMarginText(p.cost, p.price)}</span></p></div>
                <input type="number" step="0.01" min="0" inputmode="decimal" placeholder="Costo" value="${p.cost > 0 ? p.cost : ''}" data-cost="${escapeHtml(String(p.id))}" class="w-24 h-10 rounded-lg border border-gray-300 px-2 text-sm text-right"></div>`).join('') || '<p class="text-sm text-gray-400 py-4 text-center">Sin productos.</p>';
        }
        const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

        function costMarginText(cost, price) {
            if (!(cost > 0)) return 'sin costo';
            if (cost > price) return '⚠️ costo mayor que el precio';
            return `margen ${(((price - cost) / price) * 100).toFixed(0)} %`;
        }

        function saveCostInput(input) {
            const p = state.products.find(x => String(x.id) === input.dataset.cost);
            if (!p) return;
            const v = input.value.trim();
            if (v === '') { delete p.cost; }
            else {
                const n = parseFloat(v);
                if (!(n > 0)) { input.value = p.cost > 0 ? p.cost : ''; return; } // inválido: no cambia
                p.cost = roundMoney(n);
            }
            saveData();
            const span = document.querySelector(`[data-margin="${CSS.escape(String(p.id))}"]`);
            if (span) span.textContent = costMarginText(p.cost, p.price);
            renderProfit();
        }

        function initCostsUI() {
            const list = $('costsList');
            if (!list) return;
            list.addEventListener('change', e => { if (e.target.dataset.cost !== undefined) saveCostInput(e.target); });
            list.addEventListener('input', e => {
                if (e.target.dataset.cost === undefined) return;
                const p = state.products.find(x => String(x.id) === e.target.dataset.cost);
                const span = p && document.querySelector(`[data-margin="${CSS.escape(String(p.id))}"]`);
                if (span) span.textContent = costMarginText(parseFloat(e.target.value), p.price);
            });
        }
        document.addEventListener('DOMContentLoaded', initCostsUI);

        // ---------- Autoprueba (datos ficticios, sin saveData). Ejecutar en consola: selfTestProfit() ----------
        function selfTestProfit() {
            let fails = 0;
            const t = (cond, msg) => { console.assert(cond, msg); if (!cond) { fails++; console.error('FALLA: ' + msg); } };
            const bak = structuredClone({ products: state.products, profitArchive: state.profitArchive });
            try {
                const day = new Date(2026, 5, 10, 12), from = new Date(2026, 5, 10), to = new Date(2026, 5, 11);
                const yest = new Date(2026, 5, 9, 12);
                const prods = [{ id: 1, name: 'A', qty: 5, price: 3, cost: 2 }, { id: 2, name: 'B', qty: 5, price: 3, cost: 1 }, { id: 3, name: 'C', qty: 5, price: 3 }];
                const sale = (d, items, type = 'sale', total) => ({ id: 1, date: d.toISOString(), type, items, total: total ?? items.reduce((a, i) => a + i.subtotal, 0) });
                const run = (sales, credits = [], archive = {}, f = from, tt = to) => computeProfit({ sales, credits, archive, products: prods, from: f, to: tt });
                // Contado con costo
                let r = run([sale(day, [{ id: 1, name: 'A', price: 3, qty: 2, subtotal: 6, cost: 2 }])]);
                t(r.sold === 6 && r.cost === 4 && r.profit === 2 && Math.abs(r.margin - 1 / 3) < 1e-9, 'contado: vendido 6, costo 4, ganancia 2, margen 33,3 %');
                // Sin cost en la línea, producto con costo actual -> estimado
                r = run([sale(day, [{ id: 2, name: 'B', price: 3, qty: 1, subtotal: 3 }])]);
                t(r.est === 3 && r.cost === 1 && r.profit === 2, 'sin cost en la línea: estimado con el costo actual');
                // Sin costo en ningún lado -> noCost
                r = run([sale(day, [{ id: 3, name: 'C', price: 3, qty: 1, subtotal: 3 }])]);
                t(r.noCost === 3 && r.profit === 0 && r.soldWithCost === 0, 'sin costo: va a noCost y no a la ganancia');
                // isStub no cuenta
                r = run([sale(day, [{ id: 's', name: 'Cuaderno', price: 9, qty: 1, subtotal: 9, isStub: true }])]);
                t(r.sold === 0 && r.noCost === 0, 'isStub no cuenta');
                // Línea fiada hoy dentro de un fiado de ayer: cuenta hoy, no ayer
                const cr = { id: 9, customer: 'X', date: yest.toISOString(), totalDebt: 9, paid: 0, items: [
                    { id: 1, name: 'A', price: 3, qty: 1, subtotal: 3, cost: 2 },
                    { id: 1, name: 'A', price: 3, qty: 2, subtotal: 6, cost: 2, at: day.toISOString() }] };
                t(run([], [cr]).sold === 6, 'fiado: la línea con at de hoy cuenta hoy');
                t(run([], [cr], {}, new Date(2026, 5, 9), from).sold === 3, 'fiado: la línea vieja cuenta en la fecha del fiado');
                // Abono: cobrado, no vendido
                r = run([sale(day, null, 'payment', 5)]);
                t(r.collected === 5 && r.sold === 0, 'abono: cuenta en cobrado, no en vendido');
                // Archivo: se suma si el mes cabe entero, recorte a 24 meses
                state.products = prods; state.profitArchive = {};
                archiveCredit(cr);
                t(state.profitArchive['2026-06'] && state.profitArchive['2026-06'].sold === 9 && state.profitArchive['2026-06'].cost === 6, 'archiveCredit suma al mes');
                r = run([], [], state.profitArchive, new Date(2026, 5, 1), new Date(2026, 6, 1));
                t(r.sold === 9 && r.profit === 3, 'mes completo en el rango suma el archivo');
                t(run([], [], state.profitArchive, from, to).sold === 0, 'mes parcial no suma el archivo');
                state.profitArchive = {};
                for (let y = 0; y < 26; y++) state.profitArchive[profitMonthKey(new Date(2020, y, 1))] = { sold: 1, cost: 0, est: 0, noCost: 0 };
                archiveCredit(cr);
                t(Object.keys(state.profitArchive).length === PROFIT_ARCHIVE_MONTHS && !state.profitArchive['2020-01'], 'recorte a 24 meses');
                // Por debajo del costo
                r = run([sale(day, [{ id: 1, name: 'A', price: 1, qty: 1, subtotal: 1, cost: 2 }])]);
                t(r.profit < 0 && r.byProduct[1].profit < 0, 'venta bajo el costo: ganancia negativa');
            } finally {
                state.products = bak.products; state.profitArchive = bak.profitArchive;
            }
            console.log(fails ? `selfTestProfit: ${fails} fallas` : 'selfTestProfit: OK');
            return fails;
        }

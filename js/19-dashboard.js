        // ==========================================
        // 20. MONITOR DE ALMACENAMIENTO (v42)
        // ==========================================
        let storageWarned = false; // el aviso del 80 % sale una vez por sesión
        function updateStorageUsage() {
            // 1. Mismas partes que sube saveData; el cifrado agrega ~33 %
            const { main, chunks } = buildCloudParts();
            const factor = encryptionKey ? 1.34 : 1;
            const mainBytes = new Blob([JSON.stringify(main)]).size * factor;
            const chunkBytes = Object.values(chunks).map(c => c.json.length * factor);

            // 2. La barra mide el documento más grande frente al límite de Firestore por documento (1 MiB)
            const bytes = Math.max(mainBytes, ...chunkBytes);
            const limit = 1048576;
            const percentage = Math.min(((bytes / limit) * 100), 100).toFixed(1);
            const toKb = n => (n / 1024).toFixed(0);

            // 4. Actualizamos UI
            const bar = $('storageBar');
            const text = $('storageText');
            
            bar.style.width = `${percentage}%`;
            text.textContent = `Documento más grande: ${toKb(bytes)} KB de 1 MB`;

            // 5. Colores del Semáforo
            bar.className = "h-1.5 rounded-full transition-all duration-1000 ";
            
            if (percentage < 50) {
                bar.classList.add('bg-green-500'); // Zona Segura
            } else if (percentage < 80) {
                bar.classList.add('bg-yellow-500'); // Zona de Precaución
            } else {
                bar.classList.add('bg-red-600', 'animate-pulse'); // ¡PELIGRO!
                if (!storageWarned) {
                    storageWarned = true;
                    customAlert('¡Poco espacio!', 'Tu base de datos está cerca del límite de 1MB.\nPor favor, borra historial o comprime imágenes.', 'warning', null, 'cloud');
                }
            }
        }

        // ==========================================
        // 21. ESTADÍSTICAS (v42; Fase 33: misma base que Ganancias, con fiados)
        // ==========================================
        let salesChartInstance = null; // Variable para guardar el gráfico

        // Piezas de las tarjetas y listas: las comparten Estadísticas y Ganancias. extra y value son HTML ya seguro.
        const dashCard = (label, value, cls = 'text-gray-800', extra = '') => `<div class="bg-gray-50 border rounded-lg p-2 min-w-0"><p class="text-[10px] text-gray-500 font-bold uppercase">${label}</p><p class="font-bold text-sm break-words ${cls}">${value}</p>${extra}</div>`;
        const dashRow = (name, val, cls = 'text-gray-700') => `<div class="flex justify-between gap-2 text-xs py-1 border-b last:border-b-0"><span class="truncate">${escapeHtml(name)}</span><span class="font-bold shrink-0 ${cls}">${val}</span></div>`;
        const dashList = (title, rows, empty) => `<div class="border rounded-lg p-3"><p class="text-xs font-bold text-gray-700 mb-1">${title}</p>${rows.length ? rows.join('') : `<p class="text-xs text-gray-400">${empty}</p>`}</div>`;

        // Cambio en % frente al período anterior; null si el anterior no sirve de base (0 o negativo). Pura.
        const statsDelta = (cur, prev) => prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
        function statsDeltaHtml(cur, prev, label) {
            const pct = statsDelta(cur, prev);
            if (pct === null) return `<p class="text-[10px] text-gray-400">— vs. ${label}</p>`;
            return `<p class="text-[10px] font-bold ${pct >= 0 ? 'text-green-600' : 'text-red-600'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)} % vs. ${label}</p>`;
        }

        // Rango, período anterior equivalente y casillas del gráfico. Pura (now inyectable para la autoprueba).
        function statsRange(range, now = new Date()) {
            const y = now.getFullYear(), m = now.getMonth(), d = now.getDate(), p2 = n => String(n).padStart(2, '0');
            if (range === '12m') {
                const mo = k => new Date(y, m + k, 1);
                return { from: mo(-11), to: mo(1), prevFrom: mo(-23), prevTo: mo(-11), prevLabel: 'los 12 meses anteriores',
                    buckets: Array.from({ length: 12 }, (_, i) => ({ from: mo(i - 11), to: mo(i - 10), label: mo(i - 11).toLocaleDateString('es-ES', { month: 'short' }) })) };
            }
            const n = range === '30d' ? 30 : 7, day = k => new Date(y, m, d + k);
            return { from: day(1 - n), to: day(1), prevFrom: day(1 - 2 * n), prevTo: day(1 - n), prevLabel: `los ${n} días anteriores`,
                buckets: Array.from({ length: n }, (_, i) => { const f = day(i + 1 - n); return { from: f, to: day(i + 2 - n), label: `${p2(f.getDate())}/${p2(f.getMonth() + 1)}` }; }) };
        }

        // Ventas del rango [from, to): contado + fiados (profitLines), sin abonos ni isStub. Pura.
        // buckets: [{ from, to }] -> series con el total de cada casilla.
        // shortcut: los fiados podados no tienen detalle por día; cuentan solo en el rango por meses.
        function computeSalesStats({ sales, credits, archive, from, to, buckets = [], topN = 5 }) {
            const inRange = d => d >= from && d < to;
            const series = buckets.map(() => 0), byProduct = {}, tickets = new Set();
            let sold = 0, collected = 0;
            profitLines(sales, credits).forEach(({ item, date }) => {
                if (!inRange(date)) return;
                const amount = profitLine(item, []).amount;
                sold += amount;
                const b = buckets.findIndex(k => date >= k.from && date < k.to);
                if (b >= 0) series[b] += amount;
                const key = item.id ?? item.name;
                const bp = byProduct[key] || (byProduct[key] = { id: item.id, name: item.name, qty: 0, sold: 0 });
                bp.qty += Number(item.qty) || 0; bp.sold += amount;
            });
            const detailSold = sold; // el ticket promedio sale solo de lo que tiene detalle
            // Meses del archivo (fiados pagados y podados) que caben enteros, como computeProfit
            Object.entries(archive || {}).forEach(([key, mth]) => {
                const [y, mo] = key.split('-').map(Number), mFrom = new Date(y, mo - 1, 1), mTo = new Date(y, mo, 1);
                if (!(mFrom >= from && mTo <= to)) return;
                const amount = (Number(mth.sold) || 0) + (Number(mth.noCost) || 0);
                sold += amount;
                const b = buckets.findIndex(k => mFrom >= k.from && mTo <= k.to);
                if (b >= 0) series[b] += amount;
            });
            sales.forEach((s, i) => {
                if (!inRange(new Date(s.date))) return;
                collected += Number(s.total) || 0; // lo que entró: contado + abonos
                if (s.type !== 'payment' && (s.items || []).some(it => !it.isStub)) tickets.add('s' + i);
            });
            // Una compra fiada = fiado + momento en que se fió (al segundo: cada línea guarda su propio 'at')
            credits.forEach(c => (c.items || []).forEach(it => {
                const at = it.at || c.date;
                if (!it.isStub && inRange(new Date(at))) tickets.add(`c${c.id}|${String(at).slice(0, 19)}`);
            }));
            const top = Object.values(byProduct).sort((a, b) => b.qty - a.qty || b.sold - a.sold).slice(0, topN)
                .map(b => ({ ...b, sold: roundMoney(b.sold) }));
            return { sold: roundMoney(sold), collected: roundMoney(collected), tickets: tickets.size,
                avgTicket: tickets.size ? roundMoney(detailSold / tickets.size) : 0, series: series.map(roundMoney), top };
        }

        // tab 'profit': el llamador ya pasó por el candado Pro y el PIN
        function openDashboard(tab = 'sales') {
            $('dashboardModal').classList.remove('hidden');
            $('tabDashProfitPro').classList.toggle('hidden', hasPro());
            showDashTab(tab === 'profit' ? 'profit' : 'sales'); // desde la pestaña, Ganancias pide PIN cada vez
            updateChart('7d');
        }

        function closeDashboard() {
            $('dashboardModal').classList.add('hidden');
        }

        const STATS_LABELS = { '7d': '7 días', '30d': '30 días', '12m': 'Año' };
        function updateChart(range) {
            const pro = hasPro();
            if (range !== '7d' && !pro) return openMyPlan('la estadística de 30 días y del año');
            Object.keys(STATS_LABELS).forEach(r => {
                const btn = $(`btnChart${r}`);
                btn.className = 'flex-1 py-1 text-xs font-bold rounded transition ' + (r === range ? 'shadow bg-white text-indigo-600' : 'text-gray-500 hover:bg-gray-200');
                btn.innerHTML = STATS_LABELS[r] + (r !== '7d' && !pro ? ' <i class="fa-solid fa-lock text-[9px] ml-0.5"></i>' : '');
            });
            const R = statsRange(range);
            const base = { sales: state.sales, credits: state.credits, archive: state.profitArchive };
            const r = computeSalesStats({ ...base, from: R.from, to: R.to, buckets: R.buckets });
            const cmp = pro
                ? statsDeltaHtml(r.sold, computeSalesStats({ ...base, from: R.prevFrom, to: R.prevTo }).sold, R.prevLabel)
                : `<button type="button" onclick="openMyPlan('la comparación con el período anterior')" class="text-[10px] text-gray-400 underline text-left">Compara con el período anterior · Pro</button>`;
            $('statsCards').innerHTML = dashCard('Vendido', formatMoney(r.sold), 'text-gray-800', cmp)
                + dashCard('Cobrado', formatMoney(r.collected), 'text-green-600')
                + dashCard('Ventas', String(r.tickets))
                + dashCard('Ticket promedio', formatMoney(r.avgTicket));
            renderChartCanvas(R.buckets.map(b => b.label), r.series);
            renderStatsTop(r.top);
        }

        function renderStatsTop(top) {
            const first = top[0] && state.products.find(p => p.id == top[0].id);
            const img = first ? productImageSrc(first) : null;
            const head = `<span class="inline-flex items-center gap-2"><span class="w-8 h-8 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-500 flex items-center justify-center overflow-hidden shrink-0">${img ? `<img src="${escapeHtml(img)}" class="w-full h-full object-cover" alt="">` : '<i class="fa-solid fa-trophy text-xs"></i>'}</span>Los 5 más vendidos</span>`;
            $('statsTop').innerHTML = dashList(head, top.map(t => dashRow(t.name, `${t.qty} u. · ${formatMoney(t.sold)}`)), 'No hay ventas en este período.');
        }

        function renderChartCanvas(labels, data) {
            const ctx = document.getElementById('salesChartCanvas').getContext('2d');
            const sym = getSymbol();

            // Destruir gráfico anterior si existe para evitar bugs visuales
            if (salesChartInstance) salesChartInstance.destroy();

            salesChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: `Ventas (${sym})`,
                        data: data,
                        borderColor: '#4f46e5', // Indigo-600
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        borderWidth: 2,
                        tension: 0.3, // Curvatura suave
                        fill: true,
                        pointRadius: 3,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#4f46e5'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${sym} ` + context.parsed.y.toFixed(2);
                                }
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        function downloadChartImage() {
            const link = document.createElement('a');
            link.download = `reporte_ventas_${new Date().toISOString().split('T')[0]}.png`;
            // Chart.js canvas to Base64
            link.href = document.getElementById('salesChartCanvas').toDataURL('image/png');
            link.click();
        }

        // ---------- Autoprueba (datos ficticios, no toca state). Ejecutar en consola: selfTestStats() ----------
        function selfTestStats() {
            let fails = 0;
            const t = (cond, msg) => { console.assert(cond, 'selfTestStats: ' + msg); if (!cond) fails++; };
            const now = new Date(2026, 5, 10, 12), iso = (d, h = 12) => new Date(2026, 5, d, h).toISOString();
            const sales = [
                { date: iso(10), type: 'sale', total: 6, items: [{ id: 1, name: 'A', price: 3, qty: 2, subtotal: 6 }] },
                { date: iso(3), type: 'sale', total: 4, items: [{ id: 1, name: 'A', price: 4, qty: 1, subtotal: 4 }] }, // período anterior
                { date: iso(10), type: 'payment', total: 5, items: null },                                              // abono
                { date: iso(10), type: 'sale', total: 9, items: [{ id: 's', name: 'Deuda vieja', price: 9, qty: 1, subtotal: 9, isStub: true }] }
            ];
            const credits = [{ id: 7, date: iso(9), paid: 0, items: [
                { id: 1, name: 'A', price: 3, qty: 1, subtotal: 3 },
                { id: 2, name: 'B', price: 2, qty: 5, subtotal: 10, at: iso(10, 15) },
                { id: 2, name: 'B', price: 2, qty: 1, subtotal: 2, at: iso(10, 15), isStub: true }] }];
            const archive = { '2026-05': { sold: 7, cost: 3, est: 0, noCost: 1 }, '2024-01': { sold: 50, cost: 0, est: 0, noCost: 0 } };
            const R = statsRange('7d', now);
            t(R.buckets.length === 7 && statsRange('30d', now).buckets.length === 30 && R.from.getDate() === 4 && R.to.getDate() === 11 && R.prevFrom.getDate() === 28, 'rango de 7 y 30 días');
            const r = computeSalesStats({ sales, credits, archive, from: R.from, to: R.to, buckets: R.buckets });
            t(r.sold === 19, 'vendido = contado 6 + fiado 3 + fiado 10 (sin abono ni isStub)');
            t(r.collected === 20, 'cobrado = todo lo que entró (6 + 5 + 9)');
            t(r.tickets === 3 && r.avgTicket === 6.33, 'ventas: 1 de contado + 2 compras fiadas; promedio 6,33');
            t(r.series[6] === 16 && r.series[5] === 3 && r.series.reduce((a, b) => a + b, 0) === 19, 'serie por día');
            t(r.top.length === 2 && r.top[0].name === 'B' && r.top[0].qty === 5 && r.top[0].sold === 10 && r.top[1].qty === 3 && r.top[1].sold === 9, 'más vendidos por unidades');
            const prev = computeSalesStats({ sales, credits, archive, from: R.prevFrom, to: R.prevTo });
            t(prev.sold === 4 && statsDelta(r.sold, prev.sold) === 375, 'comparación con el período anterior');
            t(statsDelta(5, 0) === null && statsDelta(5, -2) === null && statsDelta(5, 10) === -50, 'anterior en 0: sin porcentaje');
            const Y = statsRange('12m', now);
            const y = computeSalesStats({ sales, credits, archive, from: Y.from, to: Y.to, buckets: Y.buckets });
            t(Y.buckets.length === 12 && y.sold === 31 && y.series[11] === 23 && y.series[10] === 8, 'año: serie por mes y archivo del mes entero');
            t(y.tickets === 4 && y.avgTicket === 5.75, 'año: el promedio no usa el archivo');
            const e = computeSalesStats({ sales: [], credits: [], archive: null, from: R.from, to: R.to, buckets: R.buckets });
            t(e.sold === 0 && e.tickets === 0 && e.avgTicket === 0 && e.top.length === 0, 'sin datos');
            console.log(fails ? `selfTestStats: ${fails} fallas` : 'selfTestStats: OK');
            return fails;
        }

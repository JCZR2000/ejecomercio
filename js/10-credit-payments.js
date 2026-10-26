        // ==========================================
        // 10. PAGOS DE FIADOS
        // ==========================================

        // Aplica un abono ya validado. Sin DOM, sin guardar, sin alertas.
        function applyCreditPayment(credit, amount, rate, saleId) {
            // Antes de cobrar, guardamos la deuda real calculada (incluyendo aumentos)
            credit.totalDebt = roundMoney(calculateRealDebt(credit));
            credit.paid = roundMoney(credit.paid + amount);

            const settled = roundMoney(credit.totalDebt - credit.paid) <= 0.01;
            if (settled) credit.paidDate = new Date().toISOString();

            state.sales.unshift({
                id: saleId,
                date: new Date().toISOString(),
                type: 'payment',
                description: `Abono: ${credit.customer}`,
                total: amount,
                rate: rate
            });
            return { settled };
        }

        // Sin efectos. entries = [{ id, amount }]
        function validateCreditPayments(entries) {
            return entries.map(e => {
                const c = state.credits.find(x => x.id == e.id);
                const r = { id: e.id, customer: c ? c.customer : '', amount: e.amount, debt: 0, remaining: 0, error: '' };
                if (!c) { r.error = 'Fiado no encontrado'; return r; }
                r.debt = roundMoney(calculateRealDebt(c) - c.paid);
                r.remaining = roundMoney(r.debt - e.amount);
                if (!e.amount || e.amount <= 0) r.error = 'Monto inválido';
                else if (e.amount > r.debt + 0.01) r.error = `Excede la deuda (${formatMoney(r.debt)})`;
                return r;
            });
        }

        function payCredit(id) {
            const inputUSD = $(`pay_usd_${id}`);
            if (!inputUSD) return;

            const amount = roundMoney(parseFloat(inputUSD.value));
            const [v] = validateCreditPayments([{ id, amount }]);
            if (v.error === 'Fiado no encontrado') return;
            if (v.error.startsWith('Excede')) return alert('El monto excede la deuda');
            if (v.error) return alert(v.error);

            const c = state.credits.find(x => x.id == id);
            const { settled } = applyCreditPayment(c, amount, getFiadosActiveRate(), Date.now());
            if (settled) setTimeout(autoPruneCredits, 500);

            saveData();
            renderAll();

            // Pequeño delay para que la UI se actualice antes de la alerta
            setTimeout(() => {
                if (settled) alert(`¡Deuda de ${c.customer} saldada! Se ha movido al historial.`);
                else alert('Abono registrado.');
            }, 100);
        }

        // --- Pagos múltiples ---
        let multiPayEntries = [];

        function collectCreditPayments() {
            const entries = [];
            document.querySelectorAll('#creditsList input[id^="pay_usd_"]').forEach(inp => {
                const amount = roundMoney(parseFloat(inp.value));
                if (amount > 0) entries.push({ id: inp.id.slice('pay_usd_'.length), amount });
            });
            return entries;
        }

        function startPayCredits(id) {
            const entries = collectCreditPayments();
            if (entries.length === 0) return alert('Monto inválido');
            if (entries.length === 1) return payCredit(entries[0].id);
            openMultiPayModal(entries);
        }

        function openMultiPayModal(entries) {
            multiPayEntries = entries;
            const rate = getFiadosActiveRate();
            const rows = validateCreditPayments(entries);
            let total = 0;
            $('multiPayBody').innerHTML = rows.map(r => {
                total += r.amount;
                const err = r.error ? `<div class="text-[10px] text-red-600 font-bold">${escapeHtml(r.error)}</div>` : '';
                return `<tr class="${r.error ? 'bg-red-50 text-red-700' : ''} border-b">
                    <td class="py-1 pr-1">${escapeHtml(r.customer)}${err}</td>
                    <td class="py-1 text-right">${formatMoney(r.amount)}</td>
                    <td class="py-1 text-right">Bs ${(r.amount * rate).toFixed(2)}</td>
                    <td class="py-1 text-right">${r.error ? '—' : formatMoney(r.remaining)}</td></tr>`;
            }).join('');
            $('multiPayTotal').innerText = `${formatMoney(roundMoney(total))}`;
            const btn = $('multiPayConfirmBtn');
            btn.innerText = `Confirmar ${rows.length} pagos`;
            btn.disabled = rows.some(r => r.error);
            btn.classList.toggle('opacity-50', btn.disabled);
            $('multiPayModal').classList.remove('hidden');
        }

        function closeMultiPayModal() {
            $('multiPayModal').classList.add('hidden');
            multiPayEntries = [];
        }

        function confirmMultiPay() {
            // Se vuelve a validar: el estado pudo cambiar con una sincronización
            const rows = validateCreditPayments(multiPayEntries);
            if (rows.some(r => r.error)) return openMultiPayModal(multiPayEntries);

            const rate = getFiadosActiveRate();
            const base = Date.now();
            const settledNames = [];
            let total = 0;
            rows.forEach((r, i) => {
                const c = state.credits.find(x => x.id == r.id);
                const { settled } = applyCreditPayment(c, r.amount, rate, base + i);
                total += r.amount;
                if (settled) settledNames.push(c.customer);
            });
            if (settledNames.length) setTimeout(autoPruneCredits, 500);

            closeMultiPayModal();
            saveData();
            renderAll();
            setTimeout(() => alert(`${rows.length} abonos registrados por ${formatMoney(roundMoney(total))}.` +
                (settledNames.length ? ` Saldados: ${settledNames.join(', ')}` : '')), 100);
        }

        function selfTestCreditPayments() {
            const bak = structuredClone({ credits: state.credits, products: state.products, sales: state.sales, creditMode: state.creditMode });
            try {
                state.creditMode = 'FIXED';
                state.products = [];
                state.sales = [];
                const mk = (id, name, debt) => ({ id, customer: name, items: [], totalDebt: debt, paid: 0, date: '' });
                state.credits = [mk(1, 'A', 10), mk(2, 'B', 20), mk('x3', 'C', 5)];
                let r = validateCreditPayments([{ id: 1, amount: 5 }, { id: 2, amount: 8 }, { id: 'x3', amount: 2 }]);
                console.assert(r.every(x => !x.error), 'pagos válidos sin error');
                console.assert(r[0].remaining === 5 && r[1].remaining === 12 && r[2].remaining === 3, 'remaining correcto');
                r = validateCreditPayments([{ id: 1, amount: 5 }, { id: 2, amount: 25 }]);
                console.assert(!r[0].error && r[1].error, 'solo el que excede tiene error');
                console.assert(!validateCreditPayments([{ id: 1, amount: 10.01 }])[0].error, 'tolerancia 0.01');
                console.assert(validateCreditPayments([{ id: 1, amount: 10.02 }])[0].error, '0.02 excede');
                console.assert(validateCreditPayments([{ id: 99, amount: 1 }])[0].error === 'Fiado no encontrado', 'no encontrado');
                const base = Date.now();
                const s1 = applyCreditPayment(state.credits[0], 10, 1, base);
                const s2 = applyCreditPayment(state.credits[1], 8, 1, base + 1);
                console.assert(state.sales[0].id !== state.sales[1].id, 'ids distintos');
                console.assert(s1.settled && state.credits[0].paidDate && !s2.settled && !state.credits[1].paidDate, 'saldado lleva paidDate');
            } finally {
                state.credits = bak.credits; state.products = bak.products; state.sales = bak.sales; state.creditMode = bak.creditMode;
            }
            console.log('selfTestCreditPayments terminado');
        }

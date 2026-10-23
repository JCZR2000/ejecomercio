        // ==========================================
        // 2. MANEJO DE FECHAS (MODAL CUSTOM)
        // ==========================================
        function toggleCustomDate() {
            const val = $('paymentScheduleSelect').value;
            $('customPaymentDate').className = val === 'custom' ? 'w-full border rounded px-2 py-1 text-xs bg-white block' : 'hidden';
        }

        function calculatePaymentDate() {
            const val = $('paymentScheduleSelect').value;
            if (!val) return null;
            const today = new Date();
            let targetDate = new Date();
            
            if (val === 'custom') {
                const custom = $('customPaymentDate').value;
                return custom ? new Date(custom + 'T00:00:00').toISOString() : null;
            }
            if (val === '15') targetDate.setDate(today.getDate() + 15);
            if (val === '30') targetDate.setDate(today.getDate() + 30);
            if (val === 'fin_mes') {
                targetDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            }
            if (val === 'quincena') {
                if (today.getDate() < 15) targetDate.setDate(15);
                else targetDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            }
            return targetDate.toISOString();
        }

        function getDateDisplay(isoDate) {
            if (!isoDate) return '';
            const target = new Date(isoDate);
            const today = new Date();
            const diffTime = target - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const dateStr = target.toLocaleDateString();
            let statusHTML = '';

            if (diffDays < 0) {
                statusHTML = `<span class="text-red-600 font-bold ml-1 animate-pulse bg-red-100 px-1 rounded text-[10px]">ATRASADO</span>`;
            } else if (diffDays === 0) {
                statusHTML = `<span class="text-orange-500 font-bold ml-1">(Hoy)</span>`;
            } else if (diffDays <= 5) {
                statusHTML = `<span class="text-red-500 font-bold ml-1">(${diffDays} días restantes)</span>`;
            } else {
                statusHTML = `<span class="text-gray-400 ml-1">(${diffDays} días)</span>`;
            }
            return `<div class="mt-1 text-xs text-gray-600"><i class="fa-solid fa-calendar-day mr-1 text-gray-600"></i>Pago: ${dateStr} ${statusHTML}</div>`;
        }

        function updatePaymentDate(id) {
            checkAuth('edit', () => {
                state.dateEditId = id;
                const c = state.credits.find(x => x.id == id);
                if (c && c.nextPaymentDate) {
                    $('dateInputPicker').value = c.nextPaymentDate.split('T')[0];
                } else {
                    $('dateInputPicker').value = '';
                }
                $('dateModal').classList.remove('hidden');
            });
        }

        function confirmDateChange() {
            const id = state.dateEditId;
            const newVal = $('dateInputPicker').value;
            const idx = state.credits.findIndex(c => c.id == id);
            if (idx !== -1) {
                if (newVal) state.credits[idx].nextPaymentDate = new Date(newVal + 'T00:00:00').toISOString();
                else state.credits[idx].nextPaymentDate = null;
                saveData();
                renderAll();
            }
            closeDateModal();
        }

        function closeDateModal() {
            $('dateModal').classList.add('hidden');
            state.dateEditId = null;
        }

        function deleteDate() {
            const id = state.dateEditId;
            const idx = state.credits.findIndex(c => c.id == id);
            if (idx !== -1) {
                state.credits[idx].nextPaymentDate = null;
                saveData();
                renderAll();
            }
            closeDateModal();
        }

        // ==========================================
        // 3. SISTEMA DE RECARGOS
        // ==========================================
        function openSurchargeModal(id) {
            checkAuth('edit', () => {
                $('surchargeTargetId').value = id;
                $('surchargeInput').value = '';
                $('surchargeModal').classList.remove('hidden');
                setSurchargeType('PERCENT');
            });
        }

        function closeSurchargeModal() {
            $('surchargeModal').classList.add('hidden');
        }

        function setSurchargeType(type) {
            state.surchargeType = type;
            if (type === 'PERCENT') {
                $('btnSurchPerc').className = "flex-1 py-2 text-xs border rounded bg-blue-50 border-blue-200 text-blue-700 font-bold";
                $('btnSurchFixed').className = "flex-1 py-2 text-xs border rounded bg-gray-50 text-gray-600";
                $('surchargeSymbol').textContent = "%";
            } else {
                $('btnSurchPerc').className = "flex-1 py-2 text-xs border rounded bg-gray-50 text-gray-600";
                $('btnSurchFixed').className = "flex-1 py-2 text-xs border rounded bg-blue-50 border-blue-200 text-blue-700 font-bold";
                $('surchargeSymbol').textContent = getSymbol();
            }
        }

        function applySurcharge() {
            const id = $('surchargeTargetId').value;
            const val = parseFloat($('surchargeInput').value);
            if (!val || val <= 0) return alert('Monto inválido');
            const idx = state.credits.findIndex(c => c.id == id);
            if (idx === -1) return;

            let amountToAdd = 0;
            const debt = state.credits[idx].totalDebt - state.credits[idx].paid;
            
            if (state.surchargeType === 'PERCENT') {
                amountToAdd = roundMoney(debt * (val / 100));
            } else {
                amountToAdd = roundMoney(val);
            }

            state.credits[idx].totalDebt = roundMoney(state.credits[idx].totalDebt + amountToAdd);
            if (!state.credits[idx].surcharge) state.credits[idx].surcharge = 0;
            state.credits[idx].surcharge = roundMoney(state.credits[idx].surcharge + amountToAdd);
            
            saveData();
            closeSurchargeModal();
            renderAll();
            alert('Recargo aplicado.');
        }

        function removeSurcharge() {
            const id = $('surchargeTargetId').value;
            const idx = state.credits.findIndex(c => c.id == id);
            if (idx === -1) return;

            const currentSurcharge = state.credits[idx].surcharge || 0;

            if (currentSurcharge <= 0) {
                return alert('Este cliente no tiene recargos activos.');
            }

            if (confirm('¿Estás seguro de PERDONAR la deuda de recargo? Esto restará el monto del recargo a la deuda total.')) {
                state.credits[idx].totalDebt -= currentSurcharge;
                if (state.credits[idx].totalDebt < state.credits[idx].paid) state.credits[idx].totalDebt = state.credits[idx].paid;
                state.credits[idx].surcharge = 0;
                saveData();
                renderAll();
                closeSurchargeModal();
                alert('Recargo eliminado. Deuda ajustada.');
            }
        }


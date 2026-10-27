        // ==========================================
        // 19. HISTORIAL Y LIMPIEZA DE FIADOS (v42)
        // ==========================================
        
        function openCreditHistory() {
            renderCreditHistory();
            $('creditHistoryModal').classList.remove('hidden');
        }

        function closeCreditHistory() {
            $('creditHistoryModal').classList.add('hidden');
        }

        function renderCreditHistory() {
            const container = $('creditHistoryList');
            container.innerHTML = '';

            // 1. Filtramos SOLO los que están pagados (Deuda <= Pagado)
            // Y que tengan fecha de pago (paidDate) o sean viejos (0 deuda)
            const paidCredits = state.credits.filter(c => (c.totalDebt - c.paid) <= 0.01);

            // 2. Ordenamos: El más reciente primero
            paidCredits.sort((a, b) => {
                const dateA = a.paidDate ? new Date(a.paidDate).getTime() : 0;
                const dateB = b.paidDate ? new Date(b.paidDate).getTime() : 0;
                return dateB - dateA;
            });

            // 3. Tomamos solo los últimos 5 para mostrar
            const historyToShow = paidCredits.slice(0, 5);

            if (historyToShow.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8 opacity-50">
                        <i class="fa-solid fa-ghost text-4xl mb-2 text-gray-300"></i>
                        <p class="text-xs text-gray-500">No hay historial reciente.</p>
                    </div>`;
                return;
            }

            historyToShow.forEach(c => {
                // Resumen de items
                let itemsSummary = "Varios productos";
                if(c.items && c.items.length > 0) {
                    itemsSummary = c.items.map(i => `${i.qty}x ${escapeHtml(i.name)}`).join(', ');
                }

                // Fecha de pago
                const datePay = c.paidDate ? new Date(c.paidDate).toLocaleDateString() : 'Fecha desc.';

                container.innerHTML += `
                    <div class="bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm relative group">
                        <button onclick="permanentDeleteCredit('${c.id}')" class="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition p-1">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>

                        <div class="flex justify-between items-start mb-1">
                            <div>
                                <h4 class="font-bold text-gray-700 text-sm">${escapeHtml(c.customer)}</h4>
                                <span class="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Pagado</span>
                            </div>
                            <div class="text-right pr-6">
                                <div class="font-bold text-gray-800 text-sm">${formatMoney(c.paid)}</div>
                                <div class="text-[9px] text-gray-400">${datePay}</div>
                            </div>
                        </div>
                        <p class="text-[10px] text-gray-500 mt-2 border-t pt-1 leading-tight">
                            ${itemsSummary}
                        </p>
                    </div>
                `;
            });
        }

        function permanentDeleteCredit(id) {
            if(confirm('¿Eliminar este registro del historial permanentemente?')) {
                state.credits = state.credits.filter(c => c.id != id);
                saveData();
                renderCreditHistory();
            }
        }

        // Función de Limpieza Automática (El recolector de basura)
        function autoPruneCredits() {
            // Buscamos los pagados
            const paidCredits = state.credits.filter(c => (c.totalDebt - c.paid) <= 0.01);
            
            // Si hay 5 o menos, no hacemos nada
            if (paidCredits.length <= 5) return;

            // Si hay más de 5, necesitamos borrar los excedentes
            // Ordenamos por fecha de pago (los más recientes primero)
            paidCredits.sort((a, b) => {
                const dateA = a.paidDate ? new Date(a.paidDate).getTime() : 0;
                const dateB = b.paidDate ? new Date(b.paidDate).getTime() : 0;
                return dateB - dateA;
            });

            // Los "salvados" son los primeros 5. Los "condenados" son el resto.
            const creditsToKeepIds = paidCredits.slice(0, 5).map(c => c.id);
            const creditsToDelete = paidCredits.slice(5); // Del 6 en adelante

            if (creditsToDelete.length > 0) {
                console.log(`🧹 Limpieza: Borrando ${creditsToDelete.length} fiados antiguos para ahorrar espacio.`);
                
                creditsToDelete.forEach(archiveCredit); // Fase 14: su ganancia queda en el resumen mensual

                // Filtramos el estado principal:
                // Mantenemos si NO está pagado O si está en la lista de los 5 a salvar
                state.credits = state.credits.filter(c => {
                    const isPaid = (c.totalDebt - c.paid) <= 0.01;
                    if (!isPaid) return true; // Mantener deudas activas
                    return creditsToKeepIds.includes(c.id); // Mantener solo el Top 5 pagado
                });
                
                saveData(); // Guardar cambios en disco
            }
        }


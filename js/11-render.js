        // ==========================================
        // 11. RENDERIZADO GENERAL Y TABLAS
        // ==========================================
        function renderAll() {
            // 1. Control del botón "X" del buscador
            const searchVal = $('searchInput').value;
            if (searchVal.length > 0) {
                $('clearSearchBtn').classList.remove('hidden');
            } else {
                $('clearSearchBtn').classList.add('hidden');
            }

            // 2. Actualizar UI de tasas
            updateRateUI();
            const activeRate = getActiveRate();
            const sym = getSymbol();
            
            // 3. Preparar variables de filtrado
            state.filterText = searchVal.toLowerCase();
            let displayProds = [...state.products];
            
            // 4. Lógica de Filtrado (Nombre O Código de Barras)
            if (state.filterText) {
                displayProds = displayProds.filter(p => 
                    p.name.toLowerCase().includes(state.filterText) || 
                    (p.barcode && p.barcode.includes(state.filterText))
                );
            }

            // 5. Lógica de Ordenamiento (CANT, PRECIO, NOMBRE)
            displayProds.sort((a, b) => {
                let valA = a[state.sortCol];
                let valB = b[state.sortCol];

                // Corrección para columnas numéricas (Stock y Precio)
                if (state.sortCol === 'qty' || state.sortCol === 'price') {
                    valA = parseFloat(valA) || 0;
                    valB = parseFloat(valB) || 0;
                } 
                // Corrección para texto (Nombre)
                else if (typeof valA === 'string' && typeof valB === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                }

                if (valA < valB) return state.sortAsc ? -1 : 1;
                if (valA > valB) return state.sortAsc ? 1 : -1;
                return 0;
            });

            // 6. Renderizado de la Tabla
            const invBody = $('inventoryTableBody');
            invBody.innerHTML = '';
            
            // Actualizar iconos de ordenamiento
            ['name', 'qty', 'price'].forEach(col => {
                const icon = $(`sort-icon-${col}`);
                if (icon) {
                    icon.className = 'fa-solid ml-1 ' + (state.sortCol === col ? (state.sortAsc ? 'fa-sort-up text-blue-600' : 'fa-sort-down text-blue-600') : 'fa-sort text-gray-300');
                }
            });

            // Generar filas
            displayProds.forEach(p => {
                const img = productImageSrc(p) ? `<img src="${escapeHtml(productImageSrc(p))}" class="w-10 h-10 object-cover rounded border">` : `<div class="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400"><i class="fa-solid fa-image"></i></div>`;
                
                invBody.innerHTML += `<tr class="border-b hover:bg-gray-50">
                    <td class="p-2">${img}</td>
                    <td class="p-2 font-medium">${escapeHtml(p.name)}</td>
                    <td class="p-2 text-center ${p.qty < 5 ? 'text-red-500 font-bold':''}">${p.qty}</td>
                    <td class="p-2 text-right font-bold text-gray-600">${formatMoney(p.price)}</td>
                    <td class="p-2 text-right text-blue-700 text-xs">Bs ${(p.price * activeRate).toFixed(2)}</td>
                    <td class="p-2 text-center whitespace-nowrap">
                        <button onclick="addToCartFromRow('${p.id}')" class="text-green-600 hover:text-green-800 mr-3 bg-green-50 p-1.5 rounded-full hover:bg-green-100 transition" title="Añadir a Venta"><i class="fa-solid fa-cart-plus"></i></button>
                        <button onclick="editProduct('${p.id}')" class="text-yellow-500 hover:text-yellow-600 mr-2"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="requestDelete('${p.id}')" class="text-red-500 hover:text-red-600"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>`;
            });
            
            // Mostrar mensaje si está vacío
            $('emptyInvMsg').className = displayProds.length ? 'hidden' : 'p-8 text-center text-gray-400 italic bg-white';

            // Actualizar otras vistas
            renderHistoryTable();
            calculateTotals();
            renderCreditsList();
            renderCart();
        }

        function calculateTotals() {
            let dayT = 0, monthT = 0;
            const now = new Date();
            const todayStr = now.toDateString();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            state.sales.forEach(s => {
                const d = new Date(s.date);
                const amount = Number(s.total) || 0;
                if (d.toDateString() === todayStr) dayT += amount;
                if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) monthT += amount;
            });
            
            $('todayTotal').textContent = `${formatMoney(dayT)}`;
            $('monthTotal').textContent = `${formatMoney(monthT)}`;
        }

        function renderHistoryTable() {
            const sym = getSymbol();
            const histBody = $('historyBody');
            histBody.innerHTML = '';
            
            state.sales.sort((a, b) => new Date(b.date) - new Date(a.date));
            state.sales.slice(0, 25).forEach(s => {
                const d = new Date(s.date);
                let detail = '';
                if (s.type === 'payment') {
                    detail = `<span class="text-green-600 font-bold"><i class="fa-solid fa-money-bill-wave"></i> ${escapeHtml(s.description)}</span>`;
                } else {
                    const count = s.items ? s.items.reduce((a, b) => a + b.qty, 0) : 0;
                    detail = `<span class="text-gray-700">Venta: ${count} items</span>`;
                }
                const amt = Number(s.total) || 0;
                histBody.innerHTML += `<tr class="border-b">
                    <td class="p-2 text-xs text-gray-500">${d.toLocaleDateString()} ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
                    <td class="p-2 text-xs truncate max-w-[200px]">${detail}</td>
                    <td class="p-2 text-right font-bold text-xs whitespace-nowrap">
                        ${formatMoney(amt)}
                        <button onclick="openReceiptFromHistory('${s.id}')" class="ml-2 text-gray-400 hover:text-indigo-600 transition">
                            <i class="fa-solid fa-print"></i>
                        </button>
                    </td>
                </tr>`;
            });
        }

        function renderCreditsList() {
            const fiadosRate = getFiadosActiveRate();
            const sym = getSymbol();
            const container = $('creditsList');
            container.innerHTML = '';
            
            // 1. Obtener término de búsqueda
            const searchText = $('creditSearchInput') ? $('creditSearchInput').value.toLowerCase().trim() : '';

            // 2. Obtener TODOS los pendientes (para calcular totales reales)
            const allPending = state.credits.filter(c => (c.totalDebt - c.paid) > 0.01);
            
            // 3. Calcular Total Global (Sin importar la búsqueda)
            const totalGlobalDebt = allPending.reduce((sum, c) => sum + (c.totalDebt - c.paid), 0);
            $('totalPendingDebt').textContent = `${formatMoney(totalGlobalDebt)}`;
            
            // 4. Actualizar Badge del Tab (Número total de deudores)
            const badge = $('creditBadge');
            if (allPending.length > 0) {
                badge.textContent = allPending.length;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }

            // 5. FILTRAR la lista para mostrar (Según búsqueda)
            const filteredList = allPending.filter(c => c.customer.toLowerCase().includes(searchText));

            // Manejo de mensaje "No encontrado" o "No hay deudas"
            if (allPending.length === 0) {
                $('noCreditsMsg').textContent = "No hay cuentas por cobrar.";
                $('noCreditsMsg').classList.remove('hidden');
                return; // No renderizamos nada más
            } else if (filteredList.length === 0) {
                $('noCreditsMsg').textContent = "No se encontró ningún cliente con ese nombre.";
                $('noCreditsMsg').classList.remove('hidden');
            } else {
                $('noCreditsMsg').classList.add('hidden');
            }

            // 6. APLICAR ORDENAMIENTO (Lógica Nueva)
            filteredList.sort((a, b) => {
                // Calculamos la deuda actual de A y B para poder comparar
                const debtA = a.totalDebt - a.paid;
                const debtB = b.totalDebt - b.paid;

                switch (state.creditSortMode) {
                    case 'URGENCY':
                        const dateA = a.nextPaymentDate ? new Date(a.nextPaymentDate).getTime() : Number.MAX_SAFE_INTEGER;
                        const dateB = b.nextPaymentDate ? new Date(b.nextPaymentDate).getTime() : Number.MAX_SAFE_INTEGER;
                        if (dateA === dateB) return b.id - a.id; 
                        return dateA - dateB;

                    case 'ALPHA_ASC': return a.customer.localeCompare(b.customer);
                    case 'ALPHA_DESC': return b.customer.localeCompare(a.customer);
                    
                    // --- NUEVOS CASOS ---
                    case 'DEBT_DESC': return debtB - debtA; // Mayor a menor
                    case 'DEBT_ASC': return debtA - debtB;  // Menor a mayor
                    // --------------------

                    case 'RECENT':
                    default: return b.id - a.id;
                }
            });

            // 7. Renderizar tarjetas (Ya ordenadas)
            filteredList.forEach(c => {
                
                // --- INICIO DEL CAMBIO v42 ---
                // 1. Calculamos la deuda real (Dinámica o Fija según config)
                const currentTotalDebt = calculateRealDebt(c);

                // 2. Detectamos si subió de precio (para la etiqueta azul)
                const hasPriceIncrease = currentTotalDebt > c.totalDebt;

                // 3. Calculamos el saldo pendiente
                const debt = currentTotalDebt - c.paid;

                // Protección: Si el recálculo da 0 o negativo (error de precisión), saltamos
                if (debt <= 0.01) return;

                // 4. Cálculos visuales estándar
                const roundedDebt = Math.round((debt + Number.EPSILON) * 100) / 100;
                const debtBs = roundedDebt * fiadosRate;
                // --- FIN DEL CAMBIO v42 ---

                const date = new Date(c.date).toLocaleDateString();
                
                const consolidated = {};
                c.items.forEach(i => {
                    if (consolidated[i.name]) consolidated[i.name] += i.qty;
                    else consolidated[i.name] = i.qty;
                });

                const itemsSummary = Object.entries(consolidated).map(([name, qty]) => `${qty}x ${escapeHtml(name)}`).join(', ');
                const dateDisplay = getDateDisplay(c.nextPaymentDate);
                const surchargeDisplay = c.surcharge ? `<div class="text-xs text-orange-600 mt-1 font-bold">+ Recargo: ${formatMoney(c.surcharge)}</div>` : '';
                const originalDebt = c.totalDebt - (c.surcharge || 0);

                const card = document.createElement('div');
                // IMPORTANTE: Agregué 'relative' aquí para poder posicionar la X
                card.className = "bg-white border-l-4 border-red-500 rounded shadow p-3 text-sm hover:shadow-md transition-shadow relative group h-full"; 
                
                card.innerHTML = `
                    <button onclick="requestDeleteCredit('${c.id}')" class="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition p-1" title="Eliminar Fiado">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>

                    <div class="flex justify-between items-start mb-2 pr-6"> <div class="flex flex-col space-y-1 w-2/3"> 
                            <h4 class="font-bold text-gray-800 text-base flex items-center gap-2">
                                <i class="fa-solid fa-user text-gray-400 text-xs"></i> ${escapeHtml(c.customer)}
                            </h4>
                            <p class="text-[10px] text-gray-500">Venta: ${date}</p>
                            ${dateDisplay}
                            <p class="text-xs text-gray-600 mt-1 italic"><i class="fa-solid fa-basket-shopping mr-1"></i>${itemsSummary}</p>
                        </div>
                        
                        <div class="text-right w-1/3">
                            <div class="font-bold text-red-600 text-lg">${formatMoney(debt)}</div>
                            
                            <div class="text-xs text-blue-600 font-bold mb-1">Bs ${debtBs.toFixed(2)}</div>
                            
                            ${hasPriceIncrease && state.creditMode === 'DYNAMIC' ?
                                '<div class="mb-2"><span class="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase border border-blue-200 inline-flex items-center gap-1"><i class="fa-solid fa-arrow-trend-up"></i> Ajustado</span></div>'
                                : ''}
                            
                            <div>
                                <div class="text-xs text-gray-400">Orig: ${formatMoney(c.totalDebt - (c.surcharge || 0))}</div> ${surchargeDisplay}
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-2 items-center mb-2 flex-wrap pt-2 border-t border-gray-100">
                        <button onclick="editCredit('${c.id}')" class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded text-xs hover:bg-indigo-200 border border-indigo-200 flex items-center gap-1 font-bold"><i class="fa-solid fa-cart-plus mr-1"></i>Agregar</button>
                        <button onclick="requestEditCredit('${c.id}')" class="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs hover:bg-gray-200 border border-gray-200 flex items-center gap-1 font-bold" title="Quitar productos"><i class="fa-solid fa-pen mr-1"></i>Editar</button>
                        <button onclick="updatePaymentDate('${c.id}')" class="bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs hover:bg-blue-200 border border-blue-200 font-bold flex items-center gap-1" title="Cambiar Fecha"><i class="fa-solid fa-calendar-days mr-1"></i>Fecha</button>
                        <button onclick="openSurchargeModal('${c.id}')" class="bg-yellow-100 text-yellow-700 px-3 py-1 rounded text-xs hover:bg-yellow-200 border border-yellow-200 font-bold flex items-center gap-1" title="Aplicar Recargo"><i class="fa-solid fa-bolt mr-1"></i>Recargo</button>
                        <button onclick="openShareModal('${c.id}')" class="bg-green-100 text-green-700 px-3 py-1 rounded text-xs hover:bg-green-200 border border-green-200 font-bold flex items-center gap-1" title="Enviar Recordatorio">
                            <i class="fa-solid fa-share-nodes"></i> Recordar
                        </button>
                        <button onclick="openReceiptFromCredit('${c.id}')" class="bg-gray-100 text-gray-700 px-3 py-1 rounded text-xs hover:bg-gray-200 border border-gray-200 font-bold flex items-center gap-1" title="Factura">
                            <i class="fa-solid fa-receipt"></i> Factura
                        </button>
                    </div>
                    
                    <div class="bg-gray-50 p-2 rounded grid grid-cols-5 gap-2 border border-gray-100 items-end">
                        <div class="col-span-2 relative">
                            <span class="dynamic-symbol-span absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">${sym}</span>
                            <input type="number" id="pay_usd_${c.id}" placeholder="0.00" class="w-full border rounded px-1 pl-12 py-1 text-xs outline-none focus:border-green-500 transition-colors bg-white" oninput="convertCreditPayment('${c.id}', 'USD')">
                        </div>
                        <div class="col-span-2 relative">
                            <span class="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">Bs</span>
                            <input type="number" id="pay_bs_${c.id}" placeholder="0.00" class="w-full border rounded px-1 pl-8 py-1 text-xs outline-none focus:border-green-500 transition-colors bg-white" oninput="convertCreditPayment('${c.id}', 'BS')">
                        </div>
                        <div class="col-span-1">
                            <button onclick="requestPayCredit('${c.id}')" class="w-full bg-green-600 text-white py-1 rounded text-xs hover:bg-green-700 font-bold shadow-sm">Pagar</button>
                        </div>
                    </div>`;
                container.appendChild(card);
            });
        }


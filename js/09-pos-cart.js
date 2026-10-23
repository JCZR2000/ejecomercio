        // ==========================================
        // 9. LOGICA DE VENTAS Y CARRITO
        // ==========================================
        $('isCreditSale').addEventListener('change', (e) => toggleCreditUI(e.target.checked));

        function toggleCreditUI(isCredit) {
            if (state.activeCreditId) return; // Si estamos editando un fiado existente, no tocar.

            const btn = $('btnCheckout');
            
            if (isCredit) {
                // MODO FIADO (NUEVO)
                $('creditConfig').classList.remove('hidden');
                $('newCreditInputs').classList.remove('hidden');
                
                btn.innerHTML = '<span>Confirmar Fiado</span> <i class="fa-solid fa-user-clock ml-2"></i>';
                btn.className = 'w-full h-14 bg-orange-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-orange-700 active:scale-95 transition flex items-center justify-center gap-2';
            } else {
                // MODO VENTA DIRECTA
                $('creditConfig').classList.add('hidden');
                
                btn.innerHTML = '<span>Confirmar Venta</span> <i class="fa-solid fa-arrow-right ml-2"></i>';
                btn.className = 'w-full h-14 bg-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-700 active:scale-95 transition flex items-center justify-center gap-2';
                
                // Limpiar inputs de abono
                $('initialPayUSD').value = '';
                $('initialPayBS').value = '';
            }
        }

        window.editCredit = (id) => {
            const credit = state.credits.find(c => c.id == id);
            const name = credit ? credit.customer : '';
            checkAuth('credit_add', () => {
                state.activeCreditId = id;
                
                // 1. Configurar UI del Modal para "Modo Edición"
                const container = $('posContainer');
                if(container) container.classList.add('edit-mode'); // Borde naranja
                
                $('posTitle').textContent = `Agregando a: ${name}`;
                $('editModeBadge').classList.remove('hidden'); // Mostrar badge "EDITANDO"
                
                // 2. Mostrar configuración de crédito
                $('creditConfig').classList.remove('hidden');

                // --- NUEVO: MOSTRAR EL BOTÓN CANCELAR ---
                const btnCancel = $('btnCancelCreditMode');
                if (btnCancel) {
                    btnCancel.classList.remove('hidden');
                    btnCancel.classList.add('flex'); // Asegurar display flex
                }
                // ----------------------------------------

                $('newCreditInputs').classList.add('hidden'); // Ocultar input de nombre nuevo
                
                // 3. Forzar el switch de "Es Fiado" a activado
                const switchCredit = $('isCreditSale');
                switchCredit.checked = true;
                switchCredit.disabled = true; // Bloquear para que no lo quiten
                
                // 4. Resetear fechas y montos
                $('paymentScheduleSelect').value = '';
                toggleCustomDate();
                $('initialPayUSD').value = '';
                $('initialPayBS').value = '';

                // 5. Configurar Botón Grande de Confirmar
                const btn = $('btnCheckout');
                btn.textContent = 'Guardar / Actualizar Deuda';
                // Usamos clases naranjas para diferenciar
                btn.className = 'w-full h-14 bg-orange-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-orange-700 active:scale-95 transition flex items-center justify-center gap-2';
                btn.disabled = false;

                // 6. ¡ABRIR EL MODAL!
                toggleCartModal(true);
            });
        };

        window.addToCart = () => {
            let id = $('saleProductSelect').value;
            const qty = parseInt($('saleQty').value);
            
            // INTELIGENCIA EXTRA: Si no hay ID, buscar por nombre exacto
            if (!id) {
                const text = $('posSearchInput').value.trim();
                const exactMatch = state.products.find(p => p.name.toLowerCase() === text.toLowerCase());
                if (exactMatch) {
                    id = exactMatch.id;
                    $('saleProductSelect').value = id; // Lo guardamos para la próxima
                }
            }

            if (!id || qty < 1) return;
            const p = state.products.find(x => x.id == id);

            // CORRECCIÓN LÓGICA AQUÍ:
            // Buscamos si el producto ya está, pero SOLO si NO es un "Stub" (Deuda Vieja)
            // Si es un Stub, 'inCart' será undefined y creará una línea nueva abajo.
            const inCart = state.cart.find(c => c.id == id && !c.isStub);
            const currentQty = inCart ? inCart.qty : 0;
            
            if (currentQty + qty > p.qty) return alert('Stock insuficiente');
            
            if (inCart) {
                inCart.qty += qty;
                inCart.subtotal = inCart.qty * p.price;
            } else {
                state.cart.push({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    qty,
                    subtotal: qty * p.price
                });
            }
            renderCart();
            $('saleQty').value = 1;

            $('posSearchInput').value = ''; 
            $('saleProductSelect').value = ''; 
            if ($('stockHint')) $('stockHint').textContent = '';
        };

        window.addToCartFromRow = (id) => {
            const p = state.products.find(x => x.id == id);
            if (!p) return;

            // CORRECCIÓN LÓGICA AQUÍ TAMBIÉN:
            // Solo agrupar con productos REALES, no con Stubs.
            const inCart = state.cart.find(c => c.id == id && !c.isStub);

            const currentQty = inCart ? inCart.qty : 0;

            if (currentQty + 1 > p.qty) {
                return alert('Stock insuficiente (Máximo alcanzado)');
            }

            if (inCart) {
                inCart.qty++;
                inCart.subtotal = inCart.qty * p.price;
            } else {
                state.cart.push({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    qty: 1,
                    subtotal: p.price
                });
            }
            renderCart();
        };

        window.removeFromCart = (idx) => {
            state.cart.splice(idx, 1);
            renderCart();
        };

        // --- NUEVA FUNCIÓN: Modificar cantidad en carrito (+ / -) ---
        window.updateCartQty = (idx, change) => {
            const item = state.cart[idx];
            // Buscamos el producto original para verificar el stock real
            const product = state.products.find(p => p.id == item.id);
            
            // 1. Lógica para RESTAR
            if (change === -1) {
                if (item.qty <= 1) return; // No hacer nada si es 1 (el botón estará visualmente deshabilitado)
            }
            
            // 2. Lógica para SUMAR (Verificar Stock)
            if (change === 1) {
                if (item.qty + 1 > product.qty) {
                    return alert('Stock máximo alcanzado para este producto');
                }
            }

            // 3. Aplicar cambios
            item.qty += change;
            item.subtotal = item.qty * item.price;
            
            // 4. Renderizar cambios
            renderCart();
        };

        function renderCart() {
            const activeRate = getActiveRate();
            const sym = getSymbol();
            const tbody = $('cartTableBody');
            if(!tbody) return;

            tbody.innerHTML = '';
            let totalUSD = 0;
            let totalItems = 0; // 1. Inicializamos contador
            
            // 2. Detectar stubs para la etiqueta
            const hasStubs = state.cart.some(i => i.isStub);
            if ($('abonoLabel')) {
                $('abonoLabel').textContent = hasStubs ? "Abono (Deuda Vieja)" : "Abono Inicial";
            }

            state.cart.forEach((item, idx) => {
                // CALCULO SEGURO: Precio * Cantidad
                const rowTotal = item.price * item.qty; 
                totalUSD += rowTotal;
                
                // 3. Sumar al contador del badge
                totalItems += item.qty; 
                
                // Lógica de Stubs (Visual y Botones)
                const isStub = item.isStub === true;
                const minusDisabled = item.qty <= 1 || isStub ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400' : 'hover:bg-red-100 text-red-600 bg-gray-50';
                const plusDisabled = isStub ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400' : 'hover:bg-green-100 text-green-600 bg-green-50 border-green-200';
                
                const nameHtml = isStub 
                    ? `<span class="text-indigo-600"><i class="fa-solid fa-clock-rotate-left mr-1"></i>${escapeHtml(item.name)}</span> <span class="text-[9px] bg-indigo-100 text-indigo-700 px-1 rounded ml-1">VIEJO</span>`
                    : escapeHtml(item.name);

                tbody.innerHTML += `
                <tr class="border-b bg-white last:border-0">
                    <td class="p-3">
                        <div class="font-bold text-gray-800 text-xs mb-1">${nameHtml}</div>
                        <div class="flex items-center gap-2">
                            <button onclick="updateCartQty(${idx}, -1)" class="w-6 h-6 rounded border flex items-center justify-center transition-colors ${minusDisabled}" ${item.qty <= 1 || isStub ? 'disabled' : ''}>
                                <i class="fa-solid fa-minus text-[10px]"></i>
                            </button>
                            
                            <span class="text-sm font-bold w-6 text-center text-gray-700">${item.qty}</span>
                            
                            <button onclick="updateCartQty(${idx}, 1)" class="w-6 h-6 rounded border flex items-center justify-center transition-colors ${plusDisabled}" ${isStub ? 'disabled' : ''}>
                                <i class="fa-solid fa-plus text-[10px]"></i>
                            </button>
                        </div>
                    </td>
                    
                    <td class="p-3 text-right">
                        <div class="font-mono font-bold text-gray-700 text-sm">${formatMoney(rowTotal)}</div>
                        <div class="text-[10px] text-gray-400">c/u ${formatMoney(item.price)}</div>
                    </td>
                    
                    <td class="p-3 text-right align-middle">
                        <button onclick="removeFromCart(${idx})" class="text-gray-400 hover:text-red-500 transition-colors p-1" title="Eliminar del carrito">
                            <i class="fa-solid fa-times text-sm"></i>
                        </button>
                    </td>
                </tr>`;
            });
            
            // UI de Estado Vacío
            const emptyMsg = $('cartEmptyMsg');
            if(emptyMsg) {
                if(state.cart.length === 0) {
                    emptyMsg.className = 'text-center text-gray-400 py-8 text-xs italic flex flex-col items-center justify-center gap-2 absolute inset-0';
                    emptyMsg.innerHTML = '<i class="fa-solid fa-basket-shopping text-2xl text-gray-300"></i><span>Carrito vacío</span>';
                    emptyMsg.classList.remove('hidden');
                } else {
                    emptyMsg.classList.add('hidden');
                }
            }
            
            // UI de Totales
            $('cartTotalUSD').textContent = formatMoney(totalUSD).replace('$',''); 
            $('cartTotalBS').textContent = (totalUSD * activeRate).toFixed(2);
            
            const btnCheckout = $('btnCheckout');
            if(btnCheckout) btnCheckout.disabled = state.cart.length === 0;

            // 4. LÓGICA DEL BADGE (CONTADOR ROJO)
            const badge = $('cartBadge');
            if (badge) {
                badge.textContent = totalItems;
                if (totalItems > 0) {
                    badge.classList.remove('hidden');
                    badge.classList.add('flex'); // Asegurar que se vea redondo y centrado
                    // Pequeña animación visual (opcional)
                    badge.classList.remove('scale-0');
                    badge.classList.add('scale-100');
                } else {
                    badge.classList.add('hidden');
                    badge.classList.remove('flex');
                    badge.classList.add('scale-0');
                }
            }
        }

        window.processCheckout = () => {
            const activeRate = getActiveRate();
            const isCredit = $('isCreditSale').checked;
            const customerName = $('customerName').value.trim();
            const initialPay = parseFloat($('initialPayUSD').value) || 0;
            const totalUSD = state.cart.reduce((sum, i) => sum + i.subtotal, 0);
            const nextPaymentDate = isCredit ? calculatePaymentDate() : null;

            if (isCredit && !state.activeCreditId) {
                checkAuth('credit_add', () => {
                    executeCheckout();
                });
                return;
            }
            executeCheckout();

            function executeCheckout() {
                // A. Validación
                if (isCredit && !state.activeCreditId && !customerName) return alert('Escribe el nombre del cliente');
                if (!confirm('¿Confirmar transacción?')) return;

                // B. DESCUENTO DE INVENTARIO (CRÍTICO: Hacerlo primero)
                state.cart.forEach(item => {
                    if (!item.isStub) { 
                        const p = state.products.find(x => x.id == item.id);
                        if (p) p.qty -= item.qty;
                    }
                });

                // C. Registro de la Transacción
                if (isCredit) {
                    if (state.activeCreditId) {
                        // ... (Lógica de actualizar fiado existente) ...
                        const idx = state.credits.findIndex(c => c.id == state.activeCreditId);
                        if (idx !== -1) {
                            state.credits[idx].items.push(...state.cart);
                            state.credits[idx].totalDebt += totalUSD;
                            state.credits[idx].paid += initialPay;
                            if (nextPaymentDate) state.credits[idx].nextPaymentDate = nextPaymentDate;
                        }
                        exitEditMode(); // <--- Ahora esta función ya no fallará
                    } else {
                        // ... (Nuevo fiado) ...
                        state.credits.push({
                            id: Date.now(),
                            customer: customerName,
                            items: [...state.cart],
                            totalDebt: totalUSD,
                            paid: initialPay,
                            date: new Date().toISOString(),
                            nextPaymentDate: nextPaymentDate
                        });
                    }
                    // Abono inicial
                    if (initialPay > 0) {
                        state.sales.unshift({
                            id: Date.now() + 1,
                            date: new Date().toISOString(),
                            type: 'payment',
                            description: `Abono Inicial: ${state.activeCreditId ? state.credits.find(c=>c.id==state.activeCreditId).customer : customerName}`,
                            total: initialPay,
                            rate: activeRate
                        });
                    }
                    // Preparar recibo
                    tempReceiptData = {
                        items: [...state.cart],
                        total: totalUSD,
                        paid: initialPay,
                        date: new Date().toISOString(),
                        customer: customerName,
                        isCredit: true
                    };
                    $('successModal').classList.remove('hidden');
                    switchTab('credits'); // Ir a pestaña fiados
                } else {
                    // Venta Contado
                    state.sales.unshift({
                        id: Date.now(),
                        date: new Date().toISOString(),
                        type: 'sale',
                        items: [...state.cart],
                        total: totalUSD,
                        rate: activeRate
                    });
                    
                    tempReceiptData = {
                        items: [...state.cart],
                        total: totalUSD,
                        date: new Date().toISOString(),
                        type: 'sale',
                        customer: ''
                    };
                    $('successModal').classList.remove('hidden');
                }

                // D. GUARDADO Y LIMPIEZA FINAL
                state.cart = []; // Vaciar memoria
                
                // Limpieza de inputs (Con seguridad "Anti-Crash")
                if($('customerName')) $('customerName').value = '';
                if($('initialPayUSD')) $('initialPayUSD').value = '';
                if($('initialPayBS')) $('initialPayBS').value = '';
                if($('posSearchInput')) $('posSearchInput').value = '';
                if($('stockHint')) $('stockHint').textContent = ''; // <--- AQUÍ ESTABA EL ERROR (Solucionado con el if)
                
                // Resetear selectores
                const scheduleSelect = $('paymentScheduleSelect');
                if(scheduleSelect) scheduleSelect.value = '';
                toggleCustomDate();
                
                // Salir de modos especiales
                if (!state.activeCreditId) {
                    const switchCred = $('isCreditSale');
                    if(switchCred) switchCred.checked = false;
                    toggleCreditUI(false);
                }

                // E. PERSISTENCIA Y CIERRE
                saveData(); // Guardar en Firebase/LocalStorage
                renderAll(); // Actualizar inventario visual
                toggleCartModal(false); // CERRAR LA VENTANA (Ahora sí llegará aquí)
            }
        }


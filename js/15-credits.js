        // ==========================================
        // 15. LÓGICA DE ORDENAMIENTO DE FIADOS
        // ==========================================
        function toggleSortMenu() {
            const menu = $('sortMenuDropdown');
            menu.classList.toggle('hidden');
            
            // Actualizar checks visuales
            ['URGENCY', 'ALPHA_ASC', 'ALPHA_DESC', 'RECENT', 'DEBT_DESC', 'DEBT_ASC'].forEach(mode => {
                const icon = $(`check-${mode}`);
                if(icon) {
                    if (state.creditSortMode === mode) icon.classList.remove('hidden');
                    else icon.classList.add('hidden');
                }
            });
        }

        function setCreditSort(mode) {
            state.creditSortMode = mode;
            $('sortMenuDropdown').classList.add('hidden');
            renderCreditsList(); // Re-renderizar con el nuevo orden
        }
        
        // Cerrar menú si se hace clic fuera (Opcional, mejora UX)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button[onclick="toggleSortMenu()"]');
            const menu = $('sortMenuDropdown');
            if (!btn && !menu.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });

        // ==========================================
        // 16. SISTEMA DE COMPARTIR / RECORDATORIO
        // ==========================================

        // Variable para recordar qué cliente estamos editando en el modal
        state.currentShareId = null;
        
        // ==========================================
        // 16. SISTEMA DE COMPARTIR / RECORDATORIO (V39.5)
        // ==========================================

        state.currentShareId = null;
        // Objeto para guardar datos de pago en memoria
        state.paymentMethods = JSON.parse(localStorage.getItem('inv_payment_methods')) || {
            TRANSFER: { bank: '', account: '', id: '' },
            PAGO_MOVIL: { bank: '', phone: '', id: '' },
            BINANCE: { email: '' },
            CUSTOM: { text: '' }
        };
        
        function openShareModal(id) {
            state.currentShareId = id;
            $('chkIncludeBs').checked = false;
            $('chkIncludePayment').checked = false;
            togglePaymentSection(); // Resetea vista de pagos
            regenerateShareMessage();
            $('shareModal').classList.remove('hidden');
        }

        function togglePaymentSection() {
            const show = $('chkIncludePayment').checked;
            $('paymentSection').className = show ? "block p-3 bg-white border-t border-gray-100 space-y-3" : "hidden";
            if (show) {
                // Si abrimos, cargamos el último método usado o reseteamos
                $('paymentMethodSelect').value = "";
                renderPaymentInputs();
            }
            regenerateShareMessage();
        }

        function renderPaymentInputs() {
            const method = $('paymentMethodSelect').value;
            $('payFormContainer').className = method ? "block space-y-2 animate-fade-in" : "hidden";
            
            // Ocultar todos primero
            $('formTransfer').classList.add('hidden');
            $('formMobile').classList.add('hidden');
            $('formBinance').classList.add('hidden');
            $('formCustom').classList.add('hidden');

            // Mostrar el seleccionado y llenar datos
            if (method === 'TRANSFER') {
                $('formTransfer').classList.remove('hidden');
                $('inputTransBank').value = state.paymentMethods.TRANSFER.bank || '';
                $('inputTransAccount').value = state.paymentMethods.TRANSFER.account || '';
                $('inputTransId').value = state.paymentMethods.TRANSFER.id || '';
            } else if (method === 'PAGO_MOVIL') {
                $('formMobile').classList.remove('hidden');
                $('inputMobBank').value = state.paymentMethods.PAGO_MOVIL.bank || '';
                $('inputMobPhone').value = state.paymentMethods.PAGO_MOVIL.phone || '';
                $('inputMobId').value = state.paymentMethods.PAGO_MOVIL.id || '';
            } else if (method === 'BINANCE') {
                $('formBinance').classList.remove('hidden');
                $('inputBinanceEmail').value = state.paymentMethods.BINANCE.email || '';
            } else if (method === 'CUSTOM') {
                $('formCustom').classList.remove('hidden');
                $('inputCustomText').value = state.paymentMethods.CUSTOM.text || '';
            }
            
            regenerateShareMessage(); // Actualizar mensaje al cambiar método
        }

        function savePaymentDetails() {
            const method = $('paymentMethodSelect').value;
            if (!method) return;

            // 1. Guardar en el Estado
            if (method === 'TRANSFER') {
                state.paymentMethods.TRANSFER = {
                    bank: $('inputTransBank').value,
                    account: $('inputTransAccount').value,
                    id: $('inputTransId').value
                };
            } else if (method === 'PAGO_MOVIL') {
                state.paymentMethods.PAGO_MOVIL = {
                    bank: $('inputMobBank').value,
                    phone: $('inputMobPhone').value,
                    id: $('inputMobId').value
                };
            } else if (method === 'BINANCE') {
                state.paymentMethods.BINANCE = { email: $('inputBinanceEmail').value };
            } else if (method === 'CUSTOM') {
                state.paymentMethods.CUSTOM = { text: $('inputCustomText').value };
            }

            // 2. Guardar en Disco Local
            localStorage.setItem('inv_payment_methods', JSON.stringify(state.paymentMethods));

            // 3. Sincronizar con la Nube
            saveData();

            // 4. Feedback
            alert('Datos de pago guardados y sincronizados.');
            regenerateShareMessage(); // Actualizar mensaje con los nuevos datos guardados
        }

        function regenerateShareMessage() {
            if (!state.currentShareId) return;
            const c = state.credits.find(x => x.id == state.currentShareId);
            if (!c) return;
            
            // --- CORRECCIÓN CRÍTICA AQUÍ ---
            // 1. Calcular Deuda REAL (Usando precios actuales si es dinámico)
            // Usamos la función auxiliar que ya existe en tu sistema
            const currentTotalDebt = calculateRealDebt(c);

            // 2. Restar lo pagado
            const debt = currentTotalDebt - c.paid;

            // Protección: Evitar negativos visuales
            const finalDebt = debt > 0 ? debt : 0;
            // -------------------------------
            
            const moneyText = formatMoney(debt); 
            
            // 2. Texto de Tasa y Bs
            let rateText = "";
            if ($('chkIncludeBs').checked) {
                const rate = getFiadosActiveRate();
                const debtBsValue = debt * rate;
                // Formato Bs Venezolano
                const debtBs = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(debtBsValue);
                
                // Determinar nombre de la tasa
                let rateName = "del día de hoy";
                if (state.fiadosRateMode === 'USD' || (state.fiadosRateMode === 'DEFAULT' && state.rateMode === 'USD')) rateName = "BCV del día de hoy";
                else if (state.fiadosRateMode === 'EUR' || (state.fiadosRateMode === 'DEFAULT' && state.rateMode === 'EUR')) rateName = "Euro BCV del día de hoy";
                
                rateText = ` (Equivalente a Bs. ${debtBs} a la tasa ${rateName})`;
            }
            
            // 3. Productos
            const consolidated = {};
            c.items.forEach(i => {
                if (consolidated[i.name]) consolidated[i.name].qty += i.qty;
                else consolidated[i.name] = { qty: i.qty, price: i.price };
            });
            let itemsList = "";
            Object.entries(consolidated).forEach(([name, data]) => {
                itemsList += `- ${data.qty}x ${name}\n`;
            });
            
            // 4. Bloque de Pago
            let paymentBlock = "";
            if ($('chkIncludePayment').checked) {
                const method = $('paymentMethodSelect').value;
                if (method) {
                    let methodTitle = "";
                    let details = "";
                    
                    if (method === 'TRANSFER') {
                        methodTitle = "Transferencia Bancaria";
                        details = `Banco: ${$('inputTransBank').value}\nCuenta: ${$('inputTransAccount').value}\nC.I./RIF: ${$('inputTransId').value}`;
                    } else if (method === 'PAGO_MOVIL') {
                        methodTitle = "Pago Móvil";
                        details = `Banco: ${$('inputMobBank').value}\nTeléfono: ${$('inputMobPhone').value}\nC.I./RIF: ${$('inputMobId').value}`;
                    } else if (method === 'BINANCE') {
                        methodTitle = "Binance Pay";
                        details = `Correo/ID: ${$('inputBinanceEmail').value}`;
                    } else if (method === 'CUSTOM') {
                        methodTitle = "este medio";
                        details = $('inputCustomText').value;
                    }
                    
                    if (methodTitle && details) {
                        paymentBlock = `\nPuedes hacer el pago a través de ${methodTitle}:\n${details}\n`;
                    }
                }
            }

            // 5. Ensamblar Mensaje Final
            const message = `Hola ${c.customer},\n\nTe recuerdo que tienes una deuda pendiente de ${moneyText}${rateText}.\n\nPor los siguientes productos:\n${itemsList}${paymentBlock}\nEstamos en contacto, saludos. ¡Gracias por tu compra!`;
            
            $('shareMessageInput').value = message;
        }

        function closeShareModal() {
            $('shareModal').classList.add('hidden');
        }

        function copyShareMessage() {
            const text = $('shareMessageInput');
            text.select();
            text.setSelectionRange(0, 99999); // Para móviles
            
            try {
                navigator.clipboard.writeText(text.value).then(() => {
                    const originalBtn = event.currentTarget.innerHTML;
                    event.currentTarget.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado!';
                    setTimeout(() => event.currentTarget.innerHTML = originalBtn, 2000);
                });
            } catch (err) {
                document.execCommand('copy'); // Fallback antiguo
                alert('Mensaje copiado.');
            }
        }

        function nativeShareMessage() {
            const text = $('shareMessageInput').value;
            
            // Detectamos si es un dispositivo móvil
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            // Solo usamos el menú nativo si es un móvil Y el navegador lo soporta
            if (isMobile && navigator.share) {
                navigator.share({
                    title: 'Recordatorio de Pago',
                    text: text
                }).catch(console.error);
            } else {
                // Si es PC (o no soporta share), abrimos WhatsApp Web directamente
                const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                window.open(url, '_blank');
            }
        }

        // ==========================================
        // 17. SISTEMA DE MIGRACIÓN (CLIENTES VIEJOS)
        // ==========================================
        let tempMigCart = [];

        function openMigrationModal() {
            $('migSimpleAmount').value = '';
            tempMigCart = [];
            renderMigCart();
            toggleMigrationView('SIMPLE');
            $('migrationModal').classList.remove('hidden');
            $('migSimpleAmount').focus();
        }

        function closeMigrationModal() {
            $('migrationModal').classList.add('hidden');
        }

        function toggleMigrationView(view) {
            if (view === 'SIMPLE') {
                $('migViewSimple').classList.remove('hidden');
                $('migViewAdvanced').classList.add('hidden');
            } else {
                $('migViewSimple').classList.add('hidden');
                $('migViewAdvanced').classList.remove('hidden');
                $('migSearchInput').value = '';
                $('migSearchInput').focus();
            }
        }

        // --- MODO SIMPLE: Agrega un solo item genérico ---
        function addSimpleDebt() {
            const amount = parseFloat($('migSimpleAmount').value);
            if (!amount || amount <= 0) return alert('Ingresa un monto válido');

            state.cart.push({
                id: 'stub_simple_' + Date.now(),
                name: 'Saldo Anterior (Migración)',
                price: roundMoney(amount),
                qty: 1,
                subtotal: roundMoney(amount),
                isStub: true // BANDERA IMPORTANTE
            });
            
            renderCart();
            closeMigrationModal();
        }

        // --- MODO AVANZADO: Buscador y Mini-Carrito ---
        function filterMigOptions() {
            const val = $('migSearchInput').value.toLowerCase();
            const list = state.products.filter(p => p.name.toLowerCase().includes(val));
            const drop = $('migDropdown');
            drop.innerHTML = '';
            
            if(list.length === 0) drop.innerHTML = '<div class="p-2 text-xs text-gray-400">No encontrado</div>';
            
            list.forEach(p => {
                const div = document.createElement('div');
                div.className = "p-2 text-xs border-b hover:bg-indigo-50 cursor-pointer flex justify-between";
                div.innerHTML = `<span>${escapeHtml(p.name)}</span> <span class="font-bold">${formatMoney(p.price)}</span>`;
                div.onmousedown = (e) => {
                    e.preventDefault();
                    addToMigCart(p);
                    $('migSearchInput').value = '';
                    drop.classList.add('hidden');
                };
                drop.appendChild(div);
            });
            drop.classList.remove('hidden');
        }

        function addToMigCart(p) {
            // Buscamos si ya existe en el carrito temporal
            const existingItem = tempMigCart.find(i => i.id === p.id);
            
            if (existingItem) {
                // Si existe, aumentamos cantidad y recalculamos subtotal
                existingItem.qty++;
                existingItem.subtotal = roundMoney(existingItem.qty * existingItem.price);
            } else {
                // Si no existe, lo agregamos nuevo
                tempMigCart.push({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    qty: 1,
                    subtotal: p.price,
                    isStub: true
                });
            }
            renderMigCart();
        }

        function updateMigQty(idx, change) {
            const item = tempMigCart[idx];
            
            // Si es resta y hay 1, no hacemos nada (para eso está el botón de borrar X)
            if (change === -1 && item.qty <= 1) return;
            
            item.qty += change;
            item.subtotal = roundMoney(item.qty * item.price);
            renderMigCart();
        }

        function renderMigCart() {
            const tbody = $('migTableBody');
            tbody.innerHTML = '';
            
            if(tempMigCart.length === 0) {
                $('migEmptyMsg').classList.remove('hidden');
            } else {
                $('migEmptyMsg').classList.add('hidden');
                
                tempMigCart.forEach((item, idx) => {
                    // Estilo para deshabilitar el menos si es 1
                    const minusClass = item.qty <= 1 ? 'text-gray-300' : 'text-red-500 hover:text-red-700 font-bold';
                    
                    // Fila con diseño tipo "Tarjeta" simple dentro de la tabla
                    tbody.innerHTML += `
                        <tr class="border-b last:border-0 hover:bg-gray-50 transition">
                            <td class="py-2 pl-2 align-middle">
                                <div class="text-xs font-medium text-gray-700">${escapeHtml(item.name)}</div>
                            </td>

                            <td class="py-2 align-middle">
                                <div class="flex items-center justify-center gap-3">
                                    <button onclick="updateMigQty(${idx}, -1)" class="${minusClass} text-sm px-1 transition" ${item.qty <= 1 ? 'disabled' : ''}>
                                        <i class="fa-solid fa-minus"></i>
                                    </button>
                                    
                                    <span class="text-sm font-bold text-gray-800 w-4 text-center">${item.qty}</span>
                                    
                                    <button onclick="updateMigQty(${idx}, 1)" class="text-green-500 hover:text-green-700 font-bold text-sm px-1 transition">
                                        <i class="fa-solid fa-plus"></i>
                                    </button>
                                </div>
                            </td>

                            <td class="py-2 text-right align-middle font-mono text-xs font-bold text-gray-600">
                                ${formatMoney(item.subtotal)}
                            </td>

                            <td class="py-2 pr-2 text-right align-middle">
                                <button onclick="tempMigCart.splice(${idx},1);renderMigCart()" class="text-red-400 hover:text-red-600 transition px-2">
                                    <i class="fa-solid fa-times"></i>
                                </button>
                            </td>
                        </tr>`;
                });
            }
        }

        function addAdvancedDebt() {
            if (tempMigCart.length === 0) return alert('Lista vacía');
            state.cart.push(...tempMigCart);
            renderCart();
            closeMigrationModal();
        }

        // ==========================================
        // 18. LÓGICA DE BORRADO DE FIADOS
        // ==========================================
        function requestDeleteCredit(id) {
            // 1. Guardamos el ID en el input oculto del modal para usarlo al confirmar
            $('deleteTargetId').value = id;
            // 2. Buscamos el objeto del fiado en la memoria
            const c = state.credits.find(x => x.id == id);
            
            if (c) {
                // --- REGLAS DE NEGOCIO PARA RESTAURAR STOCK ---
                // No permitimos devolver stock si la cuenta ya tiene movimientos de dinero complejos.
                
                // Usamos 0.01 de tolerancia porque a veces javascript calcula 0 como 0.0000001
                const hasPayments = c.paid > 0.01; // ¿Ya pagó algo?
                const hasSurcharge = (c.surcharge || 0) > 0.01; // ¿Tiene recargos/multas?
                const hasItems = c.items && c.items.length > 0; // ¿Tiene productos físicos?

                // La condición mágica: Solo restauramos si está "Virgen" (Sin pagos, sin multas) y tiene cosas.
                const canRestore = !hasPayments && !hasSurcharge && hasItems;

                // 3. Siempre reiniciamos el checkbox desmarcado por seguridad
                $('chkRestoreStock').checked = false;

                // 4. Manipulación de la Interfaz (UI)
                if (canRestore) {
                    // CASO A: Venta limpia -> Mostramos opción de devolver stock
                    $('restoreStockContainer').classList.remove('hidden');
                    $('restoreStockBlocked').classList.add('hidden');
                } else {
                    // CASO B: Venta compleja -> Ocultamos opción
                    $('restoreStockContainer').classList.add('hidden');

                    // Solo mostramos el aviso de "Bloqueado" si realmente había productos que devolver.
                    // Si era una deuda pura de dinero (migración simple), no mostramos nada.
                    if(hasItems) $('restoreStockBlocked').classList.remove('hidden');
                    else $('restoreStockBlocked').classList.add('hidden');
                }
            }

            // 5. Finalmente, mostramos el modal
            $('deleteCreditModal').classList.remove('hidden');
        }

        // --- Es la función que permite que el modal se cierre ---
        function closeDeleteCreditModal() {
            $('deleteCreditModal').classList.add('hidden');
        }
        // --------------------------------------

        function confirmDeleteCredit() {
            // Verificamos permisos de administrador (pide PIN si existe y está configurado)
            checkAuth('admin', () => {
                const id = $('deleteTargetId').value;
                const idx = state.credits.findIndex(c => c.id == id);
                
                // SEGURIDAD: Forzamos el cierre del modal de contraseña para evitar conflictos visuales (Z-Index)
                // Seguridad extra: cerramos el modal de clave por si acaso
                $('authModal').classList.add('hidden'); 

                if (idx !== -1) {
                    try {
                        // --- 1. LÓGICA DE RESTAURACIÓN (MEJORADA) ---
                        const chk = $('chkRestoreStock');
                        const container = $('restoreStockContainer');
                        // Verificamos que esté marcado Y que sea visible (legal)
                        const shouldRestore = chk && chk.checked && container && !container.classList.contains('hidden');
                        
                        // VALIDACIÓN CRÍTICA:
                        // Solo procedemos a restaurar si:
                        // 1. El checkbox existe y está marcado.
                        // 2. El contenedor es visible (si está oculto, significa que la deuda estaba bloqueada por abonos previos).
                        if (shouldRestore) {
                            const credit = state.credits[idx];
                            if (credit.items) {
                                credit.items.forEach(item => {
                                    // REGLA DE NEGOCIO: No restauramos "Stubs" (items de migración/deuda vieja)
                                    // porque estos nunca se descontaron del inventario real.
                                    if (!item.isStub) {
                                        const prod = state.products.find(p => p.id == item.id);
                                        // PROTECCIÓN MATEMÁTICA: 
                                        // Usamos parseInt para asegurar que sumamos números y no texto.
                                        // Evita errores como: "10" (stock) + "2" (devuelto) = "102".
                                        if (prod) prod.qty = (parseInt(prod.qty) || 0) + (parseInt(item.qty) || 0);
                                    }
                                });
                            }
                        }

                        // --- BLOQUE 2: BORRADO ---
                        // Eliminamos el fiado del array principal
                        state.credits.splice(idx, 1);

                        // Guardamos los cambios en LocalStorage (Inventario + Créditos)
                        saveData();

                    } catch (error) {
                        // Si algo falla en la lógica (ej. error de cálculo), lo capturamos aquí
                        // para que no detenga la ejecución y permita cerrar la ventana.
                        console.error("Error al borrar:", error);
                    } finally {
                        // --- 3. FINALIZACIÓN (SIEMPRE SE EJECUTA) ---
                        closeDeleteCreditModal(); // 1. Cerrar el modal inmediatamente (Prioridad visual)
                        renderCreditsList(); // 2. Refrescar todas las listas para reflejar cambios (stock devuelto o fila borrada)
                        renderAll(); 
                        
                        // 3. Feedback al usuario
                        // Usamos setTimeout(50ms) para dar tiempo al navegador de eliminar el modal visualmente
                        // antes de congelar la pantalla con la alerta del sistema.
                        setTimeout(() => {
                            alert("Cliente eliminado correctamente.");
                        }, 50);
                    }
                } else {
                    // Fallback: Si por alguna razón el ID no se encuentra, cerramos el modal igual.
                    closeDeleteCreditModal();
                }
            });
        }


        // ==========================================
        // 18b. EDITAR FIADO (quitar productos)
        // ==========================================
        let editCreditId = null;

        // Sin efectos: no toca state ni el DOM.
        function planCreditItemRemoval(credit, itemIdx, qty) {
            const item = credit.items && credit.items[itemIdx];
            if (!item) return { error: 'Producto no encontrado' };
            if (credit.paidDate) return { error: 'El fiado ya está saldado' };
            qty = Number(qty);
            if (!Number.isInteger(qty) || qty < 1 || qty > item.qty) return { error: `Cantidad inválida (1 a ${item.qty})` };
            if (credit.items.length === 1 && qty === item.qty) return { error: 'Es el único producto. Para anular el fiado usa la papelera' };

            const items = credit.items.map(i => ({ ...i }));
            if (qty === item.qty) items.splice(itemIdx, 1);
            else {
                items[itemIdx].qty = item.qty - qty;
                items[itemIdx].subtotal = roundMoney(items[itemIdx].qty * item.price);
            }
            const totalDebt = state.creditMode === 'FIXED'
                ? roundMoney(credit.totalDebt - roundMoney(qty * item.price))
                : calculateRealDebt({ ...credit, items });
            if (credit.paid > totalDebt + 0.01) {
                return { error: `El cliente ya abonó ${formatMoney(credit.paid)} y el nuevo total sería ${formatMoney(totalDebt)}. Registra la devolución aparte` };
            }
            return {
                items, totalDebt,
                settled: roundMoney(totalDebt - credit.paid) <= 0.01,
                returnQty: item.isStub ? 0 : qty,
                productId: item.id
            };
        }

        function requestEditCredit(id) {
            checkAuth('admin', () => openEditCreditModal(id));
        }

        function openEditCreditModal(id) {
            const c = state.credits.find(x => x.id == id);
            if (!c) return;
            if (c.paidDate) return alert('El fiado ya está saldado');
            editCreditId = id;
            $('authModal').classList.add('hidden');
            renderEditCreditModal();
            $('editCreditModal').classList.remove('hidden');
        }

        function renderEditCreditModal() {
            const c = state.credits.find(x => x.id == editCreditId);
            if (!c) return closeEditCreditModal();
            $('editCreditTitle').innerText = `Editar fiado — ${c.customer}`;
            $('editCreditFiscal').classList.toggle('hidden', !c.fiscalNum);
            $('editCreditItems').innerHTML = c.items.map((it, i) => `
                <div class="border rounded p-2 text-xs">
                    <div class="font-bold text-gray-800">${escapeHtml(it.name)}</div>
                    ${it.isStub ? '<div class="text-[10px] text-amber-600">Deuda anterior (no vuelve al inventario)</div>' : ''}
                    <div class="text-gray-500">${it.qty} × ${formatMoney(it.price)} = ${formatMoney(it.subtotal)}</div>
                    <div class="flex gap-2 mt-1 items-center">
                        <input type="number" id="editQty_${i}" min="1" max="${it.qty}" value="${it.qty}" class="w-16 border rounded px-1 py-0.5 text-xs">
                        <button onclick="removeCreditItem(${i})" class="bg-red-100 text-red-700 px-3 py-1 rounded font-bold hover:bg-red-200">Quitar</button>
                    </div>
                </div>`).join('');
            $('editCreditDebt').innerText = `${formatMoney(roundMoney(calculateRealDebt(c) - c.paid))}`;
        }

        function closeEditCreditModal() {
            editCreditId = null;
            $('editCreditModal').classList.add('hidden');
        }

        function removeCreditItem(itemIdx) {
            const c = state.credits.find(x => x.id == editCreditId);
            if (!c) return;
            const qty = parseInt($(`editQty_${itemIdx}`).value, 10);
            const plan = planCreditItemRemoval(c, itemIdx, qty);
            if (plan.error) return alert(plan.error);

            const item = c.items[itemIdx];
            const prod = item.isStub ? null : state.products.find(p => p.id == plan.productId);
            const stockMsg = item.isStub ? 'Es deuda anterior: no se devuelven existencias.'
                : prod ? `Vuelven ${plan.returnQty} al inventario.`
                : 'El producto ya no está en el inventario: no se devuelven existencias.';
            if (!confirm(`¿Quitar ${qty}x ${item.name} del fiado de ${c.customer}? ${stockMsg} Nueva deuda: ${formatMoney(roundMoney(plan.totalDebt - c.paid))}`)) return;

            c.items = plan.items;
            c.totalDebt = plan.totalDebt;
            if (prod) prod.qty = (Number(prod.qty) || 0) + plan.returnQty;
            if (plan.settled) {
                c.paidDate = new Date().toISOString();
                setTimeout(autoPruneCredits, 500);
            }
            saveData();
            renderAll();
            if (plan.settled) {
                closeEditCreditModal();
                setTimeout(() => alert('¡Deuda saldada!'), 100);
            } else renderEditCreditModal();
        }

        function selfTestCreditEdit() {
            const bak = structuredClone({ credits: state.credits, products: state.products, sales: state.sales, creditMode: state.creditMode });
            try {
                state.sales = [];
                state.creditMode = 'FIXED';
                state.products = [{ id: 'p1', price: 1, qty: 0 }, { id: 'p2', price: 5, qty: 0 }];
                const mk = (id) => ({
                    id, customer: 'Ficticio', paid: 0, totalDebt: 30, surcharge: 0,
                    items: [
                        { id: 'p1', name: 'A', price: 1, qty: 5, subtotal: 5 },
                        { id: 'p2', name: 'B', price: 5, qty: 5, subtotal: 25 },
                        { id: 's', name: 'C', price: 0, qty: 1, subtotal: 0, isStub: true }
                    ]
                });
                const c = mk(1);
                const before = JSON.stringify(c);
                let r = planCreditItemRemoval(c, 1, 5);
                console.assert(JSON.stringify(c) === before, 'no muta el fiado');
                console.assert(!r.error && r.totalDebt === 5 && r.returnQty === 5 && r.items.length === 2, 'quitar línea entera');
                r = planCreditItemRemoval(c, 0, 2);
                console.assert(r.items[0].qty === 3 && r.items[0].subtotal === 3 && r.totalDebt === 28, 'quitar parte');
                r = planCreditItemRemoval(c, 2, 1);
                console.assert(!r.error && r.returnQty === 0, 'stub no devuelve');
                for (const q of [0, -1, 6, 1.5]) console.assert(planCreditItemRemoval(c, 0, q).error, 'qty inválida ' + q);
                const one = { ...mk('t'), items: [{ id: 'p1', name: 'A', price: 1, qty: 2, subtotal: 2 }], totalDebt: 2 };
                console.assert(planCreditItemRemoval(one, 0, 2).error, 'último producto');
                console.assert(!planCreditItemRemoval(one, 0, 1).error, 'parte del último sí');
                const paid = { ...mk(2), paid: 10 };
                console.assert(planCreditItemRemoval(paid, 1, 5).error, 'abonado mayor que nuevo total');
                const eq = { ...mk(3), paid: 5 };
                console.assert(planCreditItemRemoval(eq, 1, 5).settled === true, 'abonado igual salda');
                state.creditMode = 'DYNAMIC';
                state.products[0].price = 2;
                r = planCreditItemRemoval(mk(4), 1, 5);
                console.assert(r.totalDebt === 10, 'DYNAMIC usa precio actual');
            } finally {
                state.credits = bak.credits; state.products = bak.products; state.sales = bak.sales; state.creditMode = bak.creditMode;
            }
            console.log('selfTestCreditEdit terminado');
        }

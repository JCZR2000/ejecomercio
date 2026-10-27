        // ==========================================
        // 6. GESTIÓN DE PRODUCTOS (CRUD)
        // ==========================================

        // ==========================================
        // MÓDULO DE GESTIÓN DE INVENTARIO (v43)
        // Reemplaza a: attemptSubmit, editProduct, clearForm
        // ==========================================

        function attemptSubmit() {
            const isEdit = state.editingId !== null;
            
            checkAuth(isEdit ? 'edit' : 'add', () => {
                // 1. Captura de datos
                const name = $('prodName').value.trim();
                const barcode = $('prodBarcode').value.trim();
                const category = $('prodCategory').value.trim();
                const qtyVal = $('prodQty').value;
                const priceVal = $('prodPrice').value;
                
                // 2. Validación
                if (!name) return alert('El nombre es obligatorio');
                if (qtyVal === '' || isNaN(qtyVal)) return alert('Stock inválido');
                if (priceVal === '' || isNaN(priceVal)) return alert('Precio inválido');

                const qty = parseInt(qtyVal);
                const price = parseFloat(priceVal);
                
                // 3. Procesar datos
                if (state.editingId) {
                    // MODO EDICIÓN
                    const idx = state.products.findIndex(p => p.id == state.editingId);
                    if (idx !== -1) {
                        const prod = { ...state.products[idx], name, qty, price, barcode };
                        if (category) prod.category = category; else delete prod.category;
                        // Foto nueva o quitada: se olvida la de Storage (el archivo lo borra pruneStorageImages)
                        if (state.tempImg || state.isImageDeleted) {
                            delete prod.imgUrl;
                            delete prod.imgHash;
                            if (state.tempImg) prod.img = state.tempImg;
                            else delete prod.img;
                        }
                        state.products[idx] = prod;
                    }
                } else {
                    // MODO CREACIÓN
                    const prod = {
                        id: Date.now(),
                        name, qty, price, barcode,
                        img: state.tempImg || null
                    };
                    if (category) prod.category = category;
                    state.products.unshift(prod);
                }

                // 4. Guardar y Refrescar
                saveData();
                renderAll();
                uploadPendingImages(); // en segundo plano; sin sesión o sin conexión no hace nada

                // 5. Limpiar y Cerrar (Aquí es donde fallaba antes)
                cancelEdit(); 
                
                // Mensaje de éxito discreto (Toast)
                // console.log("Producto guardado correctamente");
            });
        }

        function editProduct(id) {
            const p = state.products.find(prod => prod.id == id);
            if (!p) return;

            state.editingId = id;

            // Rellenar formulario
            $('productId').value = p.id;
            $('prodBarcode').value = p.barcode || '';
            $('prodName').value = p.name;
            $('prodQty').value = p.qty;
            $('prodPrice').value = p.price;
            $('prodCategory').value = p.category || '';

            // Imagen
            if (productImageSrc(p)) {
                $('imgPreview').src = productImageSrc(p);
                $('imgPreview').classList.remove('hidden');
                $('imgIcon').classList.add('hidden');
                $('btnRemoveImg').classList.remove('hidden');
            } else {
                $('imgPreview').classList.add('hidden');
                $('imgIcon').classList.remove('hidden');
                $('btnRemoveImg').classList.add('hidden');
            }

            // Cambiar botones
            const btn = $('submitBtn');
            if(btn) {
                btn.innerHTML = '<i class="fa-solid fa-pen"></i> <span>Actualizar</span>';
                btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                btn.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
            }
            
            const btnCancel = $('cancelEditBtn');
            if(btnCancel) {
                btnCancel.classList.remove('hidden');
                btnCancel.onclick = cancelEdit;
            }

            // Abrir menú
            toggleProductManager(true);
            $('inventoryContainer').scrollIntoView({ behavior: 'smooth' });
        }

        // Wrapper para el botón "Limpiar" del HTML
        function clearForm() {
            cancelEdit();
        }

        function cancelEdit() {
            // 1. Limpiar variables de estado
            state.editingId = null;
            state.tempImg = null;
            state.isImageDeleted = false;

            // 2. Limpiar Inputs Manualmente (Importante para Material UI)
            $('prodName').value = '';
            $('prodBarcode').value = '';
            $('prodQty').value = '';
            $('prodPrice').value = '';
            $('prodCategory').value = '';
            $('prodImg').value = '';
            $('productId').value = '';

            // 3. Resetear Imagen Visual
            $('imgPreview').src = '';
            $('imgPreview').classList.add('hidden');
            $('imgIcon').classList.remove('hidden');
            const btnRemove = $('btnRemoveImg');
            if(btnRemove) btnRemove.classList.add('hidden');

            // 4. Restaurar Botones
            const btn = $('submitBtn');
            if(btn) {
                btn.innerHTML = '<i class="fa-solid fa-save"></i> <span>Guardar</span>';
                btn.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
                btn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
            }
            if($('cancelEditBtn')) $('cancelEditBtn').classList.add('hidden');

            // 5. CERRAR ACORDEÓN (El toque final)
            toggleProductManager(false);
        }

        function exitEditMode() {
            // 1. Limpiar estado interno
            state.activeCreditId = null;
            
            // 2. Limpiar Inputs (CON SEGURIDAD)
            // Usamos 'if' para asegurar que el input existe antes de limpiarlo
            if($('customerName')) $('customerName').value = '';
            state.posClientId = null;
            hideClientPicker();
            if($('initialPayUSD')) $('initialPayUSD').value = '';
            if($('initialPayBS')) $('initialPayBS').value = '';
            if($('paymentScheduleSelect')) $('paymentScheduleSelect').value = '';
            toggleCustomDate();

            // 3. Restaurar UI del Modal
            const container = $('posContainer');
            if(container) container.classList.remove('edit-mode'); 
            
            if($('posTitle')) $('posTitle').textContent = 'Carrito';
            if($('editModeBadge')) $('editModeBadge').classList.add('hidden');
            
            // Ocultar caja naranja y restaurar input normal
            if($('creditConfig')) $('creditConfig').classList.add('hidden'); 
            if($('newCreditInputs')) $('newCreditInputs').classList.remove('hidden');

            // --- NUEVO: OCULTAR EL BOTÓN CANCELAR ---
            const btnCancel = $('btnCancelCreditMode');
            if (btnCancel) {
                btnCancel.classList.add('hidden');
                btnCancel.classList.remove('flex');
            }
            // ----------------------------------------

            // 4. Restaurar Switch y Botón Principal
            const switchCredit = $('isCreditSale');
            if(switchCredit) {
                switchCredit.checked = false;
                switchCredit.disabled = false; // Desbloquear switch
            }
            
            toggleCreditUI(false); // Volver a modo "Venta Normal"

            // 5. Opcional: Cerrar modal si así lo prefieres
            toggleCartModal(false);
            
            console.log("Modo edición cancelado correctamente.");
        }

        // --- PUENTE PARA EL CHECKBOX "ES FIADO" ---
        function toggleCreditModeUI() {
            const checkbox = $('isCreditSale');
            if (checkbox) {
                // Llamamos a la lógica principal con el estado del checkbox (true/false)
                toggleCreditUI(checkbox.checked);
            }
        }

        function requestDelete(id) {
            checkAuth('edit', () => {
                if (confirm('¿Borrar producto?')) {
                    state.products = state.products.filter(p => p.id != id);
                    saveData();
                    renderAll();
                }
            });
        }

        function requestAction(action) {
            checkAuth('wipe', () => {
                clearData(action);
            });
        }

        function requestPayCredit(id) {
            checkAuth('credit_pay', () => startPayCredits(id));
        }


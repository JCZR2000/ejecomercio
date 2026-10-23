        // ==========================================
        // 24. UI MATERIAL YOU (v43)
        // ==========================================
        
        // --- A. LÓGICA VISUAL (ACORDEÓN) ---
        // Esta función es la que faltaba o estaba fallando
        function toggleProductManager(forceOpen = null) {
            const panel = $('productFormPanel');
            const chevron = $('mgrChevron');
            const container = $('inventoryContainer');
            
            if (!panel || !chevron || !container) return; // Protección contra errores

            // Calcular estado actual
            const isClosed = panel.style.maxHeight === '0px' || !panel.style.maxHeight;
            const shouldOpen = forceOpen !== null ? forceOpen : isClosed;

            if (shouldOpen) {
                // ABRIR
                panel.style.maxHeight = panel.scrollHeight + "px"; 
                chevron.style.transform = 'rotate(180deg)';
                container.classList.remove('bg-indigo-50');
                container.classList.add('bg-white', 'shadow-lg', 'ring-1', 'ring-indigo-100');
            } else {
                // CERRAR
                panel.style.maxHeight = '0px';
                chevron.style.transform = 'rotate(0deg)';
                container.classList.add('bg-indigo-50');
                container.classList.remove('bg-white', 'shadow-lg', 'ring-1', 'ring-indigo-100');
            }
        }

        // Actualización de la Navbar (Estilo Píldoras)
        function updateMaterialNav(activeTab) {
            // Reiniciar todos a estado inactivo
            ['home', 'credits', 'history'].forEach(tab => {
                const pill = $(`nav-pill-${tab}`);
                const btn = $(`nav-btn-${tab}`).querySelector('span');
                
                if (tab === activeTab) {
                    // Activar
                    pill.className = "w-16 h-8 rounded-full flex items-center justify-center bg-indigo-200 text-indigo-800 transition-all duration-300 mb-1 shadow-sm";
                    btn.classList.add('text-indigo-700');
                    btn.classList.remove('text-gray-500');
                } else {
                    // Desactivar
                    pill.className = "w-16 h-8 rounded-full flex items-center justify-center bg-transparent text-gray-400 transition-all duration-300 mb-1";
                    btn.classList.remove('text-indigo-700');
                    btn.classList.add('text-gray-500');
                }
            });
        }

        function clearCart() {
            if (state.cart.length === 0) return; // No hacer nada si ya está vacío
            
            // Preguntar solo si hay cosas importantes
            if (!confirm('¿Estás seguro de vaciar todo el carrito?')) return;

            state.cart = [];
            
            // Limpiezas adicionales
            $('stockHint').textContent = '';
            $('saleProductSelect').value = '';
            $('posSearchInput').value = '';
            
            renderCart();
            // Feedback vibración (móvil)
            if(navigator.vibrate) navigator.vibrate(50);
        }

        // ==========================================
        // CONTROLADOR DEL MODAL DE SEGURIDAD (Material You)
        // ==========================================
        let securityCallback = null; // Función a ejecutar al confirmar

        function askForMasterKey(title, description, isDismissible, callback) {
            // 1. Configurar textos
            document.getElementById('secModalTitle').textContent = title;
            document.getElementById('secModalDesc').textContent = description;
            
            // 2. Limpiar input
            const input = document.getElementById('secModalInput');
            input.value = '';
            
            // 3. Configurar botón Cancelar
            const btnCancel = document.getElementById('secModalCancel');
            if (!isDismissible) {
                btnCancel.classList.add('hidden'); // Si es obligatorio (Login), no se puede cancelar
            } else {
                btnCancel.classList.remove('hidden');
            }

            // 4. Guardar la acción futura
            securityCallback = callback;

            // 5. Mostrar Modal
            document.getElementById('securityModal').classList.remove('hidden');
            input.focus();
        }

        function closeSecurityModal() {
            document.getElementById('securityModal').classList.add('hidden');
            securityCallback = null;
        }

        // Evento del botón Confirmar
        document.getElementById('secModalConfirm').onclick = () => {
            const key = document.getElementById('secModalInput').value;
            if (!key) return; // No aceptar vacío
            
            if (securityCallback) {
                // Ejecutamos la función que estaba esperando la clave
                securityCallback(key);
            }
        };

        // Permitir "Enter" para confirmar
        document.getElementById('secModalInput').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') document.getElementById('secModalConfirm').click();
        });

        // ==========================================
        // SISTEMA DE DIÁLOGOS (Reemplazo de Alert/Confirm)
        // ==========================================
        
        // 1. Alerta Simple (Éxito o Error)
        function customAlert(title, msg, type = 'success', callback = null) {
            const modal = $('dialogModal');
            const iconBg = $('dialogIconBg');
            const icon = $('dialogIcon');
            const btnContainer = $('dialogButtons');

            $('dialogTitle').textContent = title;
            $('dialogMsg').textContent = msg;

            // Configuración Visual
            if (type === 'success') {
                iconBg.className = "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm bg-green-100";
                icon.className = "fa-solid fa-check text-3xl text-green-600";
            } else if (type === 'error') {
                iconBg.className = "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm bg-red-100";
                icon.className = "fa-solid fa-xmark text-3xl text-red-600";
            } else {
                iconBg.className = "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm bg-blue-100";
                icon.className = "fa-solid fa-info text-3xl text-blue-600";
            }

            // Botón Aceptar
            btnContainer.innerHTML = `
                <button onclick="closeDialog()" class="w-full py-3 rounded-xl bg-slate-800 text-white font-bold shadow-lg hover:bg-slate-900 transition text-sm">
                    Entendido
                </button>
            `;

            // Guardamos callback para ejecutar al cerrar (si existe)
            window.dialogCallback = callback;
            
            modal.classList.remove('hidden');
        }

        // 2. Confirmación (Si / No)
        function customConfirm(title, msg, type = 'warning', onConfirm) {
            const modal = $('dialogModal');
            const iconBg = $('dialogIconBg');
            const icon = $('dialogIcon');
            const btnContainer = $('dialogButtons');

            $('dialogTitle').textContent = title;
            $('dialogMsg').textContent = msg;

            // Estilo de Advertencia
            iconBg.className = "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm bg-yellow-100";
            icon.className = "fa-solid fa-triangle-exclamation text-3xl text-yellow-600";

            // Botones Cancelar / Confirmar
            btnContainer.innerHTML = '';
            
            const btnCancel = document.createElement('button');
            btnCancel.className = "flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition text-sm";
            btnCancel.textContent = "Cancelar";
            btnCancel.onclick = closeDialog;

            const btnOk = document.createElement('button');
            btnOk.className = "flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold shadow-lg hover:bg-slate-900 transition text-sm";
            btnOk.textContent = "Confirmar";
            btnOk.onclick = () => {
                closeDialog();
                if (onConfirm) onConfirm();
            };

            btnContainer.appendChild(btnCancel);
            btnContainer.appendChild(btnOk);
            
            window.dialogCallback = null;
            modal.classList.remove('hidden');
        }

        // Aviso de progreso que bloquea la pantalla mientras la nube trabaja. Se puede anidar.
        let busyDepth = 0, busyTimer = null;
        function busyStart(msg) {
            if (busyDepth++ === 0) {
                const el = document.createElement('div');
                el.id = 'busyOverlay';
                el.className = 'fixed inset-0 z-[400] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4';
                el.innerHTML = '<div class="bg-white rounded-2xl shadow-2xl max-w-xs w-full p-6 text-center">' +
                    '<i class="fa-solid fa-rotate fa-spin text-3xl text-amber-500 mb-3"></i>' +
                    '<h3 id="busyMsg" class="text-lg font-black text-slate-800 mb-1"></h3>' +
                    '<p class="text-sm text-gray-500">Espera un momento.</p>' +
                    '<p id="busySlow" class="text-sm text-amber-600 font-bold mt-2 hidden">La conexión está lenta. No cierres la app hasta que termine.</p></div>';
                document.body.appendChild(el);
                busyTimer = setTimeout(() => { const s = $('busySlow'); if (s) s.classList.remove('hidden'); }, 6000);
            }
            $('busyMsg').textContent = msg;
        }
        function busyEnd() {
            if (busyDepth > 0 && --busyDepth === 0) {
                clearTimeout(busyTimer);
                const el = $('busyOverlay');
                if (el) el.remove();
            }
        }
        // La subida de saveData() es en segundo plano: se espera a que termine.
        async function waitForUpload() {
            while (isUploadingToCloud) await new Promise(r => setTimeout(r, 300));
        }

        function closeDialog() {
            $('dialogModal').classList.add('hidden');
            if (window.dialogCallback) {
                window.dialogCallback();
                window.dialogCallback = null;
            }
        }

        // ==========================================
        // 25. REINICIO DE RED (SOLUCIÓN NUCLEAR)
        // ==========================================
        function forceNetworkReconnect() {
            const btn = document.getElementById('cloudSyncBtn');
            // Guardamos el icono original para restaurarlo luego
            const originalIcon = '<i class="fa-solid fa-cloud-arrow-up"></i>';
            
            console.log("🔌 Reiniciando conexión con Google...");
            
            // 1. Feedback Visual: Se pone Rojo y muestra un enchufe
            // Esto le dice al usuario "Estoy haciendo algo drástico, espera"
            updateCloudStatus('OFFLINE'); 
            btn.innerHTML = '<i class="fa-solid fa-plug-circle-xmark fa-fade"></i>';
            btn.classList.replace('bg-indigo-600', 'bg-red-600');
            btn.classList.replace('border-indigo-400', 'border-red-400');
            btn.disabled = true; // Evitar doble clic compulsivo

            // 2. Apagamos la radio de Firebase (Corte de señal)
            db.disableNetwork().then(() => {
                
                // Esperamos 1.5 segundos para asegurar que el corte limpie la tubería
                setTimeout(() => {
                    
                    // 3. La encendemos de nuevo (Reconexión Limpia)
                    db.enableNetwork().then(() => {
                        console.log("⚡ Conexión restablecida. Ejecutando guardado...");
                        
                        // 4. Restaurar botón a su estado normal (Azul)
                        btn.innerHTML = originalIcon;
                        btn.classList.replace('bg-red-600', 'bg-indigo-600');
                        btn.classList.replace('border-red-400', 'border-indigo-400');
                        btn.disabled = false;
                        
                        // 5. ¡GOLPE FINAL! Guardamos de inmediato aprovechando la conexión fresca
                        saveData(); 
                        
                    });
                    
                }, 1500); 
                
            }).catch(err => {
                console.error("Error reiniciando red:", err);
                alert("Error al reiniciar la red. Por favor recarga la página.");
                btn.innerHTML = originalIcon;
                btn.classList.replace('bg-red-600', 'bg-indigo-600');
                btn.disabled = false;
            });
        }


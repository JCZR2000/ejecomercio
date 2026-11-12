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
            
            customConfirm('Vaciar carrito', '¿Estás seguro de vaciar todo el carrito?', 'danger', () => {
                state.cart = [];

                // Limpiezas adicionales
                $('stockHint').textContent = '';
                $('saleProductSelect').value = '';
                $('posSearchInput').value = '';

                renderCart();
                // Feedback vibración (móvil)
                if(navigator.vibrate) navigator.vibrate(50);
            }, 'Sí, vaciar');
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
        // SISTEMA DE DIÁLOGOS (Reemplazo de Alert/Confirm/Prompt del navegador)
        // ==========================================
        const DIALOG_COLORS = { success: 'bg-green-100 text-green-600', error: 'bg-red-100 text-red-600', warning: 'bg-yellow-100 text-yellow-600', info: 'bg-blue-100 text-blue-600', danger: 'bg-red-100 text-red-600' };
        // Dibujos de 64x64; las animaciones (una sola pasada) están en css/app.css (.dlg-ico).
        const DIALOG_ICONS = {
            success: '<circle class="d-draw" pathLength="100" cx="32" cy="32" r="26"/><path class="d-draw d2" pathLength="100" d="M20 33l9 9 16-18"/>',
            error: '<circle class="d-draw" pathLength="100" cx="32" cy="32" r="26"/><path class="d-draw d2" pathLength="100" d="M23 23l18 18M41 23L23 41"/>',
            warning: '<g class="d-pop"><path d="M32 8L58 54H6z"/></g><g class="d-blink"><path d="M32 24v15"/><circle class="d-fill" cx="32" cy="46" r="2"/></g>',
            info: '<circle cx="32" cy="32" r="26"/><path d="M32 30v15"/><circle class="d-fill d-drop" cx="32" cy="21" r="2.5"/>',
            danger: '<g class="d-lid"><path d="M12 18h40M25 18v-5h14v5"/></g><path d="M17 24l3 31h24l3-31M27 30v18M37 30v18"/>',
            sale: '<g class="d-hop"><path d="M14 26h36l-3 28H17z"/><path d="M24 26v-5a8 8 0 0116 0v5"/></g><path class="d-spark" d="M8 12l4 4M56 12l-4 4M32 4v5"/>',
            cloud: '<path d="M17 42a10 10 0 010-20 14 14 0 0128 2 9 9 0 010 18z"/><g class="d-up"><path d="M32 38V25M26 30l6-6 6 6"/></g>',
            lock: '<path class="d-shackle" d="M22 28v-7a10 10 0 0120 0v7"/><rect x="14" y="28" width="36" height="26" rx="5"/><circle class="d-fill" cx="32" cy="41" r="3"/>',
            camera: '<rect x="8" y="18" width="48" height="34" rx="6"/><path d="M22 18l3-6h14l3 6"/><circle cx="32" cy="35" r="9"/><path class="d-scan" d="M20 35h24"/>',
            offline: '<path class="d-wave w3" d="M6 26a36 36 0 0152 0"/><path class="d-wave w2" d="M14 34a25 25 0 0136 0"/><path class="d-wave w1" d="M22 42a14 14 0 0120 0"/><circle class="d-fill" cx="32" cy="51" r="2.5"/>',
            box: '<path d="M10 28v22l22 9 22-9V28M32 38v21"/><path class="d-flap" d="M10 28l22-12 22 12-22 10z"/>'
        };
        const dialogIconSvg = name => '<svg class="dlg-ico' + (name === 'error' ? ' d-shake' : '') + '" viewBox="0 0 64 64" aria-hidden="true">' + (DIALOG_ICONS[name] || DIALOG_ICONS.info) + '</svg>';

        let dialogCurrent = null, dialogQueue = [], dialogFocusBack = null;

        function showDialog(d) {
            dialogCurrent = d;
            dialogFocusBack = document.activeElement;
            const btns = $('dialogButtons');
            $('dialogTitle').textContent = d.title;
            $('dialogMsg').textContent = d.msg;
            $('dialogIconBg').className = 'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm ' + (DIALOG_COLORS[d.type] || DIALOG_COLORS.info);
            $('dialogIconBg').innerHTML = dialogIconSvg(d.icon || d.type);
            btns.textContent = '';
            const mk = (text, cls, fn) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = cls + ' py-3 rounded-xl font-bold transition text-sm';
                b.textContent = text;
                b.onclick = fn;
                btns.appendChild(b);
                return b;
            };
            let focusBtn;
            if (d.confirm) {
                const cancel = mk('Cancelar', 'flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50', () => closeDialog(false));
                const ok = mk(d.okLabel || 'Confirmar', 'flex-1 text-white shadow-lg ' + (d.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-900'),
                    () => { if (closeDialog(true) && d.onConfirm) d.onConfirm(); }); // cierra antes de actuar: no se confirma dos veces
                focusBtn = d.type === 'danger' ? cancel : ok;
                window.dialogCallback = null;
            } else {
                focusBtn = mk('Entendido', 'w-full bg-slate-800 text-white shadow-lg hover:bg-slate-900', () => closeDialog(true));
                window.dialogCallback = d.callback; // otros módulos lo leen y lo encadenan (warnStorageFull)
            }
            if (d.extra) $('dialogMsg').appendChild(d.extra);
            $('dialogModal').classList.remove('hidden');
            focusBtn.focus();
        }

        function queueDialog(d) {
            d.promise = new Promise(r => { d.resolve = r; });
            if (!d.confirm) { // un aviso idéntico al abierto o en cola no se repite
                const same = x => !x.confirm && x.title === d.title && x.msg === d.msg;
                const dup = (dialogCurrent && same(dialogCurrent)) ? dialogCurrent : dialogQueue.find(same);
                if (dup) return dup.promise;
            }
            if (dialogCurrent) dialogQueue.push(d); else showDialog(d);
            return d.promise;
        }

        // 1. Aviso. Devuelve una promesa que se resuelve al cerrar; el callback también se ejecuta al cerrar.
        function customAlert(title, msg, type = 'success', callback = null, icon = null) {
            return queueDialog({ title, msg, type, callback, icon });
        }

        // 2. Confirmación. Promise<boolean>; onConfirm se ejecuta al confirmar. extra: nodo opcional bajo el mensaje.
        function customConfirm(title, msg, type = 'warning', onConfirm = null, okLabel = 'Confirmar', icon = null, extra = null) {
            return queueDialog({ title, msg, type, onConfirm, okLabel, icon, extra, confirm: true });
        }

        function closeDialog(result = false) {
            const d = dialogCurrent;
            if (!d) return false;
            dialogCurrent = null;
            $('dialogModal').classList.add('hidden');
            const cb = window.dialogCallback;
            window.dialogCallback = null;
            const back = dialogFocusBack;
            dialogFocusBack = null;
            try { if (back && back.isConnected && back.focus) back.focus(); } catch (e) { /* sin foco que devolver */ }
            d.resolve(d.confirm ? !!result : undefined);
            queueMicrotask(() => { if (!dialogCurrent && dialogQueue.length) showDialog(dialogQueue.shift()); });
            if (cb) cb();
            return true;
        }

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && dialogCurrent) { e.preventDefault(); e.stopPropagation(); closeDialog(false); }
        }, true);

        // Autoprueba: ejecutar a mano desde la consola. Con un cuadro ya abierto no es fiable.
        async function selfTestDialogs() {
            const order = [], title = () => $('dialogTitle').textContent;
            const p1 = customAlert('T1', 'm1', 'info', () => order.push(1));
            const p2 = customAlert('T2', 'm2', 'info', () => order.push(2));
            customAlert('T1', 'm1', 'info', () => order.push(99));
            console.assert(dialogQueue.length === 1, 'un aviso repetido no debe encolarse');
            console.assert(title() === 'T1', 'el primero se muestra primero');
            closeDialog(true); await p1; await Promise.resolve();
            console.assert(title() === 'T2', 'el segundo sale al cerrar el primero');
            closeDialog(true); await p2;
            console.assert(order.join() === '1,2', 'los dos callback se ejecutan en orden: ' + order);
            let n = 0, c = customConfirm('C', 'x', 'warning', () => n++);
            $('dialogButtons').lastChild.click(); $('dialogButtons').lastChild.click();
            console.assert(await c === true && n === 1, 'confirmar resuelve true y actúa una sola vez');
            c = customConfirm('C', 'x', 'danger', () => n++);
            console.assert(document.activeElement === $('dialogButtons').firstChild, 'en danger el foco empieza en Cancelar');
            $('dialogButtons').firstChild.click();
            console.assert(await c === false && n === 1, 'cancelar resuelve false sin actuar');
            c = customConfirm('C', 'x');
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            console.assert(await c === false, 'Escape resuelve false');
            console.assert($('dialogModal').classList.contains('hidden'), 'queda cerrado');
            console.log('selfTestDialogs terminada');
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
                customAlert('Error de red', 'Error al reiniciar la red. Por favor recarga la página.', 'error', null, 'offline');
                btn.innerHTML = originalIcon;
                btn.classList.replace('bg-red-600', 'bg-indigo-600');
                btn.disabled = false;
            });
        }


        // ==========================================
        // Salida de las ventanas en móvil: baja hacia abajo
        // ==========================================
        // Las ventanas se ocultan desde muchos sitios con classList.add('hidden'). La ventana real se oculta al
        // instante (la lógica no cambia); encima se pone una copia de lo que se veía y esa copia baja y se borra.
        (function () {
            const isModal = el => el.classList && (el.classList.contains('modal-bg') || el.classList.contains('modal-in'));
            const animate = () => matchMedia('(max-width: 639px)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
            new MutationObserver(records => {
                if (!animate()) return;
                records.forEach(r => {
                    const el = r.target;
                    if (!isModal(el) || el.classList.contains('modal-closing')) return;
                    const wasHidden = /(^|\s)hidden(\s|$)/.test(r.oldValue || '');
                    if (wasHidden || !el.classList.contains('hidden')) return;
                    // Copia ahora, antes de que el código cambie el contenido (p. ej. el siguiente cuadro de la cola)
                    const ghost = el.cloneNode(true);
                    ghost.classList.remove('hidden');
                    ghost.classList.add('modal-closing');
                    ghost.setAttribute('aria-hidden', 'true');
                    ghost.removeAttribute('id');
                    const src = el.querySelectorAll('*'), dst = ghost.querySelectorAll('*');
                    dst.forEach((d, i) => {
                        d.removeAttribute('id'); // sin ids repetidos mientras dura la copia
                        if ('value' in src[i] && d.tagName !== 'BUTTON') { try { d.value = src[i].value; d.checked = src[i].checked; } catch (e) { /* input de archivo */ } }
                    });
                    requestAnimationFrame(() => {
                        if (!el.classList.contains('hidden')) return; // se volvió a abrir enseguida: sin salida
                        document.body.appendChild(ghost);
                        dst.forEach((d, i) => { if (src[i].scrollTop) d.scrollTop = src[i].scrollTop; });
                        const done = () => ghost.remove();
                        ghost.addEventListener('animationend', e => { if (e.target === ghost) done(); });
                        setTimeout(done, 600); // por si no llega animationend
                    });
                });
            }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
        })();

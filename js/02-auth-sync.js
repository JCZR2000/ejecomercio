        // ------------------------------------------
        // LÓGICA DE AUTENTICACIÓN BLINDADA (v41.2)
        // ------------------------------------------
        
        // 1. Configurar persistencia
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

        // 2. Función Centralizada de UI (El Cerebro Visual)
        function renderUserUI(user) {
            const btnAuth = document.getElementById('btnAuthAction');
            const txtAuth = document.getElementById('textAuthAction');
            const iconAuth = document.getElementById('iconAuthAction');
            
            const userName = document.getElementById('userNameDisplay');
            const userEmail = document.getElementById('userEmailDisplay');
            const avatar = document.getElementById('userAvatar');
            const icon = document.getElementById('userIcon');

            if (user) {
                // MODO: CONECTADO
                userName.textContent = user.displayName || 'Usuario';
                userEmail.textContent = user.email;
                
                if(user.photoURL) {
                    avatar.src = user.photoURL;
                    avatar.classList.remove('hidden');
                    icon.classList.add('hidden');
                }

                // Botón se convierte en "Cerrar Sesión" (Rojo)
                txtAuth.textContent = "Cerrar Sesión";
                iconAuth.className = "fa-solid fa-right-from-bracket";
                btnAuth.className = "w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition";
            
            } else {
                // MODO: DESCONECTADO / OFFLINE
                userName.textContent = "Modo Offline";
                userEmail.textContent = "Sin sincronización";
                avatar.classList.add('hidden');
                icon.classList.remove('hidden');

                // Botón se convierte en "Iniciar Sesión" (Azul)
                txtAuth.textContent = "Iniciar Sesión";
                iconAuth.className = "fa-solid fa-right-to-bracket";
                btnAuth.className = "w-full text-left px-4 py-3 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 transition";
            }
        }

        // 3. Ejecutar renderizado inicial (Para evitar parpadeos)
        renderUserUI(null); // Asumimos desconectado al arrancar

        // 4. Lógica de Arranque Rápido (Quitar cortina si hay datos)
        if (state.products && state.products.length > 0) {
            document.getElementById('loginOverlay').classList.add('hidden');
            updateCloudStatus('OFFLINE'); 
        } else {
            document.getElementById('loginOverlay').classList.remove('hidden');
        }

        // 5. Monitor de Firebase (La Verdad Absoluta)
        auth.onAuthStateChanged(user => {
            const loginOverlay = document.getElementById('loginOverlay');
            const loginStatus = document.getElementById('loginStatus');

            // Actualizamos la UI con la verdad de Firebase
            renderUserUI(user);

            if (user) {
                console.log("✅ Auth: Conectado");
                loginOverlay.classList.add('hidden');
                loginStatus.classList.add('hidden');
                initDataSync(user); // Arrancar sincronización
            } else {
                console.log("💤 Auth: Desconectado");
                updateCloudStatus('OFFLINE');

                // Si no hay usuario (modo offline), cargamos las tasas de una vez.
                // Aquí NO hay riesgo de conflicto porque no hay nube con qué chocar.
                if (!hasInitialRatesUpdate) {
                    hasInitialRatesUpdate = true;
                    fetchAllRates();
                }
                
                // Si no hay datos y no hay usuario, mostramos login.
                // Si hay datos, dejamos al usuario trabajar offline.
                if (state.products.length === 0) {
                    loginOverlay.classList.remove('hidden');
                    loginStatus.classList.add('hidden');
                }
                if (unsubscribe) unsubscribe();
            }
        });

        // 6. Botón Inteligente
        function handleAuthAction() {
            const user = auth.currentUser;
            if (user) {
                if(confirm("¿Cerrar sesión y detener sincronización?")) {
                    auth.signOut().then(() => location.reload());
                }
            } else {
                loginWithGoogle();
            }
        }

        // Bandera para evitar doble clic
        let isLoggingIn = false;

        function loginWithGoogle() {
            if (isLoggingIn) return; // Si ya está cargando, no hacemos nada
            isLoggingIn = true;

            const provider = new firebase.auth.GoogleAuthProvider();
            const statusText = document.getElementById('loginStatus');
            
            // Feedback visual si la cortina está visible
            if(!document.getElementById('loginOverlay').classList.contains('hidden')) {
                statusText.textContent = "Cargando Google...";
                statusText.classList.remove('hidden');
            }

            auth.signInWithPopup(provider)
                .then(() => {
                    // Éxito: El onAuthStateChanged se encarga
                })
                .catch(error => {
                    // Filtro de Errores: Solo mostramos alerta si es un error REAL
                    const ignoredErrors = [
                        'auth/cancelled-popup-request', // Doble clic
                        'auth/popup-closed-by-user',    // Usuario cerró la ventana
                        'auth/popup-blocked'            // Navegador bloqueó (a veces se recupera solo)
                    ];

                    if (!ignoredErrors.includes(error.code)) {
                        console.error("Login Error:", error);
                        alert("Aviso: " + error.message);
                    } else {
                        console.log("Aviso menor de login:", error.code);
                    }
                })
                .finally(() => {
                    // Liberamos el botón pase lo que pase
                    isLoggingIn = false;
                    if(statusText) statusText.classList.add('hidden');
                });
        }

        function logout() {
            if(confirm("¿Cerrar sesión y detener sincronización?")) {
                auth.signOut();
                location.reload();
            }
        }

        // ==========================================
        // UI: SEMÁFORO DE SINCRONIZACIÓN
        // ==========================================

        function updateCloudStatus(status) {
            currentCloudState = status; // Guardar estado actual
            
            // Buscamos los NUEVOS elementos del HTML
            const dot = document.getElementById('statusDot');
            const ping = document.getElementById('statusPing');

            // Protección: Si no existen (aún no carga el HTML), no hacemos nada
            if (!dot || !ping) return;

            // 1. Limpiar clases (Estado Base)
            dot.className = "w-3 h-3 rounded-full transition-all duration-500 shadow-lg";
            ping.className = "hidden"; // Ocultar animación por defecto

            if (status === 'ONLINE') {
                // VERDE: Sincronizado y Seguro
                dot.classList.add('bg-emerald-500', 'shadow-[0_0_10px_rgba(16,185,129,0.6)]');
            } 
            else if (status === 'SYNCING') {
                // AMARILLO: Trabajando...
                dot.classList.add('bg-amber-400', 'shadow-[0_0_10px_rgba(251,191,36,0.6)]');
                // Activamos la animación de onda (ping)
                ping.className = "absolute inset-0 m-auto w-3.5 h-3.5 rounded-full bg-amber-400 animate-ping opacity-75";
            } 
            else if (status === 'OFFLINE') {
                // ROJO: Sin conexión
                dot.classList.add('bg-rose-600', 'shadow-[0_0_10px_rgba(225,29,72,0.6)]');
            }
        }

        // Listeners del Navegador (Actualizados)
        window.addEventListener('online', () => updateCloudStatus('ONLINE'));
        window.addEventListener('offline', () => updateCloudStatus('OFFLINE'));

        // -------------------------------------------------------------
        // LÓGICA DE SINCRONIZACIÓN (NUBE <-> LOCAL) [Con soporte E2EE]
        // -------------------------------------------------------------
        
        // Variables para el control de conflictos
        let pendingCloudSnapshot = null;
        let isFirstSyncCheck = true;

        function initDataSync(user) {
            const docRef = db.collection('users').doc(user.uid);

            // Reiniciamos bandera al conectar una nueva sesión
            isFirstSyncCheck = true;

            // Escuchar cambios INCLUYENDO METADATA
            unsubscribe = docRef.onSnapshot({ includeMetadataChanges: true }, doc => {

                // ----------------------------------------------------
                // NUEVA LÓGICA DE SEMÁFORO ESTRICTO (EL JUEZ) 🛡️
                // ----------------------------------------------------

                // Estado de depuración (Opcional, para ver en consola qué pasa)
                console.log(`Estado Nube: Pending=${doc.metadata.hasPendingWrites}, Cache=${doc.metadata.fromCache}, UploadLock=${isUploadingToCloud}`);

                // 1. CONDICIÓN DE BLOQUEO: Si hay algo pendiente, es AMARILLO.
                if (doc.metadata.hasPendingWrites || isUploadingToCloud) {
                    updateCloudStatus('SYNCING');
                }
                // 2. Si viene de caché (aún no confirmado por servidor), es AMARILLO.
                else if (doc.metadata.fromCache) {
                    updateCloudStatus('SYNCING');
                }
                // 3. SOLO si todo está limpio, es VERDE.
                else {
                    updateCloudStatus('ONLINE');
                }

                // ----------------------------------------------------

                if (doc.exists) {
                    const cloudData = doc.data();
                    let finalCloudData = null; // Datos candidatos a ser cargados

                    // -------------------------------------------------
                    // FASE DE DESENCRIPTACIÓN 🔓
                    // -------------------------------------------------
            
                    // CASO A: Datos vienen ENCRIPTADOS
                    if (cloudData.isEncrypted && cloudData.encryptedData) {
                
                        // Intentamos desencriptar con la llave que tengamos en memoria
                        finalCloudData = decryptPayload(cloudData.encryptedData);

                        // 2. Si falla (no hay clave o es incorrecta), mostramos el MODAL
                        if (!finalCloudData) {

                            // Función que se ejecutará cuando el usuario ponga la clave en el modal
                            const handleKeyInput = (userInput) => {
                                encryptionKey = userInput;
                                const success = decryptPayload(cloudData.encryptedData);

                                if (success) {
                                    // ÉXITO
                                    localStorage.setItem('inv_enc_key', encryptionKey);
                                    closeSecurityModal();

                                    // REENRUTAMIENTO: En vez de cargar directo, pasamos al validador
                                    hydrateCloudData(success, doc);
                                } else {
                                    // FALLO
                                    alert("❌ Clave incorrecta.");
                                    document.getElementById('secModalInput').value = '';
                                    document.getElementById('secModalInput').focus();
                                    // No cerramos el modal, lo dejamos intentar de nuevo
                                }
                            };

                            // Lanzamos el modal (No cancelable porque es necesario para ver datos)
                            askForMasterKey(
                                "DATOS PROTEGIDOS",
                                "Esta base de datos está encriptada. Ingresa tu Clave Maestra:",
                                false, // No se puede cancelar
                                handleKeyInput
                            );

                            // Detenemos la ejecución aquí. El 'handleKeyInput' retomará el trabajo.
                            return;
                        } else {
                            console.log("🔓 Datos desencriptados automáticamente.");
                        }

                    } 

                    // CASO B: Datos NORMALES (Texto plano / Usuario Default)
                    else {
                        finalCloudData = cloudData;

                        // 🛠️ FIX BUG ENCRIPTACIÓN: Si la nube dice que NO hay encriptación,
                        // pero este dispositivo local tiene una clave guardada, significa que la 
                        // desactivamos en OTRO dispositivo. Destruimos la clave fantasma localmente.
                        if (encryptionKey && !cloudData.isEncrypted) {
                            console.log("🗑️ Nube desencriptada detectada. Borrando clave local fantasma...");
                            encryptionKey = null;
                            localStorage.removeItem('inv_enc_key');

                            // Si el usuario tiene el menú de config abierto justo en ese segundo, refrescamos la UI
                            if (!$('configModal').classList.contains('hidden')) {
                                renderEncryptionUI();
                            }
                        }
                    }

                    // -------------------------------------------------
                    // FASE DE VALIDACIÓN (El nuevo intermediario)
                    // -------------------------------------------------
                    if (finalCloudData) {
                        // En lugar de llamar a finishLoadingData directo, llamamos a processSyncData
                        hydrateCloudData(finalCloudData, doc);
                    }

                } else {
                    // CASO C: Usuario Nuevo en Nube -> Subir Local
                    // Aquí SI usamos saveData() porque queremos empujar lo local a la nube
                    console.log("⬆️ Usuario nuevo: Subiendo datos locales...");
                    state.isCloudSynced = true; 
                    setCloudManifest({}); // el manifiesto guardado pudo ser de otra cuenta
                    saveData(); 
                }
            }, error => {
                console.error("Error Sync:", error);
                updateCloudStatus('OFFLINE'); // Rojo si falla la conexión
            });
        }

        // --- FUNCIÓN: Rearma el documento completo (con fotos y ventas) desde los trozos de la nube ---
        let hydrateSeq = 0;
        async function hydrateCloudData(cloudData, doc, attempt = 0) {
            // Mismo filtro de eco que processSyncData: nuestra propia escritura no se vuelve a leer
            if (!isFirstSyncCheck && doc.metadata.hasPendingWrites) return;
            const seq = ++hydrateSeq;
            const chunksRef = db.collection('users').doc(auth.currentUser.uid).collection('chunks');
            const manifest = { key: cloudData.chunkKey || '', chunks: {} };
            let { schema, chunkKey, salesChunks, ...result } = cloudData;
            const isV2 = schema === 2 && !('sales' in cloudData);

            // Trae un trozo, descifra y comprueba que coincide con el hash esperado
            const fetchChunk = async (id, hash) => {
                const snap = await chunksRef.doc(id).get();
                if (!snap.exists) throw new Error('falta el trozo ' + id);
                const d = snap.data();
                const text = d.isEncrypted ? decryptJsonText(d.data) : d.data;
                if (typeof text !== 'string' || hashText(text) !== hash) throw new Error('trozo ' + id + ' no coincide');
                return JSON.parse(text);
            };

            try {
                if (isV2) {
                    const local = {};
                    splitSales(state.sales).forEach(c => { local[c.id] = { hash: hashText(JSON.stringify(c.items)), items: c.items }; });
                    const parts = await Promise.all((salesChunks || []).map(async c => {
                        manifest.chunks[c.id] = c.hash;
                        const items = local[c.id] && local[c.id].hash === c.hash ? local[c.id].items : await fetchChunk(c.id, c.hash);
                        return { id: c.id, items };
                    }));
                    result.sales = joinSales(parts);
                }
                // Fotos: se reutiliza la local si coincide con imgRef; si no, se trae. Una foto que falla no es grave.
                const localById = new Map((state.products || []).map(p => [p.id, p]));
                result.products = await Promise.all((cloudData.products || []).map(async p => {
                    const { imgRef, ...prod } = p;
                    if (!imgRef) return prod;
                    manifest.chunks['img_' + p.id] = imgRef;
                    const lp = localById.get(p.id);
                    if (lp && lp.img && hashText(JSON.stringify(lp.img)) === imgRef) return { ...prod, img: lp.img };
                    try {
                        return { ...prod, img: await fetchChunk('img_' + p.id, imgRef) };
                    } catch (e) {
                        console.warn('Foto no disponible:', e.message);
                        return lp && lp.img ? { ...prod, img: lp.img } : p; // sin foto se conserva imgRef para no borrarla de la nube
                    }
                }));
            } catch (err) {
                // Sin ventas completas NO se llama a processSyncData: no se pisan las locales con datos incompletos
                console.warn('☁️ Hidratación incompleta:', err.message);
                if (seq !== hydrateSeq) return;
                updateCloudStatus('SYNCING');
                if (attempt < 3) setTimeout(() => { if (seq === hydrateSeq) hydrateCloudData(cloudData, doc, attempt + 1); }, 10000);
                return;
            }
            if (seq !== hydrateSeq) return; // llegó un snapshot más nuevo
            if (!isV2) manifest.chunks = {}; // formato viejo: la próxima subida reparte todo
            setCloudManifest(manifest);
            processSyncData(result, doc);
        }

        // --- FUNCIÓN: Intermediario para detectar conflictos (MODO ESTRICTO INTELIGENTE) ---
        function processSyncData(cloudData, doc) {
            
            // 1. ESCUDO: Si acabamos de resolver un conflicto, ignoramos todo por unos segundos.
            if (typeof conflictCooldown !== 'undefined' && conflictCooldown) {
                console.log("🛡️ Ignorando chequeo de conflicto (Cooldown activo)...");
                return;
            }

            // 2. FILTRO DE ECO: Si es mi propia escritura pendiente, ignorar.
            if (!isFirstSyncCheck && doc.metadata.hasPendingWrites) return;

            // --- FUNCIÓN AUXILIAR: Sumar todo el stock físico (LO QUE FALTABA) ---
            const calculateTotalStock = (productsArray) => {
                if (!productsArray || !Array.isArray(productsArray)) return 0;
                return productsArray.reduce((total, prod) => {
                    // CORRECCIÓN: Usamos .qty en lugar de .stock
                    return total + (parseFloat(prod.qty) || 0);
                }, 0);
            };

            // --- ANÁLISIS DE DATOS (NUEVA LÓGICA) ---
            
            // A. Extraemos métricas clave LOCALES
            const localMetrics = {
                sales: state.sales ? state.sales.length : 0,
                // AHORA USAMOS LA SUMA TOTAL, NO EL CONTEO
                totalStock: calculateTotalStock(state.products),
                credits: state.credits ? state.credits.length : 0,
                time: state.lastUpdated ? new Date(state.lastUpdated).getTime() : 0
            };

            // B. Extraemos métricas clave NUBE
            const cloudMetrics = {
                sales: cloudData.sales ? cloudData.sales.length : 0,
                totalStock: calculateTotalStock(cloudData.products),
                credits: cloudData.credits ? cloudData.credits.length : 0,
                time: cloudData.lastUpdated ? new Date(cloudData.lastUpdated).getTime() : 0
            };

            // --- B. LÓGICA DE TIEMPOS Y TOLERANCIA ---
            const diff = Math.abs(localMetrics.time - cloudMetrics.time);
            const TOLERANCE_MS = 2000; // 2 Segundos de margen

            // --- C. NUEVA LÓGICA DE ACTUALIZACIÓN "RELAJADA" (CASO MULTI-DISPOSITIVO) 🔄 ---
            // Si la nube es CLARAMENTE más reciente que yo (superando tolerancia),
            // asumo que otro dispositivo guardó y yo debo actualizarme sin preguntar.
            if (!isFirstSyncCheck && cloudMetrics.time > (localMetrics.time + TOLERANCE_MS)) {
                console.log("🔄 Actualización remota detectada. Sincronizando UI...");
                finishLoadingData(cloudData, doc);
                return;
            }

            // --- D. DETECCIÓN DE CONFLICTO ---

            // Verificamos si el CONTENIDO es idéntico
            const isDataIdentical =
                localMetrics.sales === cloudMetrics.sales &&
                localMetrics.totalStock === cloudMetrics.totalStock &&
                localMetrics.credits === cloudMetrics.credits;

            // Solo hay conflicto de tiempo si supera la tolerancia
            const isTimeDifferent = diff > TOLERANCE_MS;

            // Excepción: Instalación limpia (Si local está vacío, la nube siempre gana)
            const isLocalEmpty = state.products.length === 0 && state.sales.length === 0;

            // --- E. DECISIÓN FINAL ---
            if ((!isDataIdentical || isTimeDifferent) && !isLocalEmpty) {

                // CASO ESPECIAL: Si la nube es más reciente (o igual), confiamos en ella 
                // para evitar molestar al usuario, A MENOS que haya más ventas locales (trabajo sin subir).
                if (cloudMetrics.time >= localMetrics.time && cloudMetrics.sales >= localMetrics.sales) {
                    finishLoadingData(cloudData, doc);
                    return;
                }

                // SI LLEGAMOS AQUÍ: El Local es más reciente O tiene datos que la nube no tiene.
                // ¡MOSTRAMOS EL MODAL CON TODA LA INFO!
                console.warn(`⚠️ CONFLICTO REAL: Local tiene prioridad o datos únicos.`);

                pendingCloudSnapshot = { data: cloudData, doc: doc };

                // --- UI DEL MODAL (TU LÓGICA VISUAL ORIGINAL) ---
                const fmtLocal = localMetrics.time ? new Date(localMetrics.time).toLocaleString() : '---';
                const fmtCloud = cloudMetrics.time ? new Date(cloudMetrics.time).toLocaleString() : '---';

                let localBadge = "";
                let cloudBadge = "";

                // Badges de Ventas
                if (localMetrics.sales > cloudMetrics.sales) {
                    localBadge = `<span class="block mt-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold w-fit">Recomendado (+Ventas)</span>`;
                } else if (cloudMetrics.sales > localMetrics.sales) {
                    cloudBadge = `<span class="block mt-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold w-fit">Recomendado (+Ventas)</span>`;
                }
                // Badges de Stock (si ventas iguales)
                else if (localMetrics.totalStock < cloudMetrics.totalStock) {
                    localBadge = `<span class="block mt-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold w-fit">Recomendado (Stock Actual)</span>`;
                } else if (cloudMetrics.totalStock < localMetrics.totalStock) {
                    cloudBadge = `<span class="block mt-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold w-fit">Recomendado (Stock Actual)</span>`;
                }

                // Inyección HTML
                document.getElementById('confLocalDate').innerHTML = `
                    <div class="flex flex-col items-center">
                        <span class="font-bold text-slate-700">${fmtLocal}</span>
                        <span class="text-xs text-slate-500 mt-1">🛒 Ventas: ${localMetrics.sales}</span>
                        <span class="text-xs text-slate-800 font-bold bg-slate-100 px-2 rounded mt-0.5">📦 Stock Total: ${localMetrics.totalStock}</span>
                        ${localBadge}
                    </div>
                `;

                document.getElementById('confCloudDate').innerHTML = `
                    <div class="flex flex-col items-center">
                        <span class="font-bold text-slate-700">${fmtCloud}</span>
                        <span class="text-xs text-slate-500 mt-1">🛒 Ventas: ${cloudMetrics.sales}</span>
                        <span class="text-xs text-slate-800 font-bold bg-slate-100 px-2 rounded mt-0.5">📦 Stock Total: ${cloudMetrics.totalStock}</span>
                        ${cloudBadge}
                    </div>
                `;

                document.getElementById('conflictModal').classList.remove('hidden');

            } else {
                // Si todo es idéntico o es instalación limpia
                finishLoadingData(cloudData, doc);
            }

            isFirstSyncCheck = false;
        }

        // --- FUNCIÓN DEL MODAL: Resuelve qué versión gana ---
        function resolveConflict(choice) {
            const modal = document.getElementById('conflictModal');

            // 1. ACTIVAR ESCUDO (COOLDOWN) 🛡️
            // Durante 3 segundos, ignoraremos cualquier "eco" o rebote de la red.
            conflictCooldown = true;
            setTimeout(() => {
                conflictCooldown = false;
                console.log("🛡️ Cooldown finalizado. Vigilancia reactivada.");
            }, 3000);
            
            if (choice === 'CLOUD') {
                if (pendingCloudSnapshot) {
                    console.log("☁️ Usuario eligió NUBE. Sobrescribiendo datos locales...");
                    
                    // Cargamos los datos que teníamos en "cuarentena"
                    finishLoadingData(pendingCloudSnapshot.data, pendingCloudSnapshot.doc);
                    
                    // Forzamos la fecha local para que coincida y no vuelva a saltar el modal
                    localStorage.setItem('inv_last_updated', pendingCloudSnapshot.data.lastUpdated); 
                    state.lastUpdated = pendingCloudSnapshot.data.lastUpdated;

                    // La tasa del dólar probablemente sea vieja. ¡Actualicémosla de nuevo!
                    setTimeout(() => {
                        console.log("🔄 Reactualizando tasas tras conflicto...");
                        fetchAllRates();
                    }, 500);
                }
            } else if (choice === 'LOCAL') {
                console.log("📱 Usuario eligió LOCAL. Forzando subida a nube...");
                
                // Actualizamos fecha local para que sea "la más reciente" oficialmente
                state.lastUpdated = new Date().toISOString();
                localStorage.setItem('inv_last_updated', state.lastUpdated);
                
                // Habilitamos subida y empujamos
                state.isCloudSynced = true; 
                saveData(); 
            }

            // Limpieza
            pendingCloudSnapshot = null;
            modal.classList.add('hidden');
        }

        // ==========================================
        // LÓGICA DEL VISOR DE DIFERENCIAS (DIFF)
        // ==========================================

        function showConflictDetails() {
            if (!pendingCloudSnapshot || !pendingCloudSnapshot.data) return;

            const cloud = pendingCloudSnapshot.data;
            const local = state; // 'state' es la variable global con tus datos locales

            const tbody = document.getElementById('diffTableBody');
            tbody.innerHTML = '';

            // --- FUNCIÓN AUXILIAR INTERNA (Copia de seguridad) ---
            const calculateTotalStock = (productsArray) => {
                if (!productsArray || !Array.isArray(productsArray)) return 0;
                return productsArray.reduce((total, prod) => {
                    return total + (parseFloat(prod.qty) || 0); // Usamos .qty correctamente
                }, 0);
            };

            // Función auxiliar para crear filas
            const createRow = (label, localVal, cloudVal, isDate = false, isCurrency = false) => {
                let displayLocal = localVal;
                let displayCloud = cloudVal;
            
                // Formateo de Fechas
                if (isDate) {
                    const fmt = (d) => d ? new Date(d).toLocaleString() : '---';
                    displayLocal = fmt(localVal);
                    displayCloud = fmt(cloudVal);
                    
                    // Resaltar la más reciente en verde
                    const tLocal = localVal ? new Date(localVal).getTime() : 0;
                    const tCloud = cloudVal ? new Date(cloudVal).getTime() : 0;
                    if (tLocal > tCloud) displayLocal = `<span class="text-green-600 font-bold">${displayLocal} <i class="fa-solid fa-caret-up"></i></span>`;
                    else if (tCloud > tLocal) displayCloud = `<span class="text-green-600 font-bold">${displayCloud} <i class="fa-solid fa-caret-up"></i></span>`;
                }

                // Diferenciar valores visualmente
                const isDifferent = localVal != cloudVal; // Comparación simple
                const valStyle = isDifferent ? 'font-bold' : 'text-slate-500';
                
                // Icono de diferencia
                const diffIcon = isDifferent ? '<i class="fa-solid fa-circle-exclamation text-amber-500 ml-2" title="Diferente"></i>' : '';

                return `
                    <tr class="hover:bg-slate-50 transition">
                        <td class="px-4 py-3 font-medium text-slate-700 border-r border-slate-100">
                            ${label} ${diffIcon}
                        </td>
                        <td class="px-4 py-3 text-center border-r border-slate-100 bg-orange-50/30 ${valStyle}">
                            ${displayLocal}
                        </td>
                        <td class="px-4 py-3 text-center bg-blue-50/30 ${valStyle}">
                            ${displayCloud}
                        </td>
                    </tr>
                `;
            };

            // 1. FECHA DE MODIFICACIÓN (Lo más importante)
            tbody.innerHTML += createRow("Última Guardado", local.lastUpdated, cloud.lastUpdated, true);

            // 2. TASA DEL DÓLAR (Causa común de conflictos)
            tbody.innerHTML += createRow("Tasa Dólar (BCV)", local.bcvUsd, cloud.bcvUsd);

            // 3. STOCK TOTAL REAL (La nueva métrica importante)
            const localStock = calculateTotalStock(local.products);
            const cloudStock = calculateTotalStock(cloud.products);
            tbody.innerHTML += createRow("Inventario (Unidades)", localStock, cloudStock);

            // 4. CANTIDAD DE PRODUCTOS (Tipos diferentes)
            const localProdLen = local.products ? local.products.length : 0;
            const cloudProdLen = cloud.products ? cloud.products.length : 0;
            tbody.innerHTML += createRow("Total Productos", localProdLen, cloudProdLen);

            // 5. VENTAS REGISTRADAS (Historial)
            const localSalesLen = local.sales ? local.sales.length : 0;
            const cloudSalesLen = cloud.sales ? cloud.sales.length : 0;
            tbody.innerHTML += createRow("Ventas (Historial)", localSalesLen, cloudSalesLen);

            // 6. CLIENTES FIADOS
            const localCreditsLen = local.credits ? local.credits.length : 0;
            const cloudCreditsLen = cloud.credits ? cloud.credits.length : 0;
            tbody.innerHTML += createRow("Cuentas por Cobrar", localCreditsLen, cloudCreditsLen);

            // Mostrar el modal
            document.getElementById('diffModal').classList.remove('hidden');
        }

        function closeDiffModal() {
            document.getElementById('diffModal').classList.add('hidden');
        }

        // Función auxiliar para continuar la carga (Extraída para reutilizarla)
        function finishLoadingData(finalData, doc) {
             if (finalData) {
                state = { ...state, ...finalData };
                state.isCloudSynced = true; 
                migrateLegacyPin(); // un dispositivo viejo pudo subir el PIN en claro

                if (!doc.metadata.hasPendingWrites) {
                    localStorage.setItem('inv_products', JSON.stringify(state.products));
                    localStorage.setItem('inv_sales', JSON.stringify(state.sales));
                    localStorage.setItem('inv_credits', JSON.stringify(state.credits));
                    localStorage.setItem('inv_payment_methods', JSON.stringify(state.paymentMethods));
                    localStorage.setItem('inv_security', JSON.stringify(state.security));
                    localStorage.setItem('inv_custom_rate', state.customRate);
                    localStorage.setItem('inv_rate_mode', state.rateMode);
                    localStorage.setItem('inv_fiados_rate_mode', state.fiadosRateMode);
                    localStorage.setItem('inv_bcv_usd', state.bcvUsd);
                    localStorage.setItem('inv_bcv_eur', state.bcvEur);
                    localStorage.setItem('inv_receipt_config', JSON.stringify(state.receiptConfig));
            
                    if(encryptionKey) localStorage.setItem('inv_enc_key', encryptionKey);
            
                    renderAll();
                    renderEncryptionUI(); // Actualizar UI de candado
                    if (state.receiptType === 'FISCAL' && fiscalRemaining() < FISCAL_LOW_WATER) reserveFiscalBlock();
                    console.log("☁️ Sincronizado y listo.");

                    // Solo actualizamos tasas si es la primera vez y ya terminamos de cargar datos
                    if (!hasInitialRatesUpdate) {
                        hasInitialRatesUpdate = true; // Marcamos para no repetir y evitar bucles
                        console.log("💱 Datos seguros. Buscando tasas actualizadas...");
                        // Pequeño delay para no saturar la carga inicial
                        setTimeout(() => fetchAllRates(), 500);
                    }
                }
            }
        }

        function toggleCartModal(forceOpen = null) {
            const modal = $('cartModal');
            if (!modal) return;

            const isHidden = modal.classList.contains('hidden');
            const shouldOpen = forceOpen !== null ? forceOpen : isHidden;

            if (shouldOpen) {
                // ABRIR
                modal.classList.remove('hidden');
                
            } else {
                // CERRAR
                modal.classList.add('hidden');
            }
        }


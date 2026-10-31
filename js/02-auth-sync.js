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
        // Fase 15: se registra cuando ya cargaron todos los scripts; antes, con red lenta, Firebase respondía
        // sin que existieran funciones de archivos posteriores (fetchAllRates, askForMasterKey...).
        document.addEventListener('DOMContentLoaded', () => auth.onAuthStateChanged(user => {
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
        }));

        // 6. Botón Inteligente
        function handleAuthAction() {
            const user = auth.currentUser;
            if (user) {
                confirmSignOut();
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

        // Cierre de sesión (único). Opción: borrar los datos de este dispositivo (solo si no hay cambios sin subir).
        function confirmSignOut() {
            customConfirm('Cerrar sesión', 'Se detendrá la sincronización.', 'warning', () => signOutNow(cb.checked));
            const label = document.createElement('label');
            label.className = 'flex items-start gap-2 text-left text-xs text-slate-600 mt-3';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'mt-0.5';
            label.append(cb, document.createTextNode('Borrar los datos de este dispositivo'));
            $('dialogMsg').appendChild(label);
        }

        function signOutNow(wipe) {
            if (!wipe) return auth.signOut().then(() => location.reload());
            if (isCloudDirty()) {
                return customAlert('Cambios sin subir', 'Hay cambios sin subir a la nube. Conéctate y espera a que se suban antes de borrar este dispositivo.', 'error');
            }
            if (unsubscribe) unsubscribe();
            localStorage.clear(); // incluye inv_enc_key
            const img = ('caches' in window) ? caches.delete(IMG_CACHE).catch(() => {}) : Promise.resolve();
            Promise.all([img, deleteImageDb()]).then(() => auth.signOut()).finally(() => location.reload());
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

                // Capa 1 (Fase 6): sin persistencia, una instantánea desde caché no sabe nada de la nube.
                // Solo se decide con respuestas del servidor.
                if (doc.metadata.fromCache) return;

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
                    setCloudBase('', {}); // el servidor confirmo que no existe: la subida comprueba que siga sin existir
                    saveData();
                    afterCloudSyncImages();
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
            if (cloudTokenOf(doc.data()) === selfCloudToken) return; // eco de nuestra propia subida
            if (!localImagesReady) await localImagesLoaded; // para reutilizar las fotos locales (lp.img)
            const seq = ++hydrateSeq;
            const manifest = { key: cloudData.chunkKey || '', chunks: {} };
            let { schema, chunkKey, salesChunks, ...result } = cloudData;
            const isV2 = schema === 2 && !('sales' in cloudData);

            const fetchChunk = fetchCloudChunk;

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

            // Fase 6: decisión por versión base. Solo un dispositivo sin base (LEGACY) usa la lógica antigua de abajo.
            const decision = decideSync(getCloudBase(), cloudTokenOf(doc.data()), isCloudDirty(), isLocalPartial());
            if (decision !== 'LEGACY') {
                isFirstSyncCheck = false;
                if (decision === 'NONE' || decision === 'LOAD') {
                    finishLoadingData(cloudData, doc);
                } else if (decision === 'UPLOAD') {
                    console.log("⬆️ Cambios locales sin subir sobre la misma versión de la nube: subiendo...");
                    state.isCloudSynced = true;
                    saveData();
                    afterCloudSyncImages();
                    if (!hasInitialRatesUpdate) { hasInitialRatesUpdate = true; setTimeout(() => fetchAllRates(), 500); }
                } else {
                    showConflictModal(cloudData, doc);
                }
                return;
            }

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

                showConflictModal(cloudData, doc);

            } else {
                // Si todo es idéntico o es instalación limpia
                finishLoadingData(cloudData, doc);
            }

            isFirstSyncCheck = false;
        }

        // Cuadro de conflicto: fecha, productos, ventas y fiados de cada lado. Recomienda solo por más ventas.
        function showConflictModal(cloudData, doc) {
            console.warn("⚠️ CONFLICTO: hay cambios locales sin subir y la nube cambió.");
            pendingCloudSnapshot = { data: cloudData, doc: doc };
            const side = (d) => ({
                time: d.lastUpdated ? new Date(d.lastUpdated).toLocaleString() : '---',
                ...cloudCounts(d)
            });
            const L = side(state), C = side(cloudData);
            const badge = (color) => `<span class="block mt-1 text-xs bg-${color}-100 text-${color}-800 px-2 py-0.5 rounded font-bold w-fit">Recomendado (+Ventas)</span>`;
            const html = (v, b) => `
                <div class="flex flex-col items-center">
                    <span class="font-bold text-slate-700">${v.time}</span>
                    <span class="text-xs text-slate-500 mt-1">📦 Productos: ${v.products}</span>
                    <span class="text-xs text-slate-500">🛒 Ventas: ${v.sales}</span>
                    <span class="text-xs text-slate-500">💳 Fiados: ${v.credits}</span>
                    ${b}
                </div>`;
            $('confLocalDate').innerHTML = html(L, L.sales > C.sales ? badge('green') : '');
            $('confCloudDate').innerHTML = html(C, C.sales > L.sales ? badge('blue') : '');
            $('conflictModal').classList.remove('hidden');
        }

        // Pide la versión actual al servidor y la pasa por la decisión (tras un conflicto al subir)
        async function pullAndDecide() {
            try {
                const full = await readCloudFull({ photos: true });
                if (!full) return;
                setCloudManifest(full.manifest);
                processSyncData(full.data, full.snap);
            } catch (e) {
                console.error('No se pudo leer la nube tras el conflicto:', e);
                updateCloudStatus('OFFLINE');
            }
        }

        // --- FUNCIÓN DEL MODAL: Resuelve qué versión gana ---
        let resolvingConflict = false;
        async function resolveConflict(choice) {
            if (resolvingConflict) return;
            resolvingConflict = true;
            try {
                const modal = document.getElementById('conflictModal');
                const snapshot = pendingCloudSnapshot;

                // ESCUDO (COOLDOWN) 🛡️: durante 3 segundos se ignora cualquier "eco" o rebote de la red.
                const startCooldown = () => {
                    conflictCooldown = true;
                    setTimeout(() => {
                        conflictCooldown = false;
                        console.log("🛡️ Cooldown finalizado. Vigilancia reactivada.");
                    }, 3000);
                };

                if (choice === 'CLOUD') {
                    startCooldown();
                    if (snapshot) {
                        console.log("☁️ Usuario eligió NUBE. Sobrescribiendo datos locales...");
                        finishLoadingData(snapshot.data, snapshot.doc);

                        // Forzamos la fecha local para que coincida y no vuelva a saltar el modal
                        localStorage.setItem('inv_last_updated', snapshot.data.lastUpdated);
                        state.lastUpdated = snapshot.data.lastUpdated;

                        // La tasa del dólar probablemente sea vieja. ¡Actualicémosla de nuevo!
                        setTimeout(() => {
                            console.log("🔄 Reactualizando tasas tras conflicto...");
                            fetchAllRates();
                        }, 500);
                    }
                } else if (choice === 'LOCAL') {
                    console.log("📱 Usuario eligió LOCAL. Copia de la nube y subida...");
                    // Si la copia falla no se sube nada y el cuadro sigue abierto
                    busyStart('Subiendo tus datos...');
                    try {
                        if (snapshot && !await ensureCloudBackup('Antes de usar los datos locales')) return;
                        startCooldown();

                        state.lastUpdated = new Date().toISOString();
                        localStorage.setItem('inv_last_updated', state.lastUpdated);

                        // Se acepta pisar la versión que el usuario vio; si la nube cambió otra vez, la subida lo detecta
                        if (snapshot) setCloudBase(cloudTokenOf(snapshot.doc.data()), cloudCounts(snapshot.data));
                        state.isCloudSynced = true;
                        saveData({ skipLossCheck: true });
                        await waitForUpload();
                    } finally {
                        busyEnd();
                    }
                }

                pendingCloudSnapshot = null;
                modal.classList.add('hidden');
            } finally {
                resolvingConflict = false;
            }
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

            // 7. CLIENTES (Fase 13)
            tbody.innerHTML += createRow("Clientes", (local.clients || []).length, (cloud.clients || []).length);

            // Mostrar el modal
            document.getElementById('diffModal').classList.remove('hidden');
        }

        function closeDiffModal() {
            document.getElementById('diffModal').classList.add('hidden');
        }

        // Función auxiliar para continuar la carga (Extraída para reutilizarla)
        function finishLoadingData(finalData, doc) {
             if (finalData) {
                // Fase 13: una versión vieja sube sin 'clients'; se conserva la lista local y se vuelve a subir
                const cloudLacksClients = !Array.isArray(finalData.clients) && state.clients.length > 0;
                // Fase 14: igual con 'profitArchive'
                const cloudLacksArchive = (!finalData.profitArchive || typeof finalData.profitArchive !== 'object') && Object.keys(state.profitArchive || {}).length > 0;
                state = { ...state, ...finalData };
                if (!state.profitArchive || typeof state.profitArchive !== 'object' || Array.isArray(state.profitArchive)) state.profitArchive = {};
                state.isCloudSynced = true;
                migrateLegacyPin(); // un dispositivo viejo pudo subir el PIN en claro
                if (!Array.isArray(state.clients)) state.clients = [];
                const clientsMigrated = migrateClients(); // fiados de una versión vieja sin clientId

                if (!doc.metadata.hasPendingWrites) {
                    // Fase 15: con el almacenamiento lleno no se corta la carga; se marca el dispositivo y se avisa
                    safeSetItem('inv_local_partial', '1'); // se quita abajo si todo se guardó
                    let localOk = writeLocalProducts();
                    const put = (key, value) => { localOk = safeSetItem(key, value) && localOk; };
                    put('inv_sales', JSON.stringify(state.sales));
                    put('inv_credits', JSON.stringify(state.credits));
                    put('inv_clients', JSON.stringify(state.clients));
                    put('inv_profitArchive', JSON.stringify(state.profitArchive));
                    put('inv_payment_methods', JSON.stringify(state.paymentMethods));
                    put('inv_security', JSON.stringify(state.security));
                    put('inv_custom_rate', state.customRate);
                    put('inv_rate_mode', state.rateMode);
                    put('inv_fiados_rate_mode', state.fiadosRateMode);
                    put('inv_bcv_usd', state.bcvUsd);
                    put('inv_bcv_eur', state.bcvEur);
                    put('inv_receipt_config', JSON.stringify(state.receiptConfig));
                    put('inv_catalog_config', JSON.stringify(normalizeCatalogConfig()));

                    if(encryptionKey) put('inv_enc_key', encryptionKey);
                    if (localOk) { try { localStorage.removeItem('inv_local_partial'); } catch (e) { /* sin almacenamiento */ } }
                    else { safeSetItem('inv_local_partial', '1'); warnStorageFull(); }

                    renderAll();
                    renderEncryptionUI(); // Actualizar UI de candado
                    // Fase 6: esta version de la nube ya es la base y no quedan cambios locales sin subir
                    setCloudBase(cloudTokenOf(doc.data()), cloudCounts(state));
                    safeSetItem('inv_cloud_dirty', '');
                    if (state.receiptType === 'FISCAL' && fiscalRemaining() < FISCAL_LOW_WATER) reserveFiscalBlock();
                    afterCloudSyncImages(); // sube a Storage las fotos que siguen en el teléfono
                    console.log("☁️ Sincronizado y listo.");
                    if (cloudLacksClients || clientsMigrated || cloudLacksArchive) saveData(); // sube 'clients' (y los clientId nuevos) a la nube

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
                state.pendingOrderId = state.pendingOrderPhone = state.pendingOrderMsg = state.pendingOrderName = null; // cerrar sin cobrar deja el pedido en la bandeja
            }
        }


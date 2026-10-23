        // ==========================================
        // 4. CARGA DE DATOS (STORAGE)
        // ==========================================
        // ---------------------------------------------------------
        // GUARDADO BLINDADO (Con Anti-Wipe + E2EE)
        // ---------------------------------------------------------
        const CLOUD_LIMIT_BYTES = 1000000;

        // Objeto completo que se sube a la nube (antes de cifrar). Lo usan saveData y el medidor.
        function buildCloudPayload() {
            return {
                products: state.products,
                sales: state.sales,
                credits: state.credits,
                paymentMethods: state.paymentMethods,
                security: state.security,
                receiptConfig: state.receiptConfig,
                receiptType: state.receiptType,
                fiscalConfig: state.fiscalConfig,
                customRate: state.customRate,
                rateMode: state.rateMode,
                fiadosRateMode: state.fiadosRateMode,
                bcvUsd: state.bcvUsd,
                bcvEur: state.bcvEur,
                lastUpdated: new Date().toISOString()
            };
        }

        function saveData() {
            // Esto asegura que la memoria local sepa que acabamos de modificar datos
            state.lastUpdated = new Date().toISOString();

            // Guardar timestamp en el disco para que no se pierda al recargar
            localStorage.setItem('inv_last_updated', state.lastUpdated);

            // 1. Guardado Local (Mantenemos tu lógica original de LocalStorage)
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
            if (state.receiptType) localStorage.setItem('inv_receipt_type', state.receiptType);
            localStorage.setItem('inv_fiscal_config', JSON.stringify(state.fiscalConfig));
            localStorage.setItem('inv_credit_mode', state.creditMode);
    
            // [NUEVO] Guardamos la llave si existe, para no pedirla en el próximo inicio
            if(encryptionKey) localStorage.setItem('inv_enc_key', encryptionKey);

            // -----------------------------------------------------
            // ZONA DE SEGURIDAD (Tus protecciones originales)
            // -----------------------------------------------------
    
            // SEGURO 1: No subir si no estamos sincronizados (Evita sobrescribir la nube con datos viejos)
            if (!state.isCloudSynced) return;

            // SEGURO 2: ¡CRÍTICO! Anti-Wipe (Evita borrar la DB por error de carga)
            if (state.products.length === 0 && state.sales.length === 0 && state.credits.length === 0) {
                console.warn("🛡️ BLOQUEO DE SEGURIDAD: Se intentó subir una base de datos vacía.");
                return; 
            }

            // -----------------------------------------------------
            // PREPARACIÓN DE SUBIDA (Lógica Nueva)
            // -----------------------------------------------------
            const user = auth.currentUser;
    
            if (user) {
                const rawData = buildCloudPayload();
                let dataToUpload = {};

                // [DECISIÓN] ¿Encriptar o No?
                if (encryptionKey) {
                    console.log("🔒 Subiendo datos encriptados...");
                    // MODO E2EE: Encriptamos todo el objeto 'rawData'
                    const encryptedString = encryptPayload(rawData);
            
                    dataToUpload = {
                        encryptedData: encryptedString,
                        isEncrypted: true,
                        lastUpdated: new Date().toISOString()
                    };
                } else {
                    // MODO CLÁSICO: Subimos los datos planos (como lo haces hoy)
                    dataToUpload = { 
                        ...rawData, 
                        isEncrypted: false 
                    };
                }

                // --- CAMBIO CLAVE: LIMPIEZA DE DATOS ---
                dataToUpload = sanitizePayload(dataToUpload);

                // Freno hasta la Fase 4: Firestore rechaza documentos de más de 1 MiB
                if (new Blob([JSON.stringify(dataToUpload)]).size > CLOUD_LIMIT_BYTES) {
                    updateCloudStatus('OFFLINE');
                    customAlert('Límite de la nube', 'La base de datos superó el límite de la nube. Tus datos están guardados en este dispositivo. Borra historial o fotos para volver a sincronizar.', 'error');
                    return;
                }

                // 1. ACTIVAMOS EL BLOQUEO MANUAL
                isUploadingToCloud = true;
                updateCloudStatus('SYNCING'); 
        
                // NOTA TÉCNICA: Usamos .set() sin merge:true intencionalmente
                const writePromise = db.collection('users').doc(user.uid).set(dataToUpload);

                writePromise
                    .then(() => {
                        console.log("💾☁️ Guardado en la nube (Confirmación)");

                        // 3. LA SOLUCIÓN NUCLEAR: Esperar confirmación REAL del servidor
                        // Esta promesa solo se resuelve cuando Google dice "Lo tengo".
                        isUploadingToCloud = false;

                        // AHORA SÍ es seguro poner verde manual, porque sin persistencia,
                        // el .then() solo ocurre si el servidor aceptó los datos.
                        updateCloudStatus('ONLINE');
                    })

                    .catch(err => {
                        console.error("Error crítico:", err);
                        isUploadingToCloud = false; // Liberar candado si falla.
                        updateCloudStatus('OFFLINE'); // Avisar visualmente que falló
                        alert("⚠️ Error al subir datos. Revisa tu conexión.");
                    });
            }
        }

        // Función para limpiar valores 'undefined' que rompen Firestore
        function sanitizePayload(obj) {
            return JSON.parse(JSON.stringify(obj, (key, value) => {
                return value === undefined ? null : value;
            }));
        }   


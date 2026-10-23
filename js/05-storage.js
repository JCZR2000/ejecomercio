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

        function saveData({ allowEmpty = false } = {}) {
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

            // SEGURO 2: ¡CRÍTICO! Anti-Wipe (Evita borrar la DB por error de carga).
            // allowEmpty solo lo usa un borrado intencional del usuario.
            if (!allowEmpty && state.products.length === 0 && state.sales.length === 0 && state.credits.length === 0) {
                console.warn("🛡️ BLOQUEO DE SEGURIDAD: Se intentó subir una base de datos vacía.");
                return;
            }

            if (auth.currentUser) uploadToCloud();
        }

        // Una sola subida a la vez; si saveData se llama mientras sube, se repite una vez al terminar.
        let pendingCloudSave = false;
        async function uploadToCloud() {
            if (isUploadingToCloud) { pendingCloudSave = true; return; }
            const user = auth.currentUser;
            isUploadingToCloud = true;
            updateCloudStatus('SYNCING');
            try {
                do {
                    pendingCloudSave = false;
                    if (!await uploadCloudOnce(user)) { updateCloudStatus('OFFLINE'); return; }
                } while (pendingCloudSave);
                console.log("💾☁️ Guardado en la nube (Confirmación)");
                updateCloudStatus('ONLINE');
            } catch (err) {
                console.error("Error crítico:", err);
                updateCloudStatus('OFFLINE');
                alert("⚠️ Error al subir datos. Revisa tu conexión.");
            } finally {
                isUploadingToCloud = false;
            }
        }

        // Devuelve false si el freno de tamaño impidió subir.
        async function uploadCloudOnce(user) {
            const userRef = db.collection('users').doc(user.uid);
            const chunksRef = userRef.collection('chunks');
            const { main, chunks, kept } = buildCloudParts();
            const fp = keyFingerprint();
            const old = state.cloudManifest || {};
            const oldChunks = old.chunks || {};

            let mainDoc;
            if (encryptionKey) {
                console.log("🔒 Subiendo datos encriptados...");
                mainDoc = { encryptedData: encryptPayload(main), isEncrypted: true, lastUpdated: new Date().toISOString() };
            } else {
                mainDoc = { ...main, isEncrypted: false };
            }
            mainDoc = sanitizePayload(mainDoc);

            // Trozos que cambiaron (o todos, si cambió la clave o es la primera subida)
            const docs = {};
            let tooBig = new Blob([JSON.stringify(mainDoc)]).size > CLOUD_LIMIT_BYTES ? 'El documento principal' : null;
            for (const [id, c] of Object.entries(chunks)) {
                if (old.key === fp && oldChunks[id] === c.hash) continue;
                docs[id] = { data: encryptionKey ? encryptJsonText(c.json) : c.json, isEncrypted: !!encryptionKey };
                if (!tooBig && docs[id].data.length > CLOUD_LIMIT_BYTES) tooBig = id.startsWith('img_') ? 'Una foto' : 'Un bloque de ventas';
            }
            if (tooBig) {
                customAlert('Límite de la nube', `${tooBig} superó el límite de la nube. Tus datos están guardados en este dispositivo. Borra historial o fotos para volver a sincronizar.`, 'error');
                return false;
            }

            // 1. Trozos nuevos, en lotes de hasta 400 operaciones o ~5 MB
            let batch = db.batch(), ops = 0, bytes = 0;
            for (const [id, d] of Object.entries(docs)) {
                if (ops >= 400 || (ops && bytes + d.data.length > 5000000)) {
                    await batch.commit();
                    batch = db.batch(); ops = 0; bytes = 0;
                }
                batch.set(chunksRef.doc(id), d);
                ops++; bytes += d.data.length;
            }
            if (ops) await batch.commit();

            // 2. Documento principal (.set() sin merge, intencional)
            await userRef.set(mainDoc);

            // 3. Al final, borrar los trozos que ya no existen (si falla antes, el principal viejo sigue válido)
            const stale = Object.keys(oldChunks).filter(id => !chunks[id] && !kept.includes(id));
            for (let i = 0; i < stale.length; i += 400) {
                const b = db.batch();
                stale.slice(i, i + 400).forEach(id => b.delete(chunksRef.doc(id)));
                await b.commit();
            }

            const manifest = { key: fp, chunks: {} };
            for (const [id, c] of Object.entries(chunks)) manifest.chunks[id] = c.hash;
            kept.forEach(id => { if (oldChunks[id]) manifest.chunks[id] = oldChunks[id]; });
            setCloudManifest(manifest);
            return true;
        }

        function setCloudManifest(m) {
            state.cloudManifest = m;
            localStorage.setItem('inv_cloud_manifest', JSON.stringify(m));
        }

        // Función para limpiar valores 'undefined' que rompen Firestore
        function sanitizePayload(obj) {
            return JSON.parse(JSON.stringify(obj, (key, value) => {
                return value === undefined ? null : value;
            }));
        }   


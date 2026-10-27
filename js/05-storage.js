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
                clients: state.clients,
                paymentMethods: state.paymentMethods,
                security: state.security,
                receiptConfig: state.receiptConfig,
                receiptType: state.receiptType,
                fiscalConfig: state.fiscalConfig,
                catalogConfig: state.catalogConfig,
                customRate: state.customRate,
                rateMode: state.rateMode,
                fiadosRateMode: state.fiadosRateMode,
                bcvUsd: state.bcvUsd,
                bcvEur: state.bcvEur,
                lastUpdated: new Date().toISOString()
            };
        }

        // Fase 6: ficha de la última versión de la nube aceptada por este dispositivo (null = viene de una versión vieja)
        let selfCloudToken = null; // ficha de nuestra última subida: su eco no se vuelve a procesar
        let saveSeq = 0;
        const getCloudBase = () => localStorage.getItem('inv_cloud_base');
        function setCloudBase(token, counts) {
            localStorage.setItem('inv_cloud_base', token);
            localStorage.setItem('inv_cloud_base_counts', JSON.stringify(counts || {}));
        }
        const getCloudBaseCounts = () => { try { return JSON.parse(localStorage.getItem('inv_cloud_base_counts')); } catch (e) { return null; } };
        const isCloudDirty = () => localStorage.getItem('inv_cloud_dirty') === '1';

        // background: guardado que no es un cambio del usuario (tasas): no marca cambios pendientes ni pregunta en conflictos.
        // skipLossCheck: el usuario ya confirmó un borrado grande.
        function saveData({ allowEmpty = false, background = false, skipLossCheck = false } = {}) {
            if (!background) { saveSeq++; localStorage.setItem('inv_cloud_dirty', '1'); }
            // Esto asegura que la memoria local sepa que acabamos de modificar datos
            state.lastUpdated = new Date().toISOString();

            // Guardar timestamp en el disco para que no se pierda al recargar
            localStorage.setItem('inv_last_updated', state.lastUpdated);

            // 1. Guardado Local (Mantenemos tu lógica original de LocalStorage)
            persistProducts(); // inv_products sin el base64 de las fotos ya guardadas en IndexedDB (Fase 7)
            localStorage.setItem('inv_sales', JSON.stringify(state.sales));
            localStorage.setItem('inv_credits', JSON.stringify(state.credits));
            localStorage.setItem('inv_clients', JSON.stringify(state.clients));
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
            localStorage.setItem('inv_catalog_config', JSON.stringify(state.catalogConfig));
            scheduleCatalogPublish(); // funciona sin conexión: solo agenda la cola del dispositivo

            // [NUEVO] Guardamos la llave si existe, para no pedirla en el próximo inicio
            if(encryptionKey) localStorage.setItem('inv_enc_key', encryptionKey);

            // -----------------------------------------------------
            // ZONA DE SEGURIDAD (Tus protecciones originales)
            // -----------------------------------------------------
    
            // SEGURO 1: No subir si no estamos sincronizados (Evita sobrescribir la nube con datos viejos)
            if (!state.isCloudSynced) return;

            // SEGURO 2: Anti-Wipe solo para dispositivos sin base (vienen de una versión vieja).
            // Con base, la capa 3 (bigLoss en uploadToCloud) pregunta antes de subir pérdidas grandes.
            if (!allowEmpty && getCloudBase() === null && state.products.length === 0 && state.sales.length === 0 && state.credits.length === 0) {
                console.warn("🛡️ BLOQUEO DE SEGURIDAD: Se intentó subir una base de datos vacía.");
                return;
            }

            if (auth.currentUser) uploadToCloud({ background, skipLossCheck });
        }

        // Una sola subida a la vez; si saveData se llama mientras sube, se repite una vez al terminar.
        let pendingCloudSave = false;
        async function uploadToCloud({ background = false, skipLossCheck = false } = {}) {
            if (isUploadingToCloud) { pendingCloudSave = true; return; }
            // Sin las fotos locales cargadas, buildCloudParts vería productos sin img y la nube perdería su trozo img_
            if (!localImagesReady) await localImagesLoaded;
            if (!skipLossCheck) {
                const loss = bigLoss(getCloudBaseCounts(), cloudCounts(state));
                if (loss.length) { if (!background) askBigLoss(loss); return; }
            }
            const user = auth.currentUser;
            isUploadingToCloud = true;
            updateCloudStatus('SYNCING');
            try {
                do {
                    pendingCloudSave = false;
                    const r = await uploadCloudOnce(user);
                    if (r === 'CONFLICT') {
                        // La nube cambió desde la última versión aceptada: se vuelve a decidir con la versión actual
                        if (!background) await pullAndDecide();
                        return;
                    }
                    if (!r) { updateCloudStatus('OFFLINE'); return; }
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

        const LOSS_LABELS = { products: 'Productos', sales: 'Ventas', credits: 'Fiados', clients: 'Clientes' };

        // Capa 3: pérdida grande de datos. Sí = copia y subida; No = se descartan los cambios locales.
        function askBigLoss(loss) {
            const base = getCloudBaseCounts() || {}, now = cloudCounts(state);
            const msg = loss.map(t => `${LOSS_LABELS[t]}: ${base[t] || 0} → ${now[t] || 0}`).join('\n') + '\n\n¿Subir este cambio? Se guardará una copia de la nube antes. Si cancelas, se descartan los cambios de este dispositivo.';
            let answered = false;
            customConfirm('Se van a borrar datos de la nube', msg, 'warning', async () => {
                answered = true;
                busyStart('Subiendo a la nube...');
                try {
                    if (await ensureCloudBackup('Antes de una pérdida grande de datos')) { saveData({ skipLossCheck: true }); await waitForUpload(); }
                } finally { busyEnd(); }
            });
            $('dialogMsg').style.whiteSpace = 'pre-line';
            // closeDialog llama a este aviso antes que a "Confirmar": se espera un instante para saber cuál botón fue
            window.dialogCallback = () => setTimeout(async () => {
                $('dialogMsg').style.whiteSpace = '';
                if (answered) return;
                try {
                    const full = await readCloudFull({ photos: true });
                    if (full) { setCloudManifest(full.manifest); finishLoadingData(full.data, full.snap); }
                    else localStorage.setItem('inv_cloud_dirty', '');
                } catch (e) {
                    console.error('No se pudo recargar la nube:', e);
                    customAlert('Sin conexión', 'No se pudo recargar la nube. Los cambios de este dispositivo siguen sin subir.', 'error');
                }
            }, 0);
        }

        // Devuelve true, false (el freno de tamaño impidió subir) o 'CONFLICT' (la nube cambió; no se escribió el documento principal).
        async function uploadCloudOnce(user) {
            const userRef = db.collection('users').doc(user.uid);
            const base = getCloudBase(); // null = dispositivo viejo: sin comprobación hasta que acepte una versión
            const seq = saveSeq;
            const upCounts = cloudCounts(state);
            if (base !== null) {
                const s0 = await userRef.get({ source: 'server' });
                if (cloudTokenOf(s0.exists ? s0.data() : null) !== base) return 'CONFLICT';
            }
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

            // 2. Documento principal en transacción: solo se escribe si la nube sigue en la versión base.
            // shortcut: un conflicto aquí deja trozos nuevos huérfanos (pequeños); se borran con el reinicio de fábrica.
            let newToken;
            const res = await db.runTransaction(async tx => {
                const s = await tx.get(userRef);
                const cur = s.exists ? s.data() : null;
                if (base !== null && cloudTokenOf(cur) !== base) return 'CONFLICT';
                const doc = { ...mainDoc, rev: ((cur && cur.rev) || 0) + 1 }; // set() sin merge, intencional
                newToken = cloudTokenOf(doc);
                selfCloudToken = newToken;
                tx.set(userRef, doc);
                return 'OK';
            });
            if (res === 'CONFLICT') return 'CONFLICT';

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
            setCloudBase(newToken, upCounts);
            if (seq === saveSeq) localStorage.setItem('inv_cloud_dirty', ''); // si hubo otro cambio durante la subida, sigue pendiente
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


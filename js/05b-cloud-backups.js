        // ==========================================
        // 4b. COPIAS AUTOMÁTICAS EN LA NUBE (Fase 6)
        // users/{uid}/backups/{id} = { createdAt, reason, counts, parts, isEncrypted, imgPaths }
        // users/{uid}/backups/{id}/parts/{NNN} = { data, isEncrypted }
        // Las fotos no se copian (solo sus enlaces de Storage); las de trozos img_ viejos tampoco.
        // ==========================================
        const BACKUPS_KEEP = 5;

        const cloudUserRef = () => db.collection('users').doc(auth.currentUser.uid);

        // Trae un trozo, descifra y comprueba que coincide con el hash esperado
        async function fetchCloudChunk(id, hash) {
            const snap = await cloudUserRef().collection('chunks').doc(id).get();
            if (!snap.exists) throw new Error('falta el trozo ' + id);
            const d = snap.data();
            const text = d.isEncrypted ? decryptJsonText(d.data) : d.data;
            if (typeof text !== 'string' || hashText(text) !== hash) throw new Error('trozo ' + id + ' no coincide');
            return JSON.parse(text);
        }

        // Lee del servidor el documento completo (ventas incluidas). photos: también trae las fotos de trozos img_.
        // Devuelve null si el documento no existe. Lanza si falta la clave o un trozo.
        async function readCloudFull({ photos = false } = {}) {
            const snap = await cloudUserRef().get({ source: 'server' });
            if (!snap.exists) return null;
            const raw = snap.data();
            const encrypted = !!(raw.isEncrypted && raw.encryptedData);
            const data = encrypted ? decryptPayload(raw.encryptedData) : raw;
            if (!data) throw new Error('no se pudo descifrar la nube');
            const { schema, chunkKey, salesChunks, ...result } = data;
            const manifest = { key: chunkKey || '', chunks: {} };
            if (schema === 2 && !('sales' in data)) {
                result.sales = joinSales(await Promise.all((salesChunks || []).map(async c => {
                    manifest.chunks[c.id] = c.hash;
                    return { id: c.id, items: await fetchCloudChunk(c.id, c.hash) };
                })));
            } else {
                manifest.chunks = {}; // formato viejo: la próxima subida reparte todo
            }
            result.products = await Promise.all((data.products || []).map(async p => {
                const { imgRef, ...prod } = p;
                if (!imgRef) return prod;
                if (schema === 2) manifest.chunks['img_' + p.id] = imgRef;
                if (!photos) return p;
                try { return { ...prod, img: await fetchCloudChunk('img_' + p.id, imgRef) }; } catch (e) { return p; }
            }));
            return { snap, raw, data: result, manifest, token: cloudTokenOf(raw), encrypted };
        }

        // Guarda una copia del estado actual de la nube. Devuelve { id, token, manifest } o null si la nube está vacía.
        // Lanza si algo falla: quien llama no debe subir nada.
        async function createCloudBackup(reason) {
            const full = await readCloudFull();
            if (!full) return null;
            const uid = auth.currentUser.uid;
            const id = String(Date.now());
            const ref = cloudUserRef().collection('backups').doc(id);
            const parts = splitText(JSON.stringify(full.data));
            for (let i = 0; i < parts.length; i++) {
                await ref.collection('parts').doc(String(i).padStart(3, '0')).set({
                    data: full.encrypted ? encryptJsonText(parts[i]) : parts[i], isEncrypted: full.encrypted
                });
            }
            const imgPaths = full.data.products.filter(p => p.imgUrl && p.imgHash).map(p => imagePath(uid, p.id, p.imgHash));
            // La cabecera va al final: una copia a medias nunca aparece en la lista
            await ref.set({ createdAt: new Date().toISOString(), reason, counts: cloudCounts(full.data), parts: parts.length, isEncrypted: full.encrypted, imgPaths });
            await trimCloudBackups().catch(e => console.warn('No se pudieron recortar las copias:', e.message || e));
            return { id, token: full.token, manifest: full.manifest };
        }

        // Copia antes de un cambio grande. true = se puede seguir; false = falló (ya se avisó al usuario).
        async function ensureCloudBackup(reason) {
            if (!auth.currentUser || !state.isCloudSynced) return true;
            try {
                await createCloudBackup(reason);
                return true;
            } catch (e) {
                console.error('Copia en la nube fallida:', e);
                customAlert('Sin copia de seguridad', 'No se pudo hacer la copia de seguridad en la nube; no se cambió nada.', 'error');
                return false;
            }
        }

        async function deleteBackupDoc(ref) {
            const parts = await ref.collection('parts').get();
            for (let i = 0; i < parts.docs.length; i += 400) {
                const b = db.batch();
                parts.docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
                await b.commit();
            }
            await ref.delete();
        }

        async function listCloudBackups() {
            const snap = await cloudUserRef().collection('backups').get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        }

        async function trimCloudBackups() {
            const list = await listCloudBackups();
            for (const b of list.slice(BACKUPS_KEEP)) await deleteBackupDoc(cloudUserRef().collection('backups').doc(b.id));
        }

        async function deleteAllCloudBackups(userRef) {
            const snap = await userRef.collection('backups').get();
            for (const d of snap.docs) await deleteBackupDoc(d.ref);
        }

        // Carga una copia en state y la sube con el guardado normal
        async function restoreCloudBackup(id) {
            try {
                const ref = cloudUserRef().collection('backups').doc(id);
                const head = await ref.get();
                if (!head.exists) throw new Error('la copia ya no existe');
                const h = head.data();
                const partDocs = await ref.collection('parts').get();
                const sorted = partDocs.docs.sort((a, b) => (a.id < b.id ? -1 : 1)).map(d => d.data());
                if (sorted.length !== h.parts) throw new Error('copia incompleta');
                const texts = sorted.map(p => p.isEncrypted ? decryptJsonText(p.data) : p.data);
                if (texts.some(t => typeof t !== 'string')) throw new Error('no se pudo descifrar (¿otra clave maestra?)');
                const data = JSON.parse(texts.join(''));
                // Copia de lo actual; después la base pasa a ser la nube que se acaba de leer (el usuario eligió reemplazarla)
                const cur = await createCloudBackup('Antes de restaurar una copia');
                if (cur) { setCloudBase(cur.token, cloudCounts(data)); setCloudManifest(cur.manifest); }
                state = { ...state, ...data };
                state.isCloudSynced = true;
                migrateLegacyPin();
                saveData({ skipLossCheck: true });
                renderAll();
                renderCloudBackupsUI();
                customAlert('Copia restaurada', 'Se restauró la copia y se está subiendo a la nube.', 'success');
            } catch (e) {
                console.error('Restaurar copia:', e);
                customAlert('No se pudo restaurar', 'No se pudo restaurar la copia: ' + (e.message || e) + '. No se cambió nada.', 'error');
            }
        }

        async function renderCloudBackupsUI() {
            const box = $('cloudBackupsUI');
            if (!box) return;
            box.textContent = '';
            const note = (text) => { const p = document.createElement('p'); p.className = 'text-xs text-gray-500'; p.textContent = text; box.appendChild(p); };
            if (!auth.currentUser) return note('Inicia sesión para ver las copias en la nube.');
            note('Cargando copias...');
            let list;
            try { list = await listCloudBackups(); } catch (e) { box.textContent = ''; return note('No se pudieron leer las copias (¿sin conexión?).'); }
            box.textContent = '';
            if (!list.length) return note('Aún no hay copias. Se crean solas antes de cambios grandes.');
            list.forEach(b => {
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded p-2 mb-2';
                const info = document.createElement('div');
                info.className = 'text-xs text-left min-w-0';
                const c = b.counts || {};
                info.innerHTML = '<div class="font-bold text-gray-700"></div><div class="text-gray-500 truncate"></div><div class="text-gray-500"></div>';
                info.children[0].textContent = new Date(b.createdAt).toLocaleString();
                info.children[1].textContent = b.reason || '';
                info.children[2].textContent = `${c.products || 0} productos · ${c.sales || 0} ventas · ${c.credits || 0} fiados`;
                const btn = document.createElement('button');
                btn.className = 'shrink-0 px-3 py-1.5 text-xs font-bold bg-white border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-300 transition';
                btn.textContent = 'Restaurar';
                btn.onclick = () => customConfirm('Restaurar copia', `Se reemplazarán los datos actuales por los del ${new Date(b.createdAt).toLocaleString()}. Antes se guardará una copia de lo actual.`, 'warning', () => restoreCloudBackup(b.id));
                row.append(info, btn);
                box.appendChild(row);
            });
        }

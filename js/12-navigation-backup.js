        // ==========================================
        // 24. NAVEGACIÓN MATERIAL YOU (v43)
        // ==========================================

        // 1. Nueva lógica de Pestañas (Reemplaza a la anterior)
        function switchTab(tab) {
            // A. Ocultar todas las vistas
            if($('view-home')) $('view-home').classList.add('hidden');
            if($('view-credits')) $('view-credits').classList.add('hidden');
            if($('view-history')) $('view-history').classList.add('hidden');

            // B. Mostrar la seleccionada
            const selectedView = $(`view-${tab}`);
            if (selectedView) {
                selectedView.classList.remove('hidden');
            }

            // C. Lógica específica por pestaña
            if (tab === 'credits') {
                if(typeof renderCreditsList === 'function') renderCreditsList();
            }
            if (tab === 'history') {
                 if(typeof renderHistoryTable === 'function') renderHistoryTable();
            }

            // D. Actualizar la barra visualmente (Píldoras)
            if(typeof updateMaterialNav === 'function') updateMaterialNav(tab);

            // 🟢 E. CONTROL DEL BOTÓN DEL CARRITO (Aquí está la magia) 🟢
            const fab = $('fabCart'); // Buscamos el botón por su ID
            if (fab) {
                if (tab === 'home') {
                    // Si estamos en Inventario -> MOSTRAR botón
                    fab.classList.remove('hidden'); 
                    fab.classList.add('flex'); // Asegurar que sea flexible
                } else {
                    // Si estamos en Fiados/Historial -> OCULTAR botón
                    fab.classList.add('hidden');
                    fab.classList.remove('flex');
                }
            } else {
                console.warn("⚠️ ALERTA: No encuentro el botón 'fabCart' en el HTML.");
            }
        }

        // ---------------------------------------------------------
        // 3. BACKUPS SEGUROS (Encriptación automática si hay clave)
        // ---------------------------------------------------------
        window.downloadBackup = () => {
            // Convertimos todo el estado a texto
            let dataToExport = JSON.stringify(state);
            let fileName = `backup_inv_v42_${new Date().toISOString().split('T')[0]}`;
    
            // Si la seguridad E2EE está activa, encriptamos el archivo
            if (encryptionKey) {
                try {
                    // Empaquetamos en un sobre seguro
                    const encryptedData = CryptoJS.AES.encrypt(dataToExport, encryptionKey).toString();
            
                    const secureBackup = {
                        isEncryptedBackup: true,
                        payload: encryptedData,
                        note: "Este archivo requiere Clave Maestra para ser restaurado",
                        timestamp: new Date().toISOString()
                    };
            
                    // Reemplazamos el contenido exportable por el sobre encriptado
                    dataToExport = JSON.stringify(secureBackup);
                    fileName += '_SECURE'; // Etiqueta visual para el usuario
                } catch (e) {
                    customAlert('Error al cifrar', 'Error al encriptar respaldo. Verifica tu clave.', 'error', null, 'lock');
                    return;
                }
            }

            // Proceso de descarga estándar (Blob)
            const blob = new Blob([dataToExport], { type: "application/json" });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${fileName}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        window.restoreBackup = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
    
            reader.onload = async (e) => {
                try {
                    let jsonContent = JSON.parse(e.target.result);

                    // Devuelve los datos descifrados, o null (y avisa) si la clave no sirve
                    const decryptBackup = (json, key) => {
                        try {
                            const decryptedStr = CryptoJS.AES.decrypt(json.payload, key).toString(CryptoJS.enc.Utf8);
                            if (!decryptedStr) throw new Error("Bad Key");
                            const data = JSON.parse(decryptedStr);
                            // Si funcionó y no teníamos clave en sesión, guardamos esta
                            if (!encryptionKey) {
                                encryptionKey = key;
                                localStorage.setItem('inv_enc_key', key);
                            }
                            return data;
                        } catch (err) {
                            customAlert('Clave incorrecta', 'La clave es incorrecta o el archivo está dañado.', 'error', null, 'lock');
                            return null;
                        }
                    };

                    // Confirmación final antes de sobrescribir
                    const confirmRestore = finalData => customConfirm('Restaurar respaldo', '¿Restaurar este respaldo?\nSe sobrescribirán los datos actuales y se subirán a la nube.', 'warning', async () => {
                      try {
                        // Copia de la nube antes de pisarla; si falla no se cambia nada
                        if (!await ensureCloudBackup('Antes de restaurar un respaldo')) return;
                
                        // INYECCIÓN DE DATOS (Lista Completa)
                        if (finalData.products) state.products = finalData.products;
                        if (finalData.sales) state.sales = finalData.sales;
                        if (finalData.credits) state.credits = finalData.credits;
                        if (Array.isArray(finalData.clients)) state.clients = finalData.clients;
                        state.profitArchive = (finalData.profitArchive && typeof finalData.profitArchive === 'object') ? finalData.profitArchive : {};
                        migrateClients(); // un respaldo viejo (sin clients) arma la lista desde los fiados
                        if (finalData.security) { state.security = finalData.security; migrateLegacyPin(); }
                
                        // [RECUPERADO] Métodos de pago (¡Faltaba esto!)
                        if (finalData.paymentMethods) state.paymentMethods = finalData.paymentMethods;
                
                        // [MEJORA] Restaurar también configuraciones de tasas si existen
                        if (finalData.customRate) state.customRate = finalData.customRate;
                        if (finalData.rateMode) state.rateMode = finalData.rateMode;
                        if (finalData.fiadosRateMode) state.fiadosRateMode = finalData.fiadosRateMode;
                
                        // Guardado inteligente:
                        // saveData() detectará si hay encryptionKey y subirá todo encriptado a la nube automáticamente
                        saveData({ skipLossCheck: true }); 
                
                        renderAll();
                        $('restoreInput').value = ''; // Limpiar input file
                        customAlert('Restauración exitosa', 'Restauración exitosa y sincronizada.', 'success', null, 'cloud');
                      } catch (err) {
                        console.error(err);
                        customAlert('Respaldo no válido', 'El archivo no tiene un formato válido.', 'error');
                      }
                    }, 'Restaurar', 'cloud');

                    // DETECCIÓN INTELIGENTE: ¿Es un backup encriptado?
                    if (!jsonContent.isEncryptedBackup) return confirmRestore(jsonContent);
                    if (encryptionKey) {
                        const data = decryptBackup(jsonContent, encryptionKey);
                        if (data) confirmRestore(data);
                        return;
                    }
                    // Sin clave en memoria: se pide. Si es incorrecta el cuadro sigue abierto para reintentar.
                    askForMasterKey('Respaldo cifrado', 'Introduce la Clave Maestra con la que se creó este respaldo.', true, key => {
                        const data = decryptBackup(jsonContent, key);
                        if (!data) return;
                        closeSecurityModal();
                        confirmRestore(data);
                    });
                } catch (err) {
                    console.error(err);
                    customAlert('Respaldo no válido', 'El archivo no tiene un formato válido.', 'error');
                }
            };
            reader.readAsText(file);
        };
        

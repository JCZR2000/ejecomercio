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
                    alert("Error al encriptar respaldo. Verifica tu clave.");
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
    
            reader.onload = (e) => {
                try {
                    let jsonContent = JSON.parse(e.target.result);
                    let finalData = jsonContent; // Asumimos texto plano por defecto

                    // DETECCIÓN INTELIGENTE: ¿Es un backup encriptado? 🔒
                    if (jsonContent.isEncryptedBackup) {
                        let currentKey = encryptionKey;
                
                        // Si no tenemos la clave en memoria, la pedimos
                        if (!currentKey) {
                            currentKey = prompt("📂 ARCHIVO BLINDADO DETECTADO\n\nIntroduce la Clave Maestra con la que se creó este respaldo:");
                            if (!currentKey) return alert("Restauración cancelada.");
                        }

                        try {
                            // Intentamos desencriptar
                            const bytes = CryptoJS.AES.decrypt(jsonContent.payload, currentKey);
                            const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
                    
                            if (!decryptedStr) throw new Error("Bad Key");
                    
                            finalData = JSON.parse(decryptedStr);
                    
                            // Si funcionó y no teníamos clave en sesión, guardamos esta
                            if (!encryptionKey) {
                                encryptionKey = currentKey;
                                localStorage.setItem('inv_enc_key', currentKey);
                            }
                        } catch (err) {
                            return alert("❌ Error: La clave es incorrecta o el archivo está dañado.");
                        }
                    }

                    // Confirmación final antes de sobrescribir
                    if (confirm('¿Restaurar este respaldo?\nSe sobrescribirán los datos actuales y se subirán a la nube.')) {
                
                        // INYECCIÓN DE DATOS (Lista Completa)
                        if (finalData.products) state.products = finalData.products;
                        if (finalData.sales) state.sales = finalData.sales;
                        if (finalData.credits) state.credits = finalData.credits;
                        if (finalData.security) state.security = finalData.security;
                
                        // [RECUPERADO] Métodos de pago (¡Faltaba esto!)
                        if (finalData.paymentMethods) state.paymentMethods = finalData.paymentMethods;
                
                        // [MEJORA] Restaurar también configuraciones de tasas si existen
                        if (finalData.customRate) state.customRate = finalData.customRate;
                        if (finalData.rateMode) state.rateMode = finalData.rateMode;
                        if (finalData.fiadosRateMode) state.fiadosRateMode = finalData.fiadosRateMode;
                
                        // Guardado inteligente:
                        // saveData() detectará si hay encryptionKey y subirá todo encriptado a la nube automáticamente
                        saveData(); 
                
                        renderAll();
                        $('restoreInput').value = ''; // Limpiar input file
                        alert('¡Restauración exitosa y sincronizada! ☁️✅');
                    }
                } catch (err) {
                    console.error(err);
                    alert('Error: El archivo no tiene un formato válido.');
                }
            };
            reader.readAsText(file);
        };
        

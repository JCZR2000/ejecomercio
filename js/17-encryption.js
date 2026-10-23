        // ==========================================
        // 18. ENCRIPTACIÓN DE DATOS E2EE (v43)
        // ==========================================

        // 1. ACTIVAR (Igual que antes, pero llama al render al final)
        function enableEncryption() {
            askForMasterKey("CREAR CLAVE MAESTRA", "Escribe una contraseña segura. Solo tú la sabrás.", true, (k1) => {
                closeSecurityModal();
                
                // Confirmación
                setTimeout(() => {
                    askForMasterKey("CONFIRMAR CLAVE", "Escríbela de nuevo para verificar:", true, (k2) => {
                        if (k1 !== k2) {
                            closeSecurityModal();
                            return customAlert("Error", "Las claves no coinciden.", "error");
                        }
                        
                        encryptionKey = k1;
                        localStorage.setItem('inv_enc_key', k1);
                        saveData(); 
                        renderEncryptionUI();
                        closeSecurityModal();
                        customAlert("¡Protección Activada!", "Tus datos se están encriptando y subiendo a la nube.", "success");
                    });
                }, 300);
            });
        }

        // 2. CAMBIAR CLAVE (Flujo estricto de 4 pasos)
        function changeEncryptionPassword() {
            // PASO 1: Pedir la actual
            askForMasterKey("SEGURIDAD", "Para hacer cambios, ingresa tu Clave ACTUAL:", true, (oldKey) => {
                if (oldKey !== encryptionKey) {
                    // No cerramos el modal, mostramos error ahí mismo o alerta
                    return customAlert("Error", "Clave incorrecta. Acceso denegado.", "error");
                }
                closeSecurityModal();

                // PASO 2: Pedir la nueva
                setTimeout(() => {
                    askForMasterKey("NUEVA CLAVE", "Ingresa la nueva contraseña:", true, (newKey1) => {
                        closeSecurityModal();

                        // PASO 3: Confirmar la nueva
                        setTimeout(() => {
                            askForMasterKey("CONFIRMAR NUEVA", "Repite la nueva contraseña:", true, (newKey2) => {
                                if (newKey1 !== newKey2) {
                                    closeSecurityModal();
                                    return customAlert("Error", "Las nuevas claves no coinciden.", "error");
                                }

                                // ÉXITO
                                encryptionKey = newKey1;
                                localStorage.setItem('inv_enc_key', encryptionKey);
                                saveData(); // Re-encripta todo
                                closeSecurityModal();
                                customAlert("Éxito", "Clave cambiada exitosamente.", "success");
                            });
                        }, 300);
                    });
                }, 300);
            });
        }

        // 3. DESACTIVAR (Flujo de "Arrepentimiento")
        function disableEncryption() {
            // NIVEL 1: Advertencia Inicial
            customConfirm(
                "¿Desactivar Seguridad?", 
                "Tus datos en la nube estarán seguro pero volverán a ser legibles. ¿Deseas continuar?", 
                "warning",
                () => {
                    // NIVEL 2: Confirmación Final (Doble seguridad restaurada)
                    setTimeout(() => {
                        customConfirm(
                            "⚠️ ¿REALMENTE SEGURO?", 
                            "Esta acción eliminará la capa de protección extra.\nSi continúas, tus datos dejarán de estar encriptados.", 
                            "error", // Rojo para advertir peligro
                            () => {
                                // NIVEL 3: Autenticación final
                                setTimeout(() => {
                                    askForMasterKey("AUTORIZACIÓN REQUERIDA", "Escribe tu Clave Maestra para confirmar:", true, (keyCheck) => {
                                        if (keyCheck !== encryptionKey) {
                                            return customAlert("Error", "Clave incorrecta. No se ha desactivado nada.", "error");
                                        }

                                        // EJECUCIÓN
                                        encryptionKey = null;
                                        localStorage.removeItem('inv_enc_key');
                                        saveData(); 
                                        renderEncryptionUI();
                                        closeSecurityModal();
                                        customAlert("Encriptación Desactivada", "Tus datos se han convertido a formato estándar en la nube.", "success");
                                    });
                                }, 300);
                            }
                        );
                    }, 300);
                }
            );
        }


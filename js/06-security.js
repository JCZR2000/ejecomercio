        // ==========================================
        // 5. SISTEMA DE SEGURIDAD
        // ==========================================
        function updateSecurityUI() {
            if (hasPin()) {
                $('securitySetupDiv').classList.add('hidden');
                $('securityManageDiv').classList.remove('hidden');
                $('chkLockAdd').checked = state.security.lockAdd;
                $('chkLockEdit').checked = state.security.lockEdit;
                $('chkLockCreditAdd').checked = state.security.lockCreditAdd;
                $('chkLockCreditPay').checked = state.security.lockCreditPay;
            } else {
                $('securitySetupDiv').classList.remove('hidden');
                $('securityManageDiv').classList.add('hidden');
            }
        }

        // shortcut: un PIN corto con hash se puede adivinar por fuerza bruta; protege de la lectura casual, no de un atacante con el dispositivo.
        function hashPin(pin, salt) {
            return CryptoJS.SHA256(salt + pin).toString();
        }

        function applyPin(pin) {
            const bytes = crypto.getRandomValues(new Uint8Array(16));
            const salt = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
            state.security.pinSalt = salt;
            state.security.pinHash = hashPin(pin, salt);
            delete state.security.pin;
        }

        function hasPin() {
            return !!(state.security.pinHash || state.security.pin);
        }

        function verifyPin(input) {
            if (state.security.pinHash) return hashPin(input, state.security.pinSalt) === state.security.pinHash;
            return !!state.security.pin && input === state.security.pin;
        }

        // Convierte un PIN en claro (versión vieja, local, nube o respaldo) a hash. Devuelve true si migró.
        function migrateLegacyPin() {
            if (!state.security || !state.security.pin || state.security.pinHash) return false;
            applyPin(state.security.pin);
            saveData();
            return true;
        }

        function selfTestPin() {
            const backup = state.security;
            state.security = { lockEdit: true };
            applyPin('1234');
            const h1 = state.security.pinHash;
            applyPin('1234');
            console.assert(h1 !== state.security.pinHash, 'selfTestPin: la sal debe cambiar el hash');
            console.assert(verifyPin('1234'), 'selfTestPin: PIN correcto debe pasar');
            console.assert(!verifyPin('0000'), 'selfTestPin: PIN incorrecto debe fallar');
            state.security = { pin: '9876', lockEdit: true };
            migrateLegacyPin();
            console.assert(!('pin' in state.security) && state.security.pinHash, 'selfTestPin: migración debe quitar pin');
            console.assert(verifyPin('9876') && !verifyPin('1234'), 'selfTestPin: PIN migrado');
            state.security = backup;
            saveData();
            console.log('selfTestPin terminado');
        }

        function setPin() {
            const pin = $('newPinInput').value.trim();
            if (pin.length < 4) return customAlert('Contraseña corta', 'Mínimo 4 caracteres.', 'error', null, 'lock');
            applyPin(pin);
            // Configuración por defecto al crear PIN
            state.security.lockAdd = false;
            state.security.lockEdit = true;
            state.security.lockCreditAdd = false;
            state.security.lockCreditPay = true;
            $('newPinInput').value = '';
            saveData();
            updateSecurityUI();
            customAlert('Contraseña establecida', 'La seguridad quedó activada.', 'success', null, 'lock');
        }

        function checkAuth(actionType, callback) {
            if (!hasPin()) return callback();
            let isLocked = false;
            if (actionType === 'admin' || actionType === 'profit') isLocked = true;
            if (actionType === 'wipe') isLocked = true;
            if (actionType === 'add' && state.security.lockAdd) isLocked = true;
            if (actionType === 'edit' && state.security.lockEdit) isLocked = true;
            if (actionType === 'credit_add' && state.security.lockCreditAdd) isLocked = true;
            if (actionType === 'credit_pay' && state.security.lockCreditPay) isLocked = true;

            if (!isLocked) return callback();

            pendingAction = callback;
            $('authPinInput').value = '';
            $('authModal').classList.remove('hidden');
            $('authPinInput').focus();
        }

        function submitAuth() {
            if (verifyPin($('authPinInput').value)) {
                $('authModal').classList.add('hidden');
                if (pendingAction) pendingAction();
                pendingAction = null;
            } else {
                customAlert('Incorrecto', 'La contraseña no es correcta.', 'error', () => {
                    $('authPinInput').value = '';
                    $('authPinInput').focus();
                }, 'lock');
            }
        }

        function cancelAuth() {
            $('authModal').classList.add('hidden');
            pendingAction = null;
        }

        function changePin() {
            checkAuth('admin', () => {
                askForMasterKey('Nueva contraseña', 'Escribe la nueva contraseña (mínimo 4 caracteres).', true, newPin => {
                    if (newPin.length < 4) return customAlert('Contraseña corta', 'Mínimo 4 caracteres.', 'error', null, 'lock');
                    closeSecurityModal();
                    applyPin(newPin);
                    saveData();
                    customAlert('Contraseña actualizada', 'La contraseña nueva ya está activa.', 'success', null, 'lock');
                });
            });
        }

        function removePin() {
            checkAuth('admin', () => {
                customConfirm('Eliminar seguridad', '¿Eliminar seguridad?', 'danger', () => {
                    state.security = { pinHash: null, pinSalt: null, lockAdd: false, lockEdit: false, lockCreditAdd: false, lockCreditPay: false };
                    saveData();
                    updateSecurityUI();
                }, 'Sí, eliminar', 'lock');
            });
        }

        function saveSecurityPreferences() {
            checkAuth('admin', () => {
                state.security.lockAdd = $('chkLockAdd').checked;
                state.security.lockEdit = $('chkLockEdit').checked;
                state.security.lockCreditAdd = $('chkLockCreditAdd').checked;
                state.security.lockCreditPay = $('chkLockCreditPay').checked;
                saveData();
                customAlert('Guardado', 'Preferencias de seguridad guardadas.', 'success', null, 'lock');
            });
        }


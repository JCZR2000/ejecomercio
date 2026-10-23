        // ==========================================
        // 5. SISTEMA DE SEGURIDAD
        // ==========================================
        function updateSecurityUI() {
            if (state.security.pin) {
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

        function setPin() {
            const pin = $('newPinInput').value.trim();
            if (pin.length < 4) return alert('Min 4 caracteres');
            state.security.pin = pin;
            // Configuración por defecto al crear PIN
            state.security.lockAdd = false;
            state.security.lockEdit = true;
            state.security.lockCreditAdd = false;
            state.security.lockCreditPay = true;
            $('newPinInput').value = '';
            saveData();
            updateSecurityUI();
            alert('Contraseña establecida');
        }

        function checkAuth(actionType, callback) {
            if (!state.security.pin) return callback();
            let isLocked = false;
            if (actionType === 'admin') isLocked = true;
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
            if ($('authPinInput').value === state.security.pin) {
                $('authModal').classList.add('hidden');
                if (pendingAction) pendingAction();
                pendingAction = null;
            } else {
                alert('Incorrecto');
                $('authPinInput').value = '';
                $('authPinInput').focus();
            }
        }

        function cancelAuth() {
            $('authModal').classList.add('hidden');
            pendingAction = null;
        }

        function changePin() {
            checkAuth('admin', () => {
                const newPin = prompt('Nueva contraseña:');
                if (newPin && newPin.length >= 4) {
                    state.security.pin = newPin;
                    saveData();
                    alert('Actualizada');
                }
            });
        }

        function removePin() {
            checkAuth('admin', () => {
                if (confirm('¿Eliminar seguridad?')) {
                    state.security = { pin: null };
                    saveData();
                    updateSecurityUI();
                }
            });
        }

        function saveSecurityPreferences() {
            checkAuth('admin', () => {
                state.security.lockAdd = $('chkLockAdd').checked;
                state.security.lockEdit = $('chkLockEdit').checked;
                state.security.lockCreditAdd = $('chkLockCreditAdd').checked;
                state.security.lockCreditPay = $('chkLockCreditPay').checked;
                saveData();
                alert('Guardado');
            });
        }


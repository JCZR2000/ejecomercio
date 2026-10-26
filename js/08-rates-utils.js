        // ==========================================
        // 7. TASAS DE CAMBIO Y UI RELACIONADA
        // ==========================================
        function getActiveRate() {
            if (state.rateMode === 'CUSTOM' && state.customRate > 0) return state.customRate;
            if (state.rateMode === 'EUR') return state.bcvEur > 0 ? state.bcvEur : state.bcvUsd;
            return state.bcvUsd;
        }

        function getFiadosActiveRate() {
            if (state.fiadosRateMode === 'DEFAULT') return getActiveRate();
            if (state.fiadosRateMode === 'USD') return state.bcvUsd;
            if (state.fiadosRateMode === 'EUR') return state.bcvEur > 0 ? state.bcvEur : state.bcvUsd;
            if (state.fiadosRateMode === 'CUSTOM') return state.customRate > 0 ? state.customRate : state.bcvUsd;
            return state.bcvUsd;
        }

        function setRateMode(mode) {
            state.rateMode = mode;
            saveData();
            renderAll();
            toggleMenu('config');
        }

        function setFiadosRateMode(mode) {
            state.fiadosRateMode = mode;
            saveData();
            renderAll();
            toggleMenu('fiados');
        }

        function formatMoney(amount) {
            // Formato estándar americano: 1,000.00 
            // (Coma para miles, Punto para decimales)
            const val = new Intl.NumberFormat('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            }).format(amount);

            if (state.rateMode === 'CUSTOM') return `REF ${val}`;
            if (state.rateMode === 'EUR') return `€${val}`;
            return `$${val}`;
        }

        function getSymbol() {
            if (state.rateMode === 'EUR') return '€';
            if (state.rateMode === 'CUSTOM') return 'REF';
            return '$';
        }

        function updateRateUI() {
            const activeRate = getActiveRate();
            $('displayRate').value = activeRate.toFixed(2);
            $('modalUsdDisplay').textContent = state.bcvUsd.toFixed(2);
            $('modalEurDisplay').textContent = state.bcvEur.toFixed(2);
            $('customRateBadge').classList.add('hidden');
            $('euroRateBadge').classList.add('hidden');
            
            // Reset styles
            $('rateBox').className = "bg-slate-800 p-1.5 rounded flex items-center gap-2 border border-slate-700 transition-colors";
            $('displayRate').className = "bg-transparent text-white w-16 text-sm font-mono focus:outline-none text-right cursor-default";
            $('btnModeUSD').className = "w-full flex justify-between items-center p-3 border rounded transition border-gray-200 text-gray-700";
            $('btnModeEUR').className = "w-full flex justify-between items-center p-3 border rounded transition border-gray-200 text-gray-700";
            $('customRateContainer').className = "border border-yellow-300 rounded bg-yellow-50 p-3 transition-all";

            if (state.rateMode === 'CUSTOM') {
                $('customRateBadge').classList.remove('hidden');
                $('rateBox').classList.replace('border-slate-700', 'border-yellow-500');
                $('displayRate').classList.add('text-yellow-400');
                $('customRateContainer').classList.add('ring-2', 'ring-yellow-500');
            } else if (state.rateMode === 'EUR') {
                $('euroRateBadge').classList.remove('hidden');
                $('rateBox').classList.replace('border-slate-700', 'border-green-500');
                $('displayRate').classList.add('text-green-400');
                $('btnModeEUR').classList.add('bg-green-50', 'border-green-400');
            } else {
                $('rateBox').classList.replace('border-slate-700', 'border-blue-500');
                $('displayRate').classList.add('text-blue-400');
                $('btnModeUSD').classList.add('bg-blue-50', 'border-blue-400');
            }

            // --- CORRECCIÓN AQUÍ (Botón de Tasa en Fiados) ---
            const btnFiados = $('btnFiadosToolbar');
            if (btnFiados) {
                if (state.fiadosRateMode !== 'DEFAULT') {
                    // Estado Activo (Naranja, animado, estilo cuadrado nuevo)
                    btnFiados.className = "h-10 w-10 border rounded-lg bg-orange-100 text-orange-600 border-orange-300 transition flex items-center justify-center shrink-0 animate-pulse font-bold shadow-sm hover:bg-orange-200";
                } else {
                    // Estado Inactivo (Gris, estilo cuadrado nuevo)
                    btnFiados.className = "h-10 w-10 border rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-200 transition flex items-center justify-center shrink-0";
                }
            }
            // ------------------------------------------------

            const sym = getSymbol();
            $('colHeaderCurrency').textContent = sym;
            $('cartTotalLabel').textContent = `Total ${sym}`;
            document.querySelectorAll('.dynamic-symbol-span').forEach(span => span.textContent = sym);
        }

        // Redondea a centavos al GUARDAR montos en dólares (formatMoney solo formatea al mostrar)
        function roundMoney(n) {
            return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
        }

        function selfTestMoney() {
            console.assert(roundMoney(0.1 + 0.2) === 0.3, 'selfTestMoney: 0.1 + 0.2');
            console.assert(roundMoney(1.005) === 1.01, 'selfTestMoney: 1.005');
            const debt = roundMoney(0.1 + 0.1 + 0.1);
            const paid = roundMoney(0 + 0.30);
            console.assert(roundMoney(debt - paid) === 0, 'selfTestMoney: 3 x 0.10 pagada con 0.30 queda en 0');
            console.log('selfTestMoney terminado');
        }

        // Texto del usuario, de un respaldo o de una API que se inserta como HTML
        function escapeHtml(value) {
            return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
        }

        function renderEncryptionUI() {
            const container = document.getElementById('encryptionUI');
            if (!container) return;

            if (encryptionKey) {
                // --- ESTADO: ACTIVADA (Modo Seguro) 🟢 ---
                container.innerHTML = `
                    <div class="bg-green-50 p-3 rounded border border-green-200">
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid fa-shield-halved text-green-600"></i>
                                <h4 class="font-bold text-xs text-green-800 uppercase">Encriptación E2EE</h4>
                            </div>
                            <span class="bg-green-200 text-green-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Activada</span>
                        </div>
                        <p class="text-[10px] text-green-700 mb-3">
                            Tus datos están blindados. Solo tú tienes la llave.
                        </p>
                        <p class="text-[10px] text-gray-500 mb-3 leading-tight"><i class="fa-solid fa-image mr-1"></i>Las fotos de los productos se guardan sin cifrar en la nube. Los datos (productos, ventas, fiados y configuración) sí van cifrados.</p>
                
                        <div class="grid grid-cols-2 gap-2">
                            <button onclick="changeEncryptionPassword()" class="bg-white border border-green-300 text-green-700 py-2 rounded text-xs font-bold hover:bg-green-50 transition">
                                <i class="fa-solid fa-key mr-1"></i> Cambiar Clave
                            </button>
                            <button onclick="disableEncryption()" class="bg-white border border-red-200 text-red-600 py-2 rounded text-xs font-bold hover:bg-red-50 transition">
                                <i class="fa-solid fa-lock-open mr-1"></i> Desactivar
                            </button>
                        </div>
                    </div>`;
            } else {
                // --- ESTADO: DESACTIVADA (Modo Estándar) ⚪ ---
                container.innerHTML = `
                    <div class="bg-purple-50 p-3 rounded border border-purple-200">
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid fa-lock text-purple-600"></i>
                                <h4 class="font-bold text-xs text-purple-800 uppercase">Encriptación E2EE</h4>
                            </div>
                            <span class="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Desactivada</span>
                        </div>
                        <p class="text-[10px] text-purple-600 mb-3 leading-tight">
                            Protege tus datos en la nube para que sean ilegibles sin tu contraseña.
                            <br><span class="font-bold text-red-500">Advertencia: Si olvidas la clave, pierdes los datos.</span>
                        </p>
                        <p class="text-[10px] text-gray-500 mb-3 leading-tight"><i class="fa-solid fa-image mr-1"></i>Las fotos de los productos se guardan sin cifrar en la nube. Los datos (productos, ventas, fiados y configuración) sí van cifrados.</p>
                        <button onclick="enableEncryption()" class="w-full bg-purple-600 text-white py-2 rounded text-xs font-bold shadow hover:bg-purple-700 transition">
                            <i class="fa-solid fa-shield-halved mr-1"></i> Activar Protección Extrema
                        </button>
                    </div>`;
            }
        }

        // ==========================================
        // 8. CONVERSIONES Y UTILIDADES
        // ==========================================
        function convertCurrency(source) {
            const rate = getActiveRate();
            if (rate <= 0) return;
            const usd = $('initialPayUSD');
            const bs = $('initialPayBS');
            if (source === 'USD') {
                bs.value = usd.value ? (parseFloat(usd.value) * rate).toFixed(2) : '';
            } else {
                usd.value = bs.value ? (parseFloat(bs.value) / rate).toFixed(2) : '';
            }
        }

        window.convertCreditPayment = (id, type) => {
            const rate = getFiadosActiveRate();
            const usd = $(`pay_usd_${id}`);
            const bs = $(`pay_bs_${id}`);
            if (rate <= 0) return;
            if (type === 'USD') {
                bs.value = (parseFloat(usd.value) * rate).toFixed(2);
            } else {
                usd.value = (parseFloat(bs.value) / rate).toFixed(2);
            }
        }

        function toggleMenu(menu) {
            if (menu === 'config') {
                $('configModal').classList.toggle('hidden');

                // Si el menú se está abriendo (no tiene hidden), calculamos
                if (!$('configModal').classList.contains('hidden')) {
                    updateRateUI(); // Actualizar UI de tasa
                    renderEncryptionUI(); // Menú de encriptación
                    renderCloudBackupsUI(); // Copias en la nube
                    updateStorageUsage(); // Uso de almacenamiento
                    updateCreditConfigUI(); // Configuración de créditos
                    updateSecurityUI(); // Muestra si ya hay PIN
                    renderCatalogConfigUI(); // Vitrina en línea
                }
                updateConfigUI();
            }
            if (menu === 'fiados') {
                $('fiadosRateModal').classList.toggle('hidden');
            }
        }

        function clearData(action) {
            // 1. REINICIO DE FÁBRICA (NUCLEAR) ☢️
            if (action === 'factory_reset') {
                if (confirm('⚠️ ¡PELIGRO! ⚠️\n\n¿Estás seguro de que quieres BORRAR TODO?\n\n- Se borrarán todos los productos.\n- Se borrará el historial.\n- Se borrarán los clientes y deudas.\n\nEsta acción NO se puede deshacer.')) {
                    
                    const user = auth.currentUser;
                    
                    // Función interna para borrar local y recargar
                    const wipeLocalAndReload = () => {
                        console.log("🧹 Borrando datos locales...");
                        localStorage.clear();
                        deleteImageDb().finally(() => window.location.reload()); // también las fotos locales (IndexedDB)
                    };

                    if (user) {
                        // Feedback visual
                        const btn = document.querySelector('button[onclick="requestAction(\'factory_reset\')"]');
                        if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Borrando nube...';

                        // Primero se borran los trozos (fotos y ventas); el contador fiscal NO, para no repetir números.
                        const userRef = db.collection('users').doc(user.uid);
                        const deleteChunks = async () => {
                            const snap = await userRef.collection('chunks').get();
                            for (let i = 0; i < snap.docs.length; i += 400) {
                                const b = db.batch();
                                snap.docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
                                await b.commit();
                            }
                        };

                        // SOBRESCRIBIMOS el documento con un objeto casi vacío.
                        // Al NO usar { merge: true }, esto elimina todos los campos anteriores (fiados, productos, etc).
                        // Las fotos de Storage también; si Storage falla, se sigue (no es motivo para no formatear)
                        const deleteImages = () => deleteStorageFolder(storage.ref(`users/${user.uid}`))
                            .catch(e => console.warn('No se pudieron borrar las fotos de Storage:', e.message || e));
                        deleteChunks().then(() => deleteAllCloudBackups(userRef)).then(deleteImages).then(() => userRef.set({
                            products: [],
                            sales: [],
                            credits: [],
                            paymentMethods: {},
                            security: { pin: null },
                            lastUpdated: new Date().toISOString()
                        }))
                        .then(() => {
                            console.log("✅ Nube formateada exitosamente.");
                            // SOLO AHORA, que la nube confirmó, borramos local y recargamos.
                            wipeLocalAndReload();
                        })
                        .catch(error => {
                            console.error("Error borrando nube:", error);
                            alert("Hubo un error al borrar la nube. Sin embargo, se borrarán los datos locales.");
                            wipeLocalAndReload();
                        });
                    } else {
                        // Si es modo offline, borramos directo
                        wipeLocalAndReload();
                    }
                }
            } 
            
            // 2. VACIAR SOLO INVENTARIO
            else if (action === 'clean_inv') {
                if (confirm('¿Vaciar todo el inventario de productos?\n(Las ventas y deudas se mantendrán)')) {
                    ensureCloudBackup('Antes de vaciar el inventario').then(ok => {
                        if (!ok) return;
                        state.products = [];
                        localStorage.setItem('inv_products', '[]');
                        forceClearCloud('products');
                        renderAll();
                        toggleMenu('config');
                        alert('Inventario vaciado.');
                    });
                }
            } 
            
            // 3. BORRAR SOLO HISTORIAL
            else if (action === 'clean_hist') {
                if (confirm('¿Borrar todo el historial de ventas?')) {
                    ensureCloudBackup('Antes de borrar el historial').then(ok => {
                        if (!ok) return;
                        state.sales = [];
                        localStorage.setItem('inv_sales', '[]');
                        forceClearCloud('sales');
                        renderAll();
                        toggleMenu('config');
                        alert('Historial borrado.');
                    });
                }
            }

            // 4. BORRAR SOLO FIADOS
            else if (action === 'clean_credits') {
                if (confirm('¿Eliminar TODAS las cuentas por cobrar (Fiados)?\n\nEsta acción no se puede deshacer.')) {
                    ensureCloudBackup('Antes de borrar los fiados').then(ok => {
                        if (!ok) return;
                        state.credits = [];
                        localStorage.setItem('inv_credits', '[]');
                        forceClearCloud('credits');
                        renderAll();
                        toggleMenu('config');
                        alert('Lista de fiados eliminada.');
                    });
                }
            }
        }

        // ==========================================
        // FUNCIÓN ESPECIAL: BORRADO INTENCIONAL EN NUBE
        // ==========================================
        function forceClearCloud(fieldToClear) {
            console.log(`⚠️ EJECUTANDO BORRADO FORZADO DE: ${fieldToClear}`);
            // El estado ya está vaciado: la subida normal sube lo que queda y borra los trozos sobrantes.
            // El usuario ya confirmó el borrado y la copia ya se hizo: no se pregunta otra vez.
            saveData({ allowEmpty: true, skipLossCheck: true });
        }

        function saveCustomRate() {
            const val = parseFloat($('customRateInput').value);
            if (val > 0) {
                state.customRate = val;
                setRateMode('CUSTOM');
            }
        }

        async function fetchAllRates() {
            const btn = $('refreshRateBtn');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                // 1. URL de tu API en GitHub
                // Agregamos un timestamp (?t=...) para evitar que el navegador use una versión cacheada vieja
                const cacheBuster = `?t=${new Date().getTime()}`;
                const url = 'https://raw.githubusercontent.com/JCZR2000/ComercioPrecioAPI/main/tasas_cambio.json' + cacheBuster;

                const res = await fetch(url);

                if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);

                const data = await res.json();

                // 2. Asignación de tasas (Mapeo con tu nuevo JSON)
                if (data.dolar) {
                    state.bcvUsd = parseFloat(data.dolar);
                }

                if (data.euro) {
                    state.bcvEur = parseFloat(data.euro);
                }

                // Nota: 'data.usdt' está disponible aquí para cuando implementes la función futura.
                console.log(`Tasas actualizadas (Fecha API: ${data.human_date})`);

            } catch (e) {
                console.error("Error sincronizando tasas con ComercioPrecioAPI:", e);
                // Si falla (ej. sin internet), no borramos las tasas viejas, mantenemos las locales.
            }

            saveData({ background: true }); // las tasas no marcan cambios ni provocan conflictos
            btn.innerHTML = '<i class="fa-solid fa-sync-alt"></i>';
            renderAll();
        }

        window.sortInventory = (col) => {
            if (state.sortCol === col) state.sortAsc = !state.sortAsc;
            else {
                state.sortCol = col;
                state.sortAsc = true;
            }
            renderAll();
        }


        // ==========================================
        // 17. SISTEMA DE ESTATUS (SEMÁFORO)
        // ==========================================

        // Estados posibles: 'online', 'syncing', 'offline'
        let appStatus = 'online';

        function initStatusSystem() {
            // 1. Escuchar eventos del navegador
            window.addEventListener('online', () => setAppStatus('online'));
            window.addEventListener('offline', () => setAppStatus('offline'));

            // 2. Verificar estado inicial
            if (!navigator.onLine) setAppStatus('offline');

            // 3. Hook para Firebase (Simulado por ahora, real si usamos .info/connected)
            // Si usas Realtime Database:
            /* firebase.database().ref('.info/connected').on('value', (snap) => {
                if (snap.val() === true) setAppStatus('online');
                else setAppStatus('offline');
            });
            */

            // Si el usuario intenta cerrar la pestaña mientras estamos en 'SYNCING', el navegador lo detendrá.
            window.addEventListener('beforeunload', (e) => {
                if (currentCloudState === 'SYNCING') {
                    // El mensaje estándar moderno es genérico, pero esto dispara la alerta del navegador
                    e.preventDefault();
                    e.returnValue = 'Hay datos sincronizándose con la nube. ¿Seguro que quieres salir?';
                    return e.returnValue;
                }
            });
        }

        function setAppStatus(status) {
            appStatus = status;
            const dot = document.getElementById('statusDot');
            const ping = document.getElementById('statusPing');

            if (!dot) return;

            // Resetear clases
            dot.className = "w-3 h-3 rounded-full transition-all duration-500 shadow-lg";
            ping.className = "hidden"; // Ocultar animación por defecto

            if (status === 'online') {
                // VERDE: Todo en orden, encriptado y seguro
                dot.classList.add('bg-emerald-500', 'shadow-emerald-500/50');

            } else if (status === 'syncing') {
                // AMARILLO/NARANJA: Trabajando... (Animación de pulso)
                dot.classList.add('bg-amber-400', 'shadow-amber-400/50');

                // Activar animación de "ping" (ondas)
                ping.className = "absolute top-0 left-0 w-3 h-3 rounded-full bg-amber-400 animate-ping opacity-75";

            } else if (status === 'offline') {
                // ROJO: Sin conexión (pero datos locales seguros)
                dot.classList.add('bg-rose-600', 'shadow-rose-600/50');
            }
        }

        // Modal informativo estilo "SweetAlert" pero nativo
        function showStatusInfo() {
            let title, msg, icon, color;

            if (appStatus === 'online') {
                title = "SISTEMA SEGURO";
                msg = "Conexión estable con la nube. Tus datos están encriptados (AES-256) y sincronizados.";
                icon = "fa-shield-halved";
                color = "text-emerald-500";
            } else if (appStatus === 'syncing') {
                title = "SINCRONIZANDO...";
                msg = "Guardando cambios en la nube. Por favor espera un momento.";
                icon = "fa-rotate";
                color = "text-amber-500 fa-spin";
            } else {
                title = "MODO OFFLINE";
                msg = "No hay internet. Puedes seguir trabajando; los datos se guardarán localmente y se subirán al volver la conexión.";
                icon = "fa-wifi";
                color = "text-rose-500";
            }

            // Usamos tu modal genérico o un alert bonito por ahora
            // Si tienes SweetAlert instalado (parece que no, usaremos un alert custom simple)
            const modalHtml = `
        <div id="statusModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div class="bg-white rounded-2xl shadow-2xl max-w-xs w-full overflow-hidden transform transition-all scale-100">
                <div class="p-6 text-center">
                    <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fa-solid ${icon} text-3xl ${color}"></i>
                    </div>
                    <h3 class="text-lg font-black text-slate-800 mb-2 uppercase">${title}</h3>
                    <p class="text-sm text-gray-500 leading-relaxed">${msg}</p>
                </div>
                <div class="bg-gray-50 p-3 border-t border-gray-100">
                    <button onclick="document.getElementById('statusModal').remove()" class="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-lg shadow-slate-900/20 active:scale-95 transition">
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }

        document.addEventListener('DOMContentLoaded', () => {

            // 1. INICIAR SEMÁFORO (NUEVO)
            // Lo ponemos de primero para que empiece a escuchar la red de inmediato
            initStatusSystem();

            // NO cargamos datos aquí. Esperamos a Firebase Auth.
            // Si el usuario no tiene internet, Firebase Auth usará caché y disparará el evento igual.
            // fetchAllRates(); [Función movida a initDataSync después de sincronizar]
            renderAll();

            // 2. KICKSTART v43: Forzar la interfaz correcta al abrir
            // Le damos 100ms para que el navegador respire y luego... ¡Zas! Inventario.
            setTimeout(() => {
                console.log("🚀 Arrancando interfaz v43...");

                // Forzamos el cambio a la pestaña 'home' (Inventario)
                switchTab('home');

                // Forzamos un repintado de todos los datos
                renderAll();
            }, 100);
        });


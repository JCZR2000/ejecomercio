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

        document.addEventListener('DOMContentLoaded', () => {

            // 1. INICIAR SEMÁFORO (NUEVO)
            // Lo ponemos de primero para que empiece a escuchar la red de inmediato
            initStatusSystem();

            // NO cargamos datos aquí. Esperamos a Firebase Auth.
            // Si el usuario no tiene internet, Firebase Auth usará caché y disparará el evento igual.
            // fetchAllRates(); [Función movida a initDataSync después de sincronizar]
            migrateLegacyPin();
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


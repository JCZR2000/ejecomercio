
        // ==========================================
        // 0. CONFIGURACIÓN FIREBASE (v40)
        // ==========================================
        const firebaseConfig = {
            apiKey: "AIzaSyBMjRVdh6_3-eqOlxFpjjIPOJhWgIsaJOo",
            authDomain: "ejecomercio-27f57.firebaseapp.com",
            projectId: "ejecomercio-27f57",
            storageBucket: "ejecomercio-27f57.firebasestorage.app",
            messagingSenderId: "308793787242",
            appId: "1:308793787242:web:d30cbbba17735f24e59b13",
            measurementId: "G-WEZ45JMDRS"
        };

        // Inicializar
        const app = firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();
        const storage = firebase.storage();
        let unsubscribe = null; // Para control de sincronización

        // Habilitar Persistencia Offline
        //db.enablePersistence().catch(err => {
        //    if (err.code == 'failed-precondition') console.log("Persistencia: Múltiples pestañas abiertas.");
        //    else if (err.code == 'unimplemented') console.log("Navegador no soporta persistencia.");
        //});

        const $ = (id) => document.getElementById(id);

        // ==========================================
        // 1. ESTADO GLOBAL & VARIABLES
        // ==========================================

        // Variable para recordar el estado (para el mensaje al hacer clic)
        let currentCloudState = 'ONLINE';
        
        let state = {
            // Cargamos del disco INMEDIATAMENTE. Si no hay nada, array vacío.
            products: JSON.parse(localStorage.getItem('inv_products')) || [],
            sales: JSON.parse(localStorage.getItem('inv_sales')) || [],
            credits: JSON.parse(localStorage.getItem('inv_credits')) || [],
            clients: JSON.parse(localStorage.getItem('inv_clients')) || [], // Fase 13: base de clientes
            profitArchive: JSON.parse(localStorage.getItem('inv_profitArchive')) || {}, // Fase 14: resumen por mes de fiados ya borrados
            paymentMethods: JSON.parse(localStorage.getItem('inv_payment_methods')) || { TRANSFER: {}, PAGO_MOVIL: {}, BINANCE: {}, CUSTOM: {} },
            security: JSON.parse(localStorage.getItem('inv_security')) || { pin: null, lockAdd: false, lockEdit: false, lockCreditAdd: false, lockCreditPay: false },

            lastUpdated: localStorage.getItem('inv_last_updated') || null,

            
            // Configs
            bcvUsd: parseFloat(localStorage.getItem('inv_bcv_usd')) || 0,
            bcvEur: parseFloat(localStorage.getItem('inv_bcv_eur')) || 0,
            customRate: parseFloat(localStorage.getItem('inv_custom_rate')) || 0,
            rateMode: localStorage.getItem('inv_rate_mode') || 'USD',
            fiadosRateMode: localStorage.getItem('inv_fiados_rate_mode') || 'DEFAULT',
            creditMode: localStorage.getItem('inv_credit_mode') || 'DYNAMIC', // DYNAMIC o FIXED

            // --- CONFIGURACIÓN DE RECIBO PERSONALIZADO ---
            receiptConfig: JSON.parse(localStorage.getItem('inv_receipt_config')) || {
                companyName: 'Mi Negocio',
                footer: '¡Gracias por su compra!',
                logo: null
            },

            // --- NUEVO: CONFIGURACIÓN FISCAL (SENIAT) ---
            receiptType: localStorage.getItem('inv_receipt_type') || null, // 'FISCAL' | 'PERSONALIZED'
            fiscalConfig: JSON.parse(localStorage.getItem('inv_fiscal_config')) || {
                rif: '',
                address: '',
                zip: '',
                ivaIncluded: true,
                currentNumber: 1
            },

            // Vitrina en línea (Fase 10); la cola de publicación es por dispositivo y no va aquí
            catalogConfig: JSON.parse(localStorage.getItem('inv_catalog_config')) || { enabled: false, delayMin: 5, whatsapp: '', title: '' },

            // Índice de lo último que se sabe de la nube (Fase 4): { key, chunks: { id: hash } }
            cloudManifest: JSON.parse(localStorage.getItem('inv_cloud_manifest')) || {},

            // Variables de sesión
            cart: [],
            isCloudSynced: false, 
            editingId: null, tempImg: null, activeCreditId: null, dateEditId: null,
            sortCol: 'name', sortAsc: true, filterText: '', surchargeType: 'PERCENT', creditSortMode: 'URGENCY', currentShareId: null
        };

        let pendingAction = null; // Para acciones que requieren autenticación

        // [NUEVO] Variable Maestra de Subida Real
        // Esta será nuestra única fuente de verdad. Si es true, PROHIBIDO SALIR.
        let isUploadingToCloud = false;

        // BANDERA DE CONTROL PARA TASAS
        // Evita bucles infinitos y asegura que la tasa se pida DESPUÉS de sincronizar
        let hasInitialRatesUpdate = false;

        // [NUEVO] Variable para ignorar conflictos temporalmente tras resolver uno
        let conflictCooldown = false;

        // --- E2EE (ENCRIPTACIÓN) ---
        let encryptionKey = localStorage.getItem('inv_enc_key') || null;

        // Encripta un objeto a texto cifrado
        function encryptPayload(dataObj) {
            if (!encryptionKey) return null;
            try {
                return CryptoJS.AES.encrypt(JSON.stringify(dataObj), encryptionKey).toString();
            } catch (e) {
                console.error("Error encriptando:", e);
                return null;
            }
        }

        // Desencripta texto cifrado a objeto
        function decryptPayload(ciphertext) {
            if (!encryptionKey) return null;
            try {
                const bytes = CryptoJS.AES.decrypt(ciphertext, encryptionKey);
                const originalText = bytes.toString(CryptoJS.enc.Utf8);
                return originalText ? JSON.parse(originalText) : null;
            } catch (e) {
                return null;
            }
        }


        // ==========================================
        // 15. LÓGICA DE ORDENAMIENTO DE FIADOS
        // ==========================================
        function toggleSortMenu() {
            const menu = $('sortMenuDropdown');
            menu.classList.toggle('hidden');
            
            // Actualizar checks visuales
            ['URGENCY', 'ALPHA_ASC', 'ALPHA_DESC', 'RECENT', 'DEBT_DESC', 'DEBT_ASC'].forEach(mode => {
                const icon = $(`check-${mode}`);
                if(icon) {
                    if (state.creditSortMode === mode) icon.classList.remove('hidden');
                    else icon.classList.add('hidden');
                }
            });
        }

        function setCreditSort(mode) {
            state.creditSortMode = mode;
            $('sortMenuDropdown').classList.add('hidden');
            renderCreditsList(); // Re-renderizar con el nuevo orden
        }
        
        // Cerrar menú si se hace clic fuera (Opcional, mejora UX)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button[onclick="toggleSortMenu()"]');
            const menu = $('sortMenuDropdown');
            if (!btn && !menu.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });

        // ==========================================
        // 16. SISTEMA DE COMPARTIR / RECORDATORIO (Fase 12: cobro guiado en 3 pasos)
        // El recordatorio NO registra pagos: solo pide un monto. El abono se registra con «Pagar».
        // ==========================================
        state.currentShareId = null;
        const SHARE_LAST_METHODS_KEY = 'inv_share_last_methods'; // local, no se sincroniza
        const SHARE_METHOD_KEYS = ['PAGO_MOVIL', 'TRANSFER', 'BINANCE', 'CUSTOM'];
        let shareDraft = { step: 1, debt: 0, rate: 0, rateName: '' };

        // Completa las claves que falten sin borrar datos (copias viejas pueden venir con paymentMethods: {})
        function getPaymentMethods() {
            const pm = (state.paymentMethods && typeof state.paymentMethods === 'object') ? state.paymentMethods : {};
            const defaults = {
                TRANSFER: { bank: '', account: '', id: '' },
                PAGO_MOVIL: { bank: '', phone: '', id: '' },
                BINANCE: { email: '' },
                CUSTOM: { text: '' },
                WHATSAPP: { phone: '' }
            };
            Object.keys(defaults).forEach(k => {
                pm[k] = { ...defaults[k], ...((pm[k] && typeof pm[k] === 'object') ? pm[k] : {}) };
            });
            state.paymentMethods = pm;
            return pm;
        }
        state.paymentMethods = JSON.parse(localStorage.getItem('inv_payment_methods')) || {};
        getPaymentMethods();

        // --- Funciones puras (las comprueba selfTestPaymentRequest) ---
        const pendingDebtOf = (total, paid) => Math.max(0, roundMoney(Number(total) - Number(paid)));
        const isValidShareAmount = (v, debt) => Number.isFinite(v) && v > 0 && v <= debt + 0.005;
        const calcBs = (usd, rate) => roundMoney(usd * rate);
        const formatBsPlain = (n) => roundMoney(n).toFixed(2).replace('.', ','); // para pegar en el banco: sin miles, coma decimal
        const phoneDigits = (s) => String(s || '').replace(/\D/g, '');
        const formatUsdText = (n) => '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
        const formatBsText = (n) => 'Bs ' + new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
        const clipText = (s, max) => String(s || '').trim().slice(0, max || 120);

        function formatShareDate(d) {
            const p = (n) => String(n).padStart(2, '0');
            return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
        }

        function getFiadosRateName() {
            const mode = state.fiadosRateMode === 'DEFAULT' ? state.rateMode : state.fiadosRateMode;
            if (mode === 'EUR') return 'Euro BCV';
            if (mode === 'CUSTOM') return 'personalizada';
            return 'BCV';
        }

        // Datos del enlace: base64url de JSON UTF-8 en el hash (no llega al servidor)
        function encodePaymentPayload(payload) {
            const bytes = new TextEncoder().encode(JSON.stringify(payload));
            let bin = '';
            bytes.forEach(b => bin += String.fromCharCode(b));
            return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        }

        function buildPaymentLink(payload) {
            return publicPageUrl('pagar') + '#d=' + encodePaymentPayload(payload);
        }

        // ---------- Fase 17: perfil de cobro público + enlace corto ----------
        // perfil/{uid}.json guarda marca y datos de cobro de la tienda; el enlace corto solo lleva uid, monto, tasa, fecha y métodos.
        const PAY_PROFILE_KEY = 'inv_payprofile_hash';
        const SHORT_METHOD_LETTER = { PAGO_MOVIL: 'P', TRANSFER: 'T', BINANCE: 'B', CUSTOM: 'O' };
        const SHORT_RATE_LETTER = { 'BCV': 'b', 'Euro BCV': 'e', 'personalizada': 'p' };
        const SHORT_RATE_NAME = { b: 'BCV', e: 'Euro BCV', p: 'personalizada' };
        let payProfileTimer = null;
        let payProfilePublishing = false;
        let payProfileTried = '';

        // Misma fórmula que roundMoney (js/08-rates-utils.js); pagar.html tiene una copia igual
        const calcBsFromLink = (usd, rate) => Math.round((usd * rate + Number.EPSILON) * 100) / 100;

        function buildPayProfile() {
            const c = normalizeCatalogConfig();
            const keys = SHARE_METHOD_KEYS.filter(isShareMethodConfigured);
            const methods = {};
            buildShareMethodList(keys).forEach(({ t, ...fields }) => { methods[t] = fields; });
            return {
                v: 1,
                shop: {
                    title: clipText(c.title) || clipText((state.receiptConfig || {}).companyName) || 'Mi tienda',
                    color: c.color,
                    logo: c.logoUrl,
                    wa: getShareWhatsapp()
                },
                methods
            };
        }

        const payProfileHash = (profile) => hashText(JSON.stringify(profile));
        const payProfileStoredKey = (uid, profile) => uid + ':' + payProfileHash(profile);

        async function publishPayProfile() {
            const user = auth.currentUser;
            if (!user || !navigator.onLine || payProfilePublishing) return;
            const profile = buildPayProfile();
            if (!Object.keys(profile.methods).length) return; // seguro: un estado vacío (p. ej. cifrado sin desbloquear) nunca reemplaza el perfil
            payProfilePublishing = true;
            try {
                const hash = payProfileHash(profile);
                await storage.ref(`perfil/${user.uid}.json`).putString(JSON.stringify(profile), 'raw', { contentType: 'application/json', cacheControl: 'public, max-age=60', customMetadata: { hash } });
                localStorage.setItem(PAY_PROFILE_KEY, user.uid + ':' + hash);
                const c = normalizeCatalogConfig();
                if (!c.payProfile) {
                    state.catalogConfig = { ...c, payProfile: true };
                    localStorage.setItem('inv_catalog_config', JSON.stringify(state.catalogConfig));
                    saveData();
                }
            } finally { payProfilePublishing = false; }
        }

        // Mantiene el perfil al día (3 s de espera que se reinicia con cada cambio) una vez publicado por primera vez
        function schedulePayProfile() {
            const user = auth.currentUser;
            const c = state.catalogConfig;
            if (!c || c.payProfile !== true || !user || !navigator.onLine || !state.isCloudSynced) return;
            clearTimeout(payProfileTimer);
            if (localStorage.getItem(PAY_PROFILE_KEY) === payProfileStoredKey(user.uid, buildPayProfile())) return;
            payProfileTimer = setTimeout(() => publishPayProfile().catch(e => console.warn('Perfil de cobro no publicado:', e.code || e.message || e)), 3000);
        }

        function buildShortPaymentLink({ uid, usd, rate, rateName, date, keys, wa }) {
            const q = new URLSearchParams({ u: uid, a: String(usd), r: String(rate), n: SHORT_RATE_LETTER[rateName] || 'b',
                f: formatShareDate(date).replace(/\//g, ''), m: keys.map(k => SHORT_METHOD_LETTER[k]).join('') });
            if (wa) q.set('w', wa);
            return publicPageUrl('pagar') + '#' + q.toString();
        }

        function parseShortPaymentLink(hash) {
            try {
                const q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
                const uid = q.get('u'), n = q.get('n'), f = q.get('f'), m = q.get('m'), w = q.get('w') || '';
                const dec = /^\d+(\.\d+)?$/;
                if (!/^[A-Za-z0-9]{10,40}$/.test(uid || '') || !dec.test(q.get('a') || '') || !dec.test(q.get('r') || '')) return null;
                const usd = Number(q.get('a')), rate = Number(q.get('r'));
                if (!(usd > 0) || !(rate > 0) || !SHORT_RATE_NAME[n] || !/^\d{8}$/.test(f || '') || !/^[PTBO]{1,4}$/.test(m || '') || new Set(m).size !== m.length || !/^\d{0,20}$/.test(w)) return null;
                const keys = [...m].map(l => Object.keys(SHORT_METHOD_LETTER).find(k => SHORT_METHOD_LETTER[k] === l));
                return { uid, usd, rate, rateName: SHORT_RATE_NAME[n], date: `${f.slice(0, 2)}/${f.slice(2, 4)}/${f.slice(4)}`, keys, wa: w };
            } catch (e) { return null; }
        }

        function decodePaymentPayload(hash) {
            try {
                const m = /(?:^|[#&])d=([A-Za-z0-9_-]+)/.exec(String(hash || ''));
                if (!m) return null;
                let b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
                while (b64.length % 4) b64 += '=';
                const bin = atob(b64);
                const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
                const p = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
                return (p && typeof p === 'object' && p.v === 1) ? p : null;
            } catch (e) { return null; }
        }

        // Lista de métodos con la forma del enlace a partir de los datos guardados
        function buildShareMethodList(keys) {
            const pm = getPaymentMethods();
            return keys.map(t => {
                const d = pm[t];
                if (t === 'PAGO_MOVIL') return { t, bank: clipText(d.bank), phone: phoneDigits(d.phone).slice(0, 120), id: clipText(d.id) };
                if (t === 'TRANSFER') return { t, bank: clipText(d.bank), account: clipText(d.account), id: clipText(d.id) };
                if (t === 'BINANCE') return { t, email: clipText(d.email) };
                return { t: 'CUSTOM', text: clipText(d.text, 400) };
            });
        }

        function shareMethodBlock(m, amountUsd, bsPlain) {
            if (m.t === 'PAGO_MOVIL') return `Datos para Pago Móvil:\nBanco: ${m.bank}\nTeléfono: ${phoneDigits(m.phone)}\nC.I./RIF: ${m.id}\nMonto: ${bsPlain}`;
            if (m.t === 'TRANSFER') return `Datos para Transferencia:\nBanco: ${m.bank}\nCuenta: ${m.account}\nC.I./RIF: ${m.id}\nMonto: ${bsPlain}`;
            if (m.t === 'BINANCE') return `Datos para Binance Pay:\nCorreo/ID: ${m.email}\nMonto: ${formatUsdText(amountUsd)}`;
            return `Datos para pagar:\n${m.text}`;
        }

        // opts: { debt, rate, rateName, date (Date), link ('' = sin enlace) }
        function buildShareMessage(credit, amountUsd, methods, opts) {
            const bs = calcBs(amountUsd, opts.rate);
            const debtBs = calcBs(opts.debt, opts.rate);
            const rateText = (n) => `${formatBsText(n)} a tasa ${opts.rateName} ${opts.rate} del ${formatShareDate(opts.date)}`;
            const full = !(amountUsd < opts.debt - 0.005);

            const consolidated = {};
            credit.items.forEach(i => { consolidated[i.name] = (consolidated[i.name] || 0) + i.qty; });
            const itemsList = Object.entries(consolidated).map(([name, qty]) => `- ${qty}x ${name}`).join('\n');

            let msg = `Hola ${credit.customer},\n\n`;
            if (full) msg += `Te recuerdo tu saldo pendiente de ${formatUsdText(opts.debt)} (${rateText(debtBs)}).\n`;
            else msg += `Te recuerdo tu saldo pendiente de ${formatUsdText(opts.debt)}.\nMonto a pagar: ${formatUsdText(amountUsd)} (${rateText(bs)})\n`;
            if (itemsList) msg += `\nProductos:\n${itemsList}\n`;
            methods.forEach(m => { msg += `\n${shareMethodBlock(m, amountUsd, formatBsPlain(bs))}\n`; });
            if (opts.link) msg += `\nPaga y copia los datos aquí: ${opts.link}\n`;
            return msg + '\n¡Gracias por tu compra!';
        }

        function getShareWhatsapp() {
            const fromMethods = normalizeCatalogWhatsapp(getPaymentMethods().WHATSAPP.phone);
            return fromMethods || normalizeCatalogWhatsapp((state.catalogConfig || {}).whatsapp);
        }

        // --- Asistente ---
        function getShareCredit() { return state.credits.find(x => x.id == state.currentShareId); }

        function openShareModal(id) {
            state.currentShareId = id;
            const c = getShareCredit();
            if (!c) return;
            payProfileTried = '';
            getPaymentMethods();
            shareDraft = {
                step: 1,
                debt: pendingDebtOf(calculateRealDebt(c), c.paid),
                rate: getFiadosActiveRate(),
                rateName: getFiadosRateName()
            };
            document.querySelector('input[name=shareAmtMode][value=FULL]').checked = true;
            $('shareOtherAmount').value = '';
            $('shareFullUsd').textContent = formatUsdText(shareDraft.debt);
            let last = [];
            try { last = JSON.parse(localStorage.getItem(SHARE_LAST_METHODS_KEY)) || []; } catch (e) { last = []; }
            SHARE_METHOD_KEYS.forEach(k => { $('chkM_' + k).checked = Array.isArray(last) && last.includes(k); });
            ['formTransfer', 'formMobile', 'formBinance', 'formCustom'].forEach(f => $(f).classList.add('hidden'));
            renderShareMethodCards();
            onShareAmountChange();
            shareGoStep(1);
            $('shareModal').classList.remove('hidden');
        }

        function getShareAmount() {
            const mode = document.querySelector('input[name=shareAmtMode]:checked').value;
            return mode === 'FULL' ? shareDraft.debt : parseFloat($('shareOtherAmount').value);
        }

        function onShareOtherInput() {
            document.querySelector('input[name=shareAmtMode][value=OTHER]').checked = true;
            onShareAmountChange();
        }

        function onShareAmountChange() {
            const rate = shareDraft.rate;
            const bsOf = (usd) => (rate > 0 && usd > 0) ? `≈ ${formatBsText(calcBs(usd, rate))} a tasa ${shareDraft.rateName} ${rate}` : '';
            $('shareFullBs').textContent = bsOf(shareDraft.debt);
            const other = parseFloat($('shareOtherAmount').value);
            $('shareOtherBs').textContent = Number.isFinite(other) ? bsOf(other) : '';
            const amount = getShareAmount();
            let err = '';
            if (!(rate > 0)) err = 'No hay tasa de cambio configurada.';
            else if (!isValidShareAmount(amount, shareDraft.debt)) err = shareDraft.debt > 0 ? 'El monto debe ser mayor que 0 y no mayor que la deuda pendiente.' : 'Este fiado no tiene deuda pendiente.';
            const showErr = err && (document.querySelector('input[name=shareAmtMode]:checked').value === 'FULL' || $('shareOtherAmount').value !== '');
            $('shareAmtError').textContent = err;
            $('shareAmtError').classList.toggle('hidden', !showErr);
            $('btnShareNext').disabled = !!err;
        }

        function isShareMethodConfigured(k) {
            const d = getPaymentMethods()[k];
            const f = (v) => String(v || '').trim() !== '';
            if (k === 'PAGO_MOVIL') return f(d.bank) && f(d.phone) && f(d.id);
            if (k === 'TRANSFER') return f(d.bank) && f(d.account) && f(d.id);
            if (k === 'BINANCE') return f(d.email);
            return f(d.text);
        }

        function renderShareMethodCards() {
            const pm = getPaymentMethods();
            SHARE_METHOD_KEYS.forEach(k => {
                const ok = isShareMethodConfigured(k);
                const d = pm[k];
                const chk = $('chkM_' + k);
                chk.disabled = !ok;
                if (!ok) chk.checked = false;
                $('cfgM_' + k).textContent = ok ? 'Editar' : 'Configurar';
                const summary = !ok ? 'Sin datos' : k === 'PAGO_MOVIL' ? `${d.bank} · ${d.phone}` : k === 'TRANSFER' ? `${d.bank} · ${d.account}` : k === 'BINANCE' ? d.email : d.text;
                $('sumM_' + k).textContent = summary;
            });
            onShareMethodToggle();
        }

        function getSelectedShareMethods() { return SHARE_METHOD_KEYS.filter(k => $('chkM_' + k).checked); }

        function onShareMethodToggle() {
            if (shareDraft.step === 2) $('btnShareNext').disabled = getSelectedShareMethods().length === 0;
        }

        function toggleMethodForm(k) {
            const formId = { PAGO_MOVIL: 'formMobile', TRANSFER: 'formTransfer', BINANCE: 'formBinance', CUSTOM: 'formCustom' }[k];
            const form = $(formId);
            const show = form.classList.contains('hidden');
            ['formTransfer', 'formMobile', 'formBinance', 'formCustom'].forEach(f => $(f).classList.add('hidden'));
            if (!show) return;
            const d = getPaymentMethods()[k];
            if (k === 'TRANSFER') { $('inputTransBank').value = d.bank || ''; $('inputTransAccount').value = d.account || ''; $('inputTransId').value = d.id || ''; }
            else if (k === 'PAGO_MOVIL') { $('inputMobBank').value = d.bank || ''; $('inputMobPhone').value = d.phone || ''; $('inputMobId').value = d.id || ''; }
            else if (k === 'BINANCE') $('inputBinanceEmail').value = d.email || '';
            else $('inputCustomText').value = d.text || '';
            form.classList.remove('hidden');
        }

        function savePaymentDetails(method) {
            if (!SHARE_METHOD_KEYS.includes(method)) return;
            const pm = getPaymentMethods();
            if (method === 'TRANSFER') pm.TRANSFER = { bank: $('inputTransBank').value, account: $('inputTransAccount').value, id: $('inputTransId').value };
            else if (method === 'PAGO_MOVIL') pm.PAGO_MOVIL = { bank: $('inputMobBank').value, phone: $('inputMobPhone').value, id: $('inputMobId').value };
            else if (method === 'BINANCE') pm.BINANCE = { email: $('inputBinanceEmail').value };
            else pm.CUSTOM = { text: $('inputCustomText').value };

            localStorage.setItem('inv_payment_methods', JSON.stringify(state.paymentMethods));
            saveData();
            alert('Datos de pago guardados y sincronizados.');
            ['formTransfer', 'formMobile', 'formBinance', 'formCustom'].forEach(f => $(f).classList.add('hidden'));
            renderShareMethodCards();
            if (isShareMethodConfigured(method)) { $('chkM_' + method).checked = true; onShareMethodToggle(); }
        }

        function onShareWhatsappChange() {
            const v = normalizeCatalogWhatsapp($('shareWhatsapp').value);
            const ok = isValidCatalogWhatsapp(v);
            $('shareWaError').classList.toggle('hidden', ok || v === '');
            if (ok) {
                getPaymentMethods().WHATSAPP = { phone: v };
                localStorage.setItem('inv_payment_methods', JSON.stringify(state.paymentMethods));
                saveData();
            }
            regenerateShareMessage();
        }

        function shareGoStep(n) {
            n = Math.min(3, Math.max(1, n));
            if (n === 2 && $('btnShareNext').disabled) return;
            shareDraft.step = n;
            [1, 2, 3].forEach(i => $('shareStep' + i).classList.toggle('hidden', i !== n));
            document.querySelectorAll('#shareStepper [data-step]').forEach(s => {
                const on = Number(s.dataset.step) === n;
                s.classList.toggle('text-blue-600', on);
                s.classList.toggle('text-gray-400', !on);
            });
            const setFlex = (id, show) => { $(id).classList.toggle('hidden', !show); $(id).classList.toggle('flex', show); };
            $('btnShareBack').classList.toggle('hidden', n === 1);
            $('btnShareNext').classList.toggle('hidden', n === 3);
            setFlex('btnShareCopy', n === 3);
            setFlex('btnShareSend', n === 3);
            if (n === 1) onShareAmountChange();
            if (n === 2) onShareMethodToggle();
            if (n === 3) {
                const wa = getShareWhatsapp();
                $('shareWaBox').classList.toggle('hidden', !!wa);
                if (!wa) $('shareWhatsapp').value = '';
                try { localStorage.setItem(SHARE_LAST_METHODS_KEY, JSON.stringify(getSelectedShareMethods())); } catch (e) { /* sin almacenamiento */ }
                regenerateShareMessage();
                updateShareClientWa();
            }
        }

        function regenerateShareMessage() {
            const c = getShareCredit();
            if (!c || shareDraft.step !== 3) return;
            const amount = roundMoney(getShareAmount());
            const methods = buildShareMethodList(getSelectedShareMethods());
            const now = new Date();
            const opts = { debt: shareDraft.debt, rate: shareDraft.rate, rateName: shareDraft.rateName, date: now, link: '' };
            if ($('chkIncludeLink').checked) {
                const cfg = state.catalogConfig || {};
                const user = auth.currentUser;
                const canCloud = !!user && navigator.onLine;
                const profile = canCloud ? buildPayProfile() : null;
                if (canCloud && localStorage.getItem(PAY_PROFILE_KEY) === payProfileStoredKey(user.uid, profile)) {
                    opts.link = buildShortPaymentLink({ uid: user.uid, usd: amount, rate: shareDraft.rate, rateName: shareDraft.rateName, date: now,
                        keys: getSelectedShareMethods(), wa: getShareWhatsapp() ? '' : normalizeCatalogWhatsapp($('shareWhatsapp').value) });
                } else {
                    opts.link = buildPaymentLink({
                        v: 1,
                        shop: clipText(cfg.title) || 'Mi tienda',
                        wa: getShareWhatsapp() || normalizeCatalogWhatsapp($('shareWhatsapp').value),
                        usd: amount,
                        bs: calcBs(amount, shareDraft.rate),
                        rate: shareDraft.rate,
                        rateName: shareDraft.rateName,
                        date: formatShareDate(now),
                        methods
                    });
                    // Enlace largo por ahora; al publicarse el perfil el texto pasa al corto (una sola vez por perfil, para no repetir si falla)
                    const key = payProfileStoredKey(user ? user.uid : '', profile || {});
                    if (canCloud && !payProfilePublishing && payProfileTried !== key) {
                        payProfileTried = key;
                        publishPayProfile().then(() => regenerateShareMessage()).catch(e => console.warn('Perfil de cobro no publicado:', e.code || e.message || e));
                    }
                }
            }
            $('shareMessageInput').value = buildShareMessage(c, amount, methods, opts);
        }

        function closeShareModal() {
            $('shareModal').classList.add('hidden');
        }

        function copyShareMessage(btn) {
            const text = $('shareMessageInput');
            const original = btn.innerHTML;
            const done = () => {
                btn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado!';
                setTimeout(() => btn.innerHTML = original, 2000);
            };
            text.select();
            text.setSelectionRange(0, 99999); // Para móviles
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text.value).then(done).catch(() => { document.execCommand('copy'); done(); });
            } else {
                document.execCommand('copy'); // Fallback antiguo
                done();
            }
        }

        function nativeShareMessage() {
            const text = $('shareMessageInput').value;

            // Detectamos si es un dispositivo móvil
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            // Solo usamos el menú nativo si es un móvil Y el navegador lo soporta
            if (isMobile && navigator.share) {
                navigator.share({
                    title: 'Recordatorio de Pago',
                    text: text
                }).catch(console.error);
            } else {
                // Si es PC (o no soporta share), abrimos WhatsApp Web directamente
                const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                window.open(url, '_blank');
            }
        }

        // Autoprueba (datos ficticios). Ejecutar en consola: selfTestPaymentRequest()
        function selfTestPaymentRequest() {
            let fails = 0;
            const t = (cond, msg) => { console.assert(cond, msg); if (!cond) { fails++; console.error('FALLA: ' + msg); } };
            t(pendingDebtOf(10, 15) === 0, 'deuda negativa debe quedar en 0');
            t(pendingDebtOf(100, 40.5) === 59.5, 'deuda pendiente');
            t(!isValidShareAmount(0, 50) && !isValidShareAmount(-1, 50) && !isValidShareAmount(NaN, 50), 'monto 0, negativo o vacío no es válido');
            t(!isValidShareAmount(50.01, 50), 'monto mayor que la deuda no es válido');
            t(isValidShareAmount(50, 50) && isValidShareAmount(0.01, 50), 'montos válidos');
            t(formatBsPlain(39795.49) === '39795,49' && formatBsPlain(0.5) === '0,50' && formatBsPlain(1234.5) === '1234,50', 'formatBsPlain');
            t(calcBs(10, 36.123) === 361.23 && calcBs(1, 0.005) === 0.01, 'Bs = USD x tasa a 2 decimales');
            t(phoneDigits('0424-222-1919') === '04242221919', 'teléfono solo dígitos');
            const p = { v: 1, shop: 'Bodega Ñandú Café ñ', wa: '584140000000', usd: 12.5, bs: 450.25, rate: 36.02, rateName: 'BCV', date: '26/10/2026',
                methods: [{ t: 'PAGO_MOVIL', bank: 'Banco Zeta áéí', phone: '04140000000', id: 'V12345678' }, { t: 'CUSTOM', text: 'Pagar en tienda ñ' }] };
            t(JSON.stringify(decodePaymentPayload(buildPaymentLink(p))) === JSON.stringify(p), 'enlace de ida y vuelta con acentos y ñ');
            t(decodePaymentPayload('#d=' + encodePaymentPayload({ v: 2 })) === null, 'v distinta da null');
            t(decodePaymentPayload('#d=xxx') === null && decodePaymentPayload('') === null && decodePaymentPayload('#d=e30') === null, 'JSON roto o vacío da null');
            const credit = { customer: 'Cliente Ficticio', items: [{ name: 'Producto A', qty: 2 }, { name: 'Producto A', qty: 1 }] };
            const methods = [{ t: 'PAGO_MOVIL', bank: 'Banco Zeta', phone: '0414-000-0000', id: 'V1' }, { t: 'TRANSFER', bank: 'Banco Eta', account: '0102', id: 'V1' }];
            const msg = buildShareMessage(credit, 10, methods, { debt: 20, rate: 40, rateName: 'BCV', date: new Date(2026, 9, 26), link: 'https://x/pagar.html#d=a' });
            t(msg.includes('Datos para Pago Móvil:') && msg.includes('Datos para Transferencia:'), 'mensaje con dos métodos');
            t(msg.includes('Monto: 400,00') && msg.includes('Teléfono: 04140000000') && msg.includes('Monto a pagar: $10.00') && msg.includes('- 3x Producto A') && msg.includes('26/10/2026'), 'formato del mensaje');
            const msgFull = buildShareMessage(credit, 20, methods.slice(0, 1), { debt: 20, rate: 40, rateName: 'BCV', date: new Date(2026, 9, 26), link: '' });
            t(!msgFull.includes('Monto a pagar') && !msgFull.includes('Paga y copia'), 'deuda completa sin línea de monto ni enlace');
            // Enlace corto (Fase 17)
            const sl = { uid: 'AbC123xyz789AbC123xyz789Abcd', usd: 12.5, rate: 36.02, rateName: 'Euro BCV', date: new Date(2026, 9, 30), keys: ['TRANSFER', 'PAGO_MOVIL', 'CUSTOM'], wa: '584140000000' };
            const back = parseShortPaymentLink(new URL(buildShortPaymentLink(sl)).hash);
            t(back && back.uid === sl.uid && back.usd === 12.5 && back.rate === 36.02 && back.rateName === 'Euro BCV' && back.date === '30/10/2026'
                && back.keys.join() === sl.keys.join() && back.wa === sl.wa, 'enlace corto de ida y vuelta');
            t(parseShortPaymentLink(new URL(buildShortPaymentLink({ ...sl, wa: '', keys: ['BINANCE'], rateName: 'BCV' })).hash).wa === '', 'enlace corto sin w');
            t(buildShortPaymentLink(sl).length < 140, 'el enlace corto es corto');
            ['', '#', '#u=abc&a=1&r=1&n=b&f=30102026&m=P', '#u=AbC123xyz789&a=0&r=1&n=b&f=30102026&m=P', '#u=AbC123xyz789&a=1&r=1&n=x&f=30102026&m=P',
             '#u=AbC123xyz789&a=1&r=1&n=b&f=3010&m=P', '#u=AbC123xyz789&a=1&r=1&n=b&f=30102026&m=PP', '#u=AbC123xyz789&a=1&r=1&n=b&f=30102026&m=Z',
             '#u=AbC123xyz789&a=1e3&r=1&n=b&f=30102026&m=P'].forEach(h => t(parseShortPaymentLink(h) === null, 'enlace corto dañado da null: ' + h));
            [[1234.56, 36.02], [0.01, 40], [99.995, 1]].forEach(([u, r]) => t(calcBsFromLink(u, r) === calcBs(u, r), `monto en Bs de la página = calcBs (${u} x ${r})`));
            const prof = buildPayProfile();
            t(Object.keys(prof).sort().join() === 'methods,shop,v' && prof.v === 1, 'perfil: solo v, shop y methods');
            t(Object.values(prof.methods).every(m => Object.values(m).some(x => String(x).trim() !== '')), 'perfil: sin métodos vacíos');
            ['paymentMethods', 'security', 'credits', 'sales'].forEach(s => t(!JSON.stringify(prof).includes(s), 'perfil: apareció ' + s));
            console.log(fails ? `selfTestPaymentRequest: ${fails} fallas` : 'selfTestPaymentRequest: OK');
            return fails;
        }

        // ==========================================
        // 17. SISTEMA DE MIGRACIÓN (CLIENTES VIEJOS)
        // ==========================================
        let tempMigCart = [];

        function openMigrationModal() {
            $('migSimpleAmount').value = '';
            tempMigCart = [];
            renderMigCart();
            toggleMigrationView('SIMPLE');
            $('migrationModal').classList.remove('hidden');
            $('migSimpleAmount').focus();
        }

        function closeMigrationModal() {
            $('migrationModal').classList.add('hidden');
        }

        function toggleMigrationView(view) {
            if (view === 'SIMPLE') {
                $('migViewSimple').classList.remove('hidden');
                $('migViewAdvanced').classList.add('hidden');
            } else {
                $('migViewSimple').classList.add('hidden');
                $('migViewAdvanced').classList.remove('hidden');
                $('migSearchInput').value = '';
                $('migSearchInput').focus();
            }
        }

        // --- MODO SIMPLE: Agrega un solo item genérico ---
        function addSimpleDebt() {
            const amount = parseFloat($('migSimpleAmount').value);
            if (!amount || amount <= 0) return alert('Ingresa un monto válido');

            state.cart.push({
                id: 'stub_simple_' + Date.now(),
                name: 'Saldo Anterior (Migración)',
                price: roundMoney(amount),
                qty: 1,
                subtotal: roundMoney(amount),
                isStub: true // BANDERA IMPORTANTE
            });
            
            renderCart();
            closeMigrationModal();
        }

        // --- MODO AVANZADO: Buscador y Mini-Carrito ---
        function filterMigOptions() {
            const val = $('migSearchInput').value.toLowerCase();
            const list = state.products.filter(p => p.name.toLowerCase().includes(val));
            const drop = $('migDropdown');
            drop.innerHTML = '';
            
            if(list.length === 0) drop.innerHTML = '<div class="p-2 text-xs text-gray-400">No encontrado</div>';
            
            list.forEach(p => {
                const div = document.createElement('div');
                div.className = "p-2 text-xs border-b hover:bg-indigo-50 cursor-pointer flex justify-between";
                div.innerHTML = `<span>${escapeHtml(p.name)}</span> <span class="font-bold">${formatMoney(p.price)}</span>`;
                div.onmousedown = (e) => {
                    e.preventDefault();
                    addToMigCart(p);
                    $('migSearchInput').value = '';
                    drop.classList.add('hidden');
                };
                drop.appendChild(div);
            });
            drop.classList.remove('hidden');
        }

        function addToMigCart(p) {
            // Buscamos si ya existe en el carrito temporal
            const existingItem = tempMigCart.find(i => i.id === p.id);
            
            if (existingItem) {
                // Si existe, aumentamos cantidad y recalculamos subtotal
                existingItem.qty++;
                existingItem.subtotal = roundMoney(existingItem.qty * existingItem.price);
            } else {
                // Si no existe, lo agregamos nuevo
                tempMigCart.push({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    qty: 1,
                    subtotal: p.price,
                    isStub: true
                });
            }
            renderMigCart();
        }

        function updateMigQty(idx, change) {
            const item = tempMigCart[idx];
            
            // Si es resta y hay 1, no hacemos nada (para eso está el botón de borrar X)
            if (change === -1 && item.qty <= 1) return;
            
            item.qty += change;
            item.subtotal = roundMoney(item.qty * item.price);
            renderMigCart();
        }

        function renderMigCart() {
            const tbody = $('migTableBody');
            tbody.innerHTML = '';
            
            if(tempMigCart.length === 0) {
                $('migEmptyMsg').classList.remove('hidden');
            } else {
                $('migEmptyMsg').classList.add('hidden');
                
                tempMigCart.forEach((item, idx) => {
                    // Estilo para deshabilitar el menos si es 1
                    const minusClass = item.qty <= 1 ? 'text-gray-300' : 'text-red-500 hover:text-red-700 font-bold';
                    
                    // Fila con diseño tipo "Tarjeta" simple dentro de la tabla
                    tbody.innerHTML += `
                        <tr class="border-b last:border-0 hover:bg-gray-50 transition">
                            <td class="py-2 pl-2 align-middle">
                                <div class="text-xs font-medium text-gray-700">${escapeHtml(item.name)}</div>
                            </td>

                            <td class="py-2 align-middle">
                                <div class="flex items-center justify-center gap-3">
                                    <button onclick="updateMigQty(${idx}, -1)" class="${minusClass} text-sm px-1 transition" ${item.qty <= 1 ? 'disabled' : ''}>
                                        <i class="fa-solid fa-minus"></i>
                                    </button>
                                    
                                    <span class="text-sm font-bold text-gray-800 w-4 text-center">${item.qty}</span>
                                    
                                    <button onclick="updateMigQty(${idx}, 1)" class="text-green-500 hover:text-green-700 font-bold text-sm px-1 transition">
                                        <i class="fa-solid fa-plus"></i>
                                    </button>
                                </div>
                            </td>

                            <td class="py-2 text-right align-middle font-mono text-xs font-bold text-gray-600">
                                ${formatMoney(item.subtotal)}
                            </td>

                            <td class="py-2 pr-2 text-right align-middle">
                                <button onclick="tempMigCart.splice(${idx},1);renderMigCart()" class="text-red-400 hover:text-red-600 transition px-2">
                                    <i class="fa-solid fa-times"></i>
                                </button>
                            </td>
                        </tr>`;
                });
            }
        }

        function addAdvancedDebt() {
            if (tempMigCart.length === 0) return alert('Lista vacía');
            state.cart.push(...tempMigCart);
            renderCart();
            closeMigrationModal();
        }

        // ==========================================
        // 18. LÓGICA DE BORRADO DE FIADOS
        // ==========================================
        function requestDeleteCredit(id) {
            // 1. Guardamos el ID en el input oculto del modal para usarlo al confirmar
            $('deleteTargetId').value = id;
            // 2. Buscamos el objeto del fiado en la memoria
            const c = state.credits.find(x => x.id == id);
            
            if (c) {
                // --- REGLAS DE NEGOCIO PARA RESTAURAR STOCK ---
                // No permitimos devolver stock si la cuenta ya tiene movimientos de dinero complejos.
                
                // Usamos 0.01 de tolerancia porque a veces javascript calcula 0 como 0.0000001
                const hasPayments = c.paid > 0.01; // ¿Ya pagó algo?
                const hasSurcharge = (c.surcharge || 0) > 0.01; // ¿Tiene recargos/multas?
                const hasItems = c.items && c.items.length > 0; // ¿Tiene productos físicos?

                // La condición mágica: Solo restauramos si está "Virgen" (Sin pagos, sin multas) y tiene cosas.
                const canRestore = !hasPayments && !hasSurcharge && hasItems;

                // 3. Siempre reiniciamos el checkbox desmarcado por seguridad
                $('chkRestoreStock').checked = false;

                // 4. Manipulación de la Interfaz (UI)
                if (canRestore) {
                    // CASO A: Venta limpia -> Mostramos opción de devolver stock
                    $('restoreStockContainer').classList.remove('hidden');
                    $('restoreStockBlocked').classList.add('hidden');
                } else {
                    // CASO B: Venta compleja -> Ocultamos opción
                    $('restoreStockContainer').classList.add('hidden');

                    // Solo mostramos el aviso de "Bloqueado" si realmente había productos que devolver.
                    // Si era una deuda pura de dinero (migración simple), no mostramos nada.
                    if(hasItems) $('restoreStockBlocked').classList.remove('hidden');
                    else $('restoreStockBlocked').classList.add('hidden');
                }
            }

            // 5. Finalmente, mostramos el modal
            $('deleteCreditModal').classList.remove('hidden');
        }

        // --- Es la función que permite que el modal se cierre ---
        function closeDeleteCreditModal() {
            $('deleteCreditModal').classList.add('hidden');
        }
        // --------------------------------------

        function confirmDeleteCredit() {
            // Verificamos permisos de administrador (pide PIN si existe y está configurado)
            checkAuth('admin', () => {
                const id = $('deleteTargetId').value;
                const idx = state.credits.findIndex(c => c.id == id);
                
                // SEGURIDAD: Forzamos el cierre del modal de contraseña para evitar conflictos visuales (Z-Index)
                // Seguridad extra: cerramos el modal de clave por si acaso
                $('authModal').classList.add('hidden'); 

                if (idx !== -1) {
                    try {
                        // --- 1. LÓGICA DE RESTAURACIÓN (MEJORADA) ---
                        const chk = $('chkRestoreStock');
                        const container = $('restoreStockContainer');
                        // Verificamos que esté marcado Y que sea visible (legal)
                        const shouldRestore = chk && chk.checked && container && !container.classList.contains('hidden');
                        
                        // VALIDACIÓN CRÍTICA:
                        // Solo procedemos a restaurar si:
                        // 1. El checkbox existe y está marcado.
                        // 2. El contenedor es visible (si está oculto, significa que la deuda estaba bloqueada por abonos previos).
                        if (shouldRestore) {
                            const credit = state.credits[idx];
                            if (credit.items) {
                                credit.items.forEach(item => {
                                    // REGLA DE NEGOCIO: No restauramos "Stubs" (items de migración/deuda vieja)
                                    // porque estos nunca se descontaron del inventario real.
                                    if (!item.isStub) {
                                        const prod = state.products.find(p => p.id == item.id);
                                        // PROTECCIÓN MATEMÁTICA: 
                                        // Usamos parseInt para asegurar que sumamos números y no texto.
                                        // Evita errores como: "10" (stock) + "2" (devuelto) = "102".
                                        if (prod) prod.qty = (parseInt(prod.qty) || 0) + (parseInt(item.qty) || 0);
                                    }
                                });
                            }
                        }

                        // --- BLOQUE 2: BORRADO ---
                        // Eliminamos el fiado del array principal
                        state.credits.splice(idx, 1);

                        // Guardamos los cambios en LocalStorage (Inventario + Créditos)
                        saveData();

                    } catch (error) {
                        // Si algo falla en la lógica (ej. error de cálculo), lo capturamos aquí
                        // para que no detenga la ejecución y permita cerrar la ventana.
                        console.error("Error al borrar:", error);
                    } finally {
                        // --- 3. FINALIZACIÓN (SIEMPRE SE EJECUTA) ---
                        closeDeleteCreditModal(); // 1. Cerrar el modal inmediatamente (Prioridad visual)
                        renderCreditsList(); // 2. Refrescar todas las listas para reflejar cambios (stock devuelto o fila borrada)
                        renderAll(); 
                        
                        // 3. Feedback al usuario
                        // Usamos setTimeout(50ms) para dar tiempo al navegador de eliminar el modal visualmente
                        // antes de congelar la pantalla con la alerta del sistema.
                        setTimeout(() => {
                            alert("Cliente eliminado correctamente.");
                        }, 50);
                    }
                } else {
                    // Fallback: Si por alguna razón el ID no se encuentra, cerramos el modal igual.
                    closeDeleteCreditModal();
                }
            });
        }


        // ==========================================
        // 18b. EDITAR FIADO (quitar productos)
        // ==========================================
        let editCreditId = null;

        // Sin efectos: no toca state ni el DOM.
        function planCreditItemRemoval(credit, itemIdx, qty) {
            const item = credit.items && credit.items[itemIdx];
            if (!item) return { error: 'Producto no encontrado' };
            if (credit.paidDate) return { error: 'El fiado ya está saldado' };
            qty = Number(qty);
            if (!Number.isInteger(qty) || qty < 1 || qty > item.qty) return { error: `Cantidad inválida (1 a ${item.qty})` };
            if (credit.items.length === 1 && qty === item.qty) return { error: 'Es el único producto. Para anular el fiado usa la papelera' };

            const items = credit.items.map(i => ({ ...i }));
            if (qty === item.qty) items.splice(itemIdx, 1);
            else {
                items[itemIdx].qty = item.qty - qty;
                items[itemIdx].subtotal = roundMoney(items[itemIdx].qty * item.price);
            }
            const totalDebt = state.creditMode === 'FIXED'
                ? roundMoney(credit.totalDebt - roundMoney(qty * item.price))
                : calculateRealDebt({ ...credit, items });
            if (credit.paid > totalDebt + 0.01) {
                return { error: `El cliente ya abonó ${formatMoney(credit.paid)} y el nuevo total sería ${formatMoney(totalDebt)}. Registra la devolución aparte` };
            }
            return {
                items, totalDebt,
                settled: roundMoney(totalDebt - credit.paid) <= 0.01,
                returnQty: item.isStub ? 0 : qty,
                productId: item.id
            };
        }

        function requestEditCredit(id) {
            checkAuth('admin', () => openEditCreditModal(id));
        }

        function openEditCreditModal(id) {
            const c = state.credits.find(x => x.id == id);
            if (!c) return;
            if (c.paidDate) return alert('El fiado ya está saldado');
            editCreditId = id;
            $('authModal').classList.add('hidden');
            renderEditCreditModal();
            $('editCreditModal').classList.remove('hidden');
        }

        function renderEditCreditModal() {
            const c = state.credits.find(x => x.id == editCreditId);
            if (!c) return closeEditCreditModal();
            $('editCreditTitle').innerText = `Editar fiado — ${c.customer}`;
            $('editCreditFiscal').classList.toggle('hidden', !c.fiscalNum);
            $('editCreditItems').innerHTML = c.items.map((it, i) => `
                <div class="border rounded p-2 text-xs">
                    <div class="font-bold text-gray-800">${escapeHtml(it.name)}</div>
                    ${it.isStub ? '<div class="text-[10px] text-amber-600">Deuda anterior (no vuelve al inventario)</div>' : ''}
                    <div class="text-gray-500">${it.qty} × ${formatMoney(it.price)} = ${formatMoney(it.subtotal)}</div>
                    <div class="flex gap-2 mt-1 items-center">
                        <input type="number" id="editQty_${i}" min="1" max="${it.qty}" value="${it.qty}" class="w-16 border rounded px-1 py-0.5 text-xs">
                        <button onclick="removeCreditItem(${i})" class="bg-red-100 text-red-700 px-3 py-1 rounded font-bold hover:bg-red-200">Quitar</button>
                    </div>
                </div>`).join('');
            $('editCreditDebt').innerText = `${formatMoney(roundMoney(calculateRealDebt(c) - c.paid))}`;
        }

        function closeEditCreditModal() {
            editCreditId = null;
            $('editCreditModal').classList.add('hidden');
        }

        function removeCreditItem(itemIdx) {
            const c = state.credits.find(x => x.id == editCreditId);
            if (!c) return;
            const qty = parseInt($(`editQty_${itemIdx}`).value, 10);
            const plan = planCreditItemRemoval(c, itemIdx, qty);
            if (plan.error) return alert(plan.error);

            const item = c.items[itemIdx];
            const prod = item.isStub ? null : state.products.find(p => p.id == plan.productId);
            const stockMsg = item.isStub ? 'Es deuda anterior: no se devuelven existencias.'
                : prod ? `Vuelven ${plan.returnQty} al inventario.`
                : 'El producto ya no está en el inventario: no se devuelven existencias.';
            if (!confirm(`¿Quitar ${qty}x ${item.name} del fiado de ${c.customer}? ${stockMsg} Nueva deuda: ${formatMoney(roundMoney(plan.totalDebt - c.paid))}`)) return;

            c.items = plan.items;
            c.totalDebt = plan.totalDebt;
            if (prod) prod.qty = (Number(prod.qty) || 0) + plan.returnQty;
            if (plan.settled) {
                c.paidDate = new Date().toISOString();
                setTimeout(autoPruneCredits, 500);
            }
            saveData();
            renderAll();
            if (plan.settled) {
                closeEditCreditModal();
                setTimeout(() => alert('¡Deuda saldada!'), 100);
            } else renderEditCreditModal();
        }

        function selfTestCreditEdit() {
            const bak = structuredClone({ credits: state.credits, products: state.products, sales: state.sales, creditMode: state.creditMode });
            try {
                state.sales = [];
                state.creditMode = 'FIXED';
                state.products = [{ id: 'p1', price: 1, qty: 0 }, { id: 'p2', price: 5, qty: 0 }];
                const mk = (id) => ({
                    id, customer: 'Ficticio', paid: 0, totalDebt: 30, surcharge: 0,
                    items: [
                        { id: 'p1', name: 'A', price: 1, qty: 5, subtotal: 5 },
                        { id: 'p2', name: 'B', price: 5, qty: 5, subtotal: 25 },
                        { id: 's', name: 'C', price: 0, qty: 1, subtotal: 0, isStub: true }
                    ]
                });
                const c = mk(1);
                const before = JSON.stringify(c);
                let r = planCreditItemRemoval(c, 1, 5);
                console.assert(JSON.stringify(c) === before, 'no muta el fiado');
                console.assert(!r.error && r.totalDebt === 5 && r.returnQty === 5 && r.items.length === 2, 'quitar línea entera');
                r = planCreditItemRemoval(c, 0, 2);
                console.assert(r.items[0].qty === 3 && r.items[0].subtotal === 3 && r.totalDebt === 28, 'quitar parte');
                r = planCreditItemRemoval(c, 2, 1);
                console.assert(!r.error && r.returnQty === 0, 'stub no devuelve');
                for (const q of [0, -1, 6, 1.5]) console.assert(planCreditItemRemoval(c, 0, q).error, 'qty inválida ' + q);
                const one = { ...mk('t'), items: [{ id: 'p1', name: 'A', price: 1, qty: 2, subtotal: 2 }], totalDebt: 2 };
                console.assert(planCreditItemRemoval(one, 0, 2).error, 'último producto');
                console.assert(!planCreditItemRemoval(one, 0, 1).error, 'parte del último sí');
                const paid = { ...mk(2), paid: 10 };
                console.assert(planCreditItemRemoval(paid, 1, 5).error, 'abonado mayor que nuevo total');
                const eq = { ...mk(3), paid: 5 };
                console.assert(planCreditItemRemoval(eq, 1, 5).settled === true, 'abonado igual salda');
                state.creditMode = 'DYNAMIC';
                state.products[0].price = 2;
                r = planCreditItemRemoval(mk(4), 1, 5);
                console.assert(r.totalDebt === 10, 'DYNAMIC usa precio actual');
            } finally {
                state.credits = bak.credits; state.products = bak.products; state.sales = bak.sales; state.creditMode = bak.creditMode;
            }
            console.log('selfTestCreditEdit terminado');
        }

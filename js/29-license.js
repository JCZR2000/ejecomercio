        // ==========================================
        // 29. LICENCIA PRO (Fase 30)
        // ==========================================
        // licencias/{uid} en Firestore manda; inv_license es solo la caché para funcionar sin conexión (no se sube a la nube).
        const LICENSE_KEY = 'inv_license';
        const TRIAL_DAYS = 30;
        const PLAN_DAYS = { mensual: 30, anual: 365, fundador: 365 };
        const LIFETIME_MS = Date.UTC(2100, 0, 1);
        const LICENSE_DAY_MS = 86400000;

        let licenseUnsub = null;
        let licenseTrialTried = false; // la prueba se intenta crear una vez por sesión
        let trialError = false;        // el servidor rechazó la prueba (casi siempre, la hora del teléfono)
        let adminPromise = null;       // respuesta de admin/config, una vez por sesión
        let salesInfo = null;          // admin/ventas = { wa, info }
        let adminLicenses = [];
        let adminSelected = null;

        function getCachedLicense() {
            try {
                const l = JSON.parse(localStorage.getItem(LICENSE_KEY));
                return l && typeof l.uid === 'string' && typeof l.hasta === 'number' ? l : null;
            } catch (e) { return null; }
        }
        function setCachedLicense(l) {
            try { localStorage.setItem(LICENSE_KEY, JSON.stringify(l)); } catch (e) { console.warn('Licencia: no se pudo guardar la caché', e); }
        }

        // Único punto de consulta de los candados
        function hasPro() {
            const c = getCachedLicense();
            const u = auth.currentUser;
            return !!c && (!u || c.uid === u.uid) && c.hasta > Date.now();
        }

        // Fecha nueva (ms) al activar o renovar. Pura: la usa la autoprueba.
        function extendLicense(hastaMs, nowMs, tipo) {
            if (tipo === 'socio') return LIFETIME_MS;
            if (tipo === 'fundador') return nowMs + PLAN_DAYS.fundador * LICENSE_DAY_MS;
            return Math.max(hastaMs || 0, nowMs) + PLAN_DAYS[tipo] * LICENSE_DAY_MS;
        }

        function buildTrialLicense(user, nowMs) {
            return {
                plan: 'pro', origen: 'prueba', email: user.email,
                creado: firebase.firestore.FieldValue.serverTimestamp(),
                hasta: firebase.firestore.Timestamp.fromMillis(nowMs + TRIAL_DAYS * LICENSE_DAY_MS)
            };
        }

        function stopLicense() {
            if (licenseUnsub) licenseUnsub();
            licenseUnsub = null;
            adminPromise = null;
            licenseTrialTried = false; // otra cuenta en la misma sesión también intenta su prueba
            trialError = false;
        }

        // La llama onAuthStateChanged al entrar
        function startLicense(user) {
            stopLicense();
            licenseUnsub = db.collection('licencias').doc(user.uid).onSnapshot({ includeMetadataChanges: true }, snap => {
                if (snap.metadata.hasPendingWrites) return; // la prueba cuenta solo cuando el servidor la acepta
                if (snap.exists) {
                    const d = snap.data();
                    if (!d.hasta || typeof d.hasta.toMillis !== 'function') return;
                    const hadPro = hasPro();
                    setCachedLicense({ uid: user.uid, hasta: d.hasta.toMillis(), origen: d.origen, leido: Date.now() });
                    onLicenseChanged(hadPro);
                } else if (!snap.metadata.fromCache && navigator.onLine && !licenseTrialTried) {
                    licenseTrialTried = true;
                    snap.ref.set(buildTrialLicense(user, Date.now()))
                        .catch(e => {
                            console.warn('Licencia: no se pudo crear la prueba (se reintenta al abrir de nuevo)', e.code || e.message || e);
                            if (e.code === 'permission-denied') { trialError = true; renderMyPlan(); }
                        });
                }
            }, e => console.warn('Licencia: se sigue con la caché', e.code || e.message || e));
        }

        function onLicenseChanged(hadPro) {
            renderMyPlan();
            renderCatalogConfigUI(); // incluye renderCatalogBadge
            warnLicenseExpiry();
            // De sin Pro a Pro: la vitrina y el perfil de cobro se vuelven a subir solos
            if (!hadPro && hasPro() && state.isCloudSynced) afterCloudSyncCatalog();
        }

        // Administrador = puede leer admin/config (las reglas se lo niegan a los demás)
        function isAdminUser() {
            if (!auth.currentUser) return Promise.resolve(false);
            if (!adminPromise) {
                adminPromise = db.collection('admin').doc('config').get().then(s => s.exists, e => {
                    if (e.code !== 'permission-denied') adminPromise = null; // sin red: se pregunta otra vez más tarde
                    return false;
                });
            }
            return adminPromise;
        }

        // ---------- «Mi plan» ----------
        const formatLicenseDate = (ms) => formatShareDate(new Date(ms));
        const accountCode = (uid) => String(uid || '').slice(0, 6).toUpperCase();

        function licenseStatusText(c, nowMs, online) {
            if (!c) return online ? 'Sin Pro' : 'Sin datos del plan';
            if (c.hasta <= nowMs) return `Sin Pro (venció el ${formatLicenseDate(c.hasta)})`;
            if (c.origen === 'socio' || c.hasta >= LIFETIME_MS) return 'Pro de por vida';
            if (c.origen === 'prueba') return `Prueba gratis hasta ${formatLicenseDate(c.hasta)}`;
            return `Pro hasta ${formatLicenseDate(c.hasta)}`;
        }

        // Licencia en caché de la cuenta abierta (o null)
        function currentLicense() {
            const user = auth.currentUser, cached = getCachedLicense();
            return cached && (!user || cached.uid === user.uid) ? cached : null;
        }
        const isLifetime = (c) => c.origen === 'socio' || c.hasta >= LIFETIME_MS;

        // Días que quedan, hacia arriba (0 o negativo = vencida); null sin licencia o de por vida. Pura.
        function daysLeft(c, nowMs) {
            if (!c || isLifetime(c)) return null;
            return Math.ceil((c.hasta - nowMs) / LICENSE_DAY_MS);
        }
        const daysText = (n) => n === 1 ? '1 día' : `${n} días`;

        // Chip del menú del usuario. Pura.
        function planChipInfo(c, nowMs) {
            if (!c || c.hasta <= nowMs) return { text: 'Gratis', cls: 'bg-gray-200 text-gray-600' };
            const d = daysLeft(c, nowMs);
            if (d === null) return { text: 'Pro', cls: 'bg-emerald-100 text-emerald-700' };
            if (d <= 7) return { text: `Vence en ${daysText(d)}`, cls: 'bg-amber-100 text-amber-800' };
            if (c.origen === 'prueba') return { text: `Prueba · ${daysText(d)}`, cls: 'bg-indigo-100 text-indigo-700' };
            return { text: 'Pro', cls: 'bg-emerald-100 text-emerald-700' };
        }
        function renderUserPlanChip() {
            const chip = $('userPlanChip');
            if (!chip) return;
            const info = planChipInfo(currentLicense(), Date.now());
            chip.textContent = info.text;
            chip.className = 'mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ' + info.cls;
        }

        // Aviso: desde 5 días antes de vencer hasta 3 días después; nunca de por vida. Pura.
        function shouldWarnLicense(c, nowMs) {
            const d = daysLeft(c, nowMs);
            return d !== null && d <= 5 && c.hasta - nowMs >= -3 * LICENSE_DAY_MS;
        }
        // Una vez al día por dispositivo (inv_license_warned, solo local)
        function warnLicenseExpiry() {
            const c = currentLicense(), now = Date.now(), today = new Date().toDateString();
            if (!auth.currentUser || !shouldWarnLicense(c, now)) return;
            try {
                if (localStorage.getItem('inv_license_warned') === today) return;
                localStorage.setItem('inv_license_warned', today);
            } catch (e) { return; } // sin almacenamiento no se puede recordar: mejor no repetir el aviso
            const expired = c.hasta <= now;
            customConfirm(expired ? 'Tu Pro venció' : 'Tu Pro está por vencer',
                (expired ? `Venció el ${formatLicenseDate(c.hasta)}.` : `Vence en ${daysText(daysLeft(c, now))} (${formatLicenseDate(c.hasta)}).`) + '\nRenueva para no pausar la vitrina ni el enlace de cobro.',
                'warning', null, 'Ver mi plan').then(ok => { if (ok) openMyPlan(); });
        }

        function renderMyPlan() {
            renderUserPlanChip();
            if (!$('myPlanSection')) return;
            const user = auth.currentUser;
            const c = currentLicense();
            const pro = hasPro();
            const left = pro ? daysLeft(c, Date.now()) : null;
            const note = left !== null && left <= 7 ? `Tu Pro vence en ${daysText(left)}. Renueva para no pausar la vitrina ni el enlace de cobro.`
                : (!c && trialError ? 'No se pudo activar la prueba gratis. Revisa que la fecha y la hora del teléfono sean automáticas y vuelve a abrir la app.' : '');
            $('myPlanNote').textContent = note;
            $('myPlanNote').classList.toggle('hidden', !note);
            $('myPlanStatus').textContent = licenseStatusText(c, Date.now(), navigator.onLine);
            $('myPlanStatus').className = 'font-bold ' + (pro ? 'text-emerald-700' : 'text-slate-800');
            $('myPlanEmail').textContent = user ? (user.email || '') : 'Sin sesión';
            $('myPlanCode').textContent = user ? accountCode(user.uid) : '—';
            const info = salesInfo && typeof salesInfo.info === 'string' ? salesInfo.info.slice(0, 500) : '';
            $('myPlanInfo').textContent = info; // texto de los administradores: nunca innerHTML
            $('myPlanInfo').classList.toggle('hidden', !info);
            const wa = salesInfo ? String(salesInfo.wa || '') : '';
            const lifetime = pro && c && isLifetime(c);
            $('myPlanBuyBtn').classList.toggle('hidden', !user || lifetime || !/^\d{10,15}$/.test(wa));
            $('myPlanBuyLabel').textContent = pro && c.origen !== 'prueba' ? 'Renovar' : 'Hazte Pro';
        }

        // Al abrir Ajustes (toggleMenu): estado al día, texto de venta y botón del panel
        function onConfigOpenLicense() {
            $('myPlanFeature').classList.add('hidden');
            renderMyPlan();
            if (!auth.currentUser || !navigator.onLine) return;
            db.collection('admin').doc('ventas').get()
                .then(s => { salesInfo = s.exists ? s.data() : null; renderMyPlan(); })
                .catch(e => console.warn('Mi plan: no se pudo leer el texto de venta', e.code || e.message || e));
            isAdminUser().then(ok => $('myPlanAdminBtn').classList.toggle('hidden', !ok));
        }

        // Los candados llaman aquí en vez de hacer la acción. feature: «la vitrina», «el enlace de cobro»...
        function openMyPlan(feature) {
            ['shareModal', 'dashboardModal'].forEach(id => $(id).classList.add('hidden')); // quedan por encima de Ajustes
            if ($('configModal').classList.contains('hidden')) toggleMenu('config');
            const note = $('myPlanFeature');
            note.textContent = feature ? feature.charAt(0).toUpperCase() + feature.slice(1) + ' es parte de Pro' : '';
            note.classList.toggle('hidden', !feature);
            $('myPlanSection').scrollIntoView({ block: 'start' });
        }

        function openProWhatsapp() {
            const user = auth.currentUser;
            const wa = salesInfo ? String(salesInfo.wa || '') : '';
            if (!user || !/^\d{10,15}$/.test(wa)) return;
            const text = `Hola, quiero EjeComercio Pro. Cuenta: ${user.email || ''} · Código: ${accountCode(user.uid)}`;
            window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, '_blank');
        }

        // ---------- Panel de administración ----------
        function openAdminPanel() {
            $('adminSearch').value = '';
            adminSelected = null;
            $('adminModal').classList.remove('hidden');
            renderAdminForm();
            loadAdminLicenses();
        }
        function closeAdminPanel() { $('adminModal').classList.add('hidden'); }

        async function loadAdminLicenses() {
            const box = $('adminResults');
            adminLicenses = [];
            if (!navigator.onLine) { box.textContent = 'Necesitas conexión'; return; }
            box.textContent = 'Cargando…';
            try {
                // shortcut: lista todas las licencias y filtra en el teléfono; pasar a consultas por email cuando haya cientos de cuentas.
                const snap = await db.collection('licencias').get();
                adminLicenses = snap.docs.map(d => {
                    const x = d.data();
                    return { uid: d.id, email: typeof x.email === 'string' ? x.email : '', origen: String(x.origen || ''), hasta: x.hasta && x.hasta.toMillis ? x.hasta.toMillis() : 0 };
                }).sort((a, b) => a.email.localeCompare(b.email));
            } catch (e) {
                box.textContent = 'No se pudo cargar: ' + (e.message || e.code || 'error');
                return;
            }
            if (adminSelected) adminSelected = adminLicenses.find(l => l.uid === adminSelected.uid) || null;
            renderAdminResults();
            renderAdminForm();
        }

        const filterLicenses = (list, text) => {
            const t = String(text || '').trim().toLowerCase();
            return list.filter(l => !t || l.email.toLowerCase().includes(t) || l.uid.toLowerCase().startsWith(t));
        };

        const isValidLicenseEmail = (s) => s.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

        function renderAdminResults() {
            const box = $('adminResults');
            const raw = $('adminSearch').value.trim();
            const list = filterLicenses(adminLicenses, raw);
            const now = Date.now();
            box.textContent = '';
            const count = document.createElement('p');
            count.className = 'text-[10px] text-slate-400 font-medium uppercase tracking-wide';
            count.textContent = `${list.length} de ${adminLicenses.length} cuentas`;
            box.append(count);
            list.slice(0, 100).forEach(l => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'w-full text-left p-2 rounded-xl border text-xs ' + (adminSelected && adminSelected.uid === l.uid ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white');
                const top = document.createElement('span');
                top.className = 'block font-bold text-slate-700 break-all';
                top.textContent = `${l.email || '(sin correo)'} · ${accountCode(l.uid)}`;
                const sub = document.createElement('span');
                sub.className = 'block ' + (l.hasta <= now ? 'text-red-600 font-bold' : 'text-slate-500');
                sub.textContent = `${l.origen} · ${l.hasta >= LIFETIME_MS ? 'de por vida' : (l.hasta <= now ? 'venció el ' : 'hasta ') + formatLicenseDate(l.hasta)}`;
                b.append(top, sub);
                b.onclick = () => { adminSelected = l; $('adminEmail').value = ''; renderAdminResults(); renderAdminForm(); };
                box.append(b);
            });
            // Cuenta que aún no abrió la versión nueva: se crea su licencia pegando el uid completo
            if (!list.length && /^[A-Za-z0-9]{20,}$/.test(raw)) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'w-full bg-indigo-50 text-indigo-700 border border-indigo-200 py-2 rounded-xl text-xs font-bold';
                b.textContent = 'Crear licencia para este uid';
                b.onclick = () => { adminSelected = { uid: raw, email: '', origen: '', hasta: 0 }; $('adminEmail').value = ''; renderAdminForm(); };
                box.append(b);
            }
        }

        function renderAdminForm() {
            const l = adminSelected;
            $('adminForm').classList.toggle('hidden', !l);
            if (!l) return;
            $('adminAccount').textContent = `${l.email || 'uid ' + l.uid} · ${accountCode(l.uid)}`;
            $('adminEmailBox').classList.toggle('hidden', !!l.email); // solo si la licencia aún no tiene correo
            const hasta = extendLicense(l.hasta, Date.now(), $('adminType').value);
            $('adminNewDate').textContent = hasta >= LIFETIME_MS ? 'Pro de por vida' : 'Pro hasta el ' + formatLicenseDate(hasta);
        }

        async function activateLicense() {
            const l = adminSelected, admin = auth.currentUser;
            if (!l || !admin) return;
            if (!navigator.onLine) { customAlert('Sin conexión', 'Necesitas conexión para activar.', 'error'); return; }
            const tipo = $('adminType').value, moneda = $('adminCurrency').value;
            const montoText = $('adminAmount').value.trim(), monto = Number(montoText);
            const nota = $('adminNote').value.trim().slice(0, 120);
            if (!['mensual', 'anual', 'fundador', 'socio'].includes(tipo) || !['USD', 'VES'].includes(moneda)) return;
            if (montoText === '' || !isFinite(monto) || monto < 0) { customAlert('Monto no válido', 'Escribe el monto cobrado (0 si no se cobró).', 'error'); return; }
            // El correo solo se escribe si la licencia no lo tiene (creada por uid); la regla no deja cambiarlo después
            const email = l.email ? '' : $('adminEmail').value.trim().toLowerCase();
            if (email && !isValidLicenseEmail(email)) { customAlert('Correo no válido', 'Revisa el correo o déjalo vacío.', 'error'); return; }
            const hastaMs = extendLicense(l.hasta, Date.now(), tipo);
            const when = hastaMs >= LIFETIME_MS ? 'de por vida' : 'hasta el ' + formatLicenseDate(hastaMs);
            if (!await customConfirm('Activar Pro', `${l.email || email || 'uid ' + l.uid}\nTipo: ${tipo}\nPro ${when}`, 'warning', null, 'Activar')) return;
            const TS = firebase.firestore.Timestamp, now = firebase.firestore.FieldValue.serverTimestamp();
            const hasta = TS.fromMillis(hastaMs);
            const ref = db.collection('licencias').doc(l.uid);
            const hist = { tipo, hastaAntes: l.hasta ? TS.fromMillis(l.hasta) : null, hastaNueva: hasta, monto, moneda, por: admin.uid, at: now };
            if (PLAN_DAYS[tipo]) hist.dias = PLAN_DAYS[tipo];
            if (nota) hist.nota = nota;
            const batch = db.batch();
            // merge: se conservan email y creado (la regla rechaza cambiar el email)
            const lic = { plan: 'pro', hasta, origen: tipo === 'mensual' || tipo === 'anual' ? 'pago' : tipo, actualizado: now, por: admin.uid };
            if (email) lic.email = email;
            batch.set(ref, lic, { merge: true });
            batch.set(ref.collection('historial').doc(), hist);
            busyStart('Activando...');
            try {
                await batch.commit();
            } catch (e) {
                busyEnd();
                console.warn('Licencia no activada:', e);
                customAlert('No se pudo activar', e.message || e.code || 'Intenta de nuevo.', 'error');
                return;
            }
            busyEnd();
            customAlert('Pro activado', `Pro activado ${when}.`, 'success');
            $('adminAmount').value = '0';
            $('adminNote').value = '';
            $('adminEmail').value = '';
            loadAdminLicenses();
        }

        // ---------- Autoprueba (consola): selfTestLicense() ----------
        function selfTestLicense() {
            let fails = 0;
            const t = (ok, name) => { console.assert(ok, 'selfTestLicense: ' + name); if (!ok) fails++; };
            const D = LICENSE_DAY_MS, now = Date.UTC(2026, 10, 15);
            t(extendLicense(now + 10 * D, now, 'mensual') === now + 40 * D, 'mensual desde una fecha futura suma 30 d a esa fecha');
            t(extendLicense(now - 10 * D, now, 'mensual') === now + 30 * D, 'mensual desde una vencida suma 30 d a ahora');
            t(extendLicense(0, now, 'mensual') === now + 30 * D, 'mensual sin licencia previa');
            t(extendLicense(now + 10 * D, now, 'anual') === now + 375 * D, 'anual suma 365 d');
            t(extendLicense(now + 900 * D, now, 'fundador') === now + 365 * D, 'fundador = ahora + 365 d sin importar lo anterior');
            t(extendLicense(now + 10 * D, now, 'socio') === Date.UTC(2100, 0, 1), 'socio = 2100-01-01');

            const bak = localStorage.getItem(LICENSE_KEY);
            try {
                const uid = auth.currentUser ? auth.currentUser.uid : 'prueba-uid';
                setCachedLicense({ uid, hasta: Date.now() + D, origen: 'pago', leido: Date.now() });
                t(hasPro() === true, 'caché vigente del mismo uid');
                setCachedLicense({ uid, hasta: Date.now() - 1, origen: 'pago', leido: Date.now() });
                t(hasPro() === false, 'caché vencida');
                if (auth.currentUser) {
                    setCachedLicense({ uid: uid + 'x', hasta: Date.now() + D, origen: 'pago', leido: Date.now() });
                    t(hasPro() === false, 'caché de otro uid');
                } else console.log('selfTestLicense: sin sesión, no se probó la caché de otro uid');
                localStorage.removeItem(LICENSE_KEY);
                t(hasPro() === false, 'sin caché');
                localStorage.setItem(LICENSE_KEY, '{mal');
                t(hasPro() === false, 'caché dañada');
            } finally {
                if (bak === null) localStorage.removeItem(LICENSE_KEY); else localStorage.setItem(LICENSE_KEY, bak);
            }

            const n = Date.now(), trial = buildTrialLicense({ email: 'prueba@example.com' }, n), h = trial.hasta.toMillis();
            t(h > n + 29 * D && h <= n + 31 * D, 'la prueba dura entre 29 y 31 días');
            t(trial.plan === 'pro' && trial.origen === 'prueba' && Object.keys(trial).sort().join() === 'creado,email,hasta,origen,plan', 'la prueba lleva solo los campos de la regla');

            t(licenseStatusText(null, now, true) === 'Sin Pro' && licenseStatusText(null, now, false) === 'Sin datos del plan', 'estado sin licencia');
            t(licenseStatusText({ hasta: now - D, origen: 'prueba' }, now, true).startsWith('Sin Pro (venció el '), 'estado vencido');
            t(licenseStatusText({ hasta: now + D, origen: 'prueba' }, now, true).startsWith('Prueba gratis hasta '), 'estado de prueba');
            t(licenseStatusText({ hasta: now + D, origen: 'pago' }, now, true).startsWith('Pro hasta '), 'estado Pro');
            t(licenseStatusText({ hasta: LIFETIME_MS, origen: 'socio' }, now, true) === 'Pro de por vida', 'estado de por vida');

            t(daysLeft(null, now) === null && daysLeft({ hasta: LIFETIME_MS, origen: 'socio' }, now) === null && daysLeft({ hasta: now + 400 * D, origen: 'socio' }, now) === null, 'daysLeft: sin licencia o de por vida');
            t(daysLeft({ hasta: now + 3 * D, origen: 'pago' }, now) === 3 && daysLeft({ hasta: now + 2.1 * D, origen: 'pago' }, now) === 3 && daysLeft({ hasta: now + 1, origen: 'pago' }, now) === 1 && daysLeft({ hasta: now - 2 * D, origen: 'pago' }, now) === -2, 'daysLeft: días hacia arriba');
            t(planChipInfo(null, now).text === 'Gratis' && planChipInfo({ hasta: now - 1, origen: 'pago' }, now).text === 'Gratis', 'chip: gratis');
            t(planChipInfo({ hasta: now + 20 * D, origen: 'prueba' }, now).text === 'Prueba · 20 días' && planChipInfo({ hasta: now + 20 * D, origen: 'pago' }, now).text === 'Pro', 'chip: prueba y Pro');
            t(planChipInfo({ hasta: now + 3 * D, origen: 'pago' }, now).text === 'Vence en 3 días' && planChipInfo({ hasta: now + D, origen: 'prueba' }, now).text === 'Vence en 1 día' && planChipInfo({ hasta: LIFETIME_MS, origen: 'socio' }, now).text === 'Pro', 'chip: por vencer y de por vida');
            t(shouldWarnLicense({ hasta: now + 5 * D, origen: 'pago' }, now) && !shouldWarnLicense({ hasta: now + 6 * D, origen: 'pago' }, now) && shouldWarnLicense({ hasta: now - 3 * D, origen: 'pago' }, now) && !shouldWarnLicense({ hasta: now - 4 * D, origen: 'pago' }, now), 'aviso: de 5 días antes a 3 días después');
            t(!shouldWarnLicense(null, now) && !shouldWarnLicense({ hasta: LIFETIME_MS, origen: 'socio' }, now), 'aviso: nunca sin licencia ni de por vida');

            const list = [{ uid: 'AbCdEf123', email: 'Uno@Example.com' }, { uid: 'zzz999', email: '' }];
            t(filterLicenses(list, 'uno@').length === 1 && filterLicenses(list, 'abcdef').length === 1 && filterLicenses(list, '').length === 2 && filterLicenses(list, 'nadie').length === 0, 'buscador por correo o código');

            t(isValidLicenseEmail('prueba@example.com') && !isValidLicenseEmail('prueba@') && !isValidLicenseEmail('a b@example.com') && !isValidLicenseEmail('x'.repeat(120) + '@example.com'), 'correo de la licencia');

            console.log(fails ? `selfTestLicense: ${fails} fallas` : 'selfTestLicense: OK');
            return fails;
        }

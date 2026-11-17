        // ==========================================
        // 31. DISEÑO «MOSTRADOR» OPCIONAL (Fase 39)
        // ==========================================
        // UI2 (global) lo fija el script del <head> con inv_ui = '2'. La preferencia es de este dispositivo: no sube a la nube.

        // Iconos de trazo (estilo Lucide, 2 px), rutas de los artboards del diseño. Texto fijo: no lleva datos del usuario.
        const UI2_ICONS = {
            box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
            users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M17 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
            clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
            inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
            chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
            coins: '<circle cx="9" cy="9" r="6"/><path d="M15.5 9.5a6 6 0 1 1-6 6"/><path d="M9 6.5v5M7.5 8h2.2a1 1 0 0 1 0 2H8.3a1 1 0 0 0 0 2h2.2"/>',
            crown: '<path d="m3 8 4 4 5-7 5 7 4-4-2 11H5z"/>',
            sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
            download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
            logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
            lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
            cloud: '<path d="M17.5 19H8a5 5 0 1 1 1.4-9.8A6 6 0 0 1 21 11.5 4 4 0 0 1 17.5 19z"/>',
            store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/>',
            more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
            user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
            swap: '<path d="m17 3 4 4-4 4"/><path d="M3 11V9a2 2 0 0 1 2-2h16"/><path d="m7 21-4-4 4-4"/><path d="M21 13v2a2 2 0 0 1-2 2H3"/>'
        };

        function icon(name, size) {
            const s = Number(size) || 20;
            return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${UI2_ICONS[name] || ''}</svg>`;
        }

        // Rellena los <span data-icon="nombre" data-size="N"> del armazón nuevo
        document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon, el.dataset.size); });

        // Un solo botón alterna entre los dos diseños. Se guarda y se recarga: no se redibuja en caliente.
        async function toggleDesign() {
            if (state.cart.length > 0) {
                const ok = await customConfirm('Venta sin cobrar', 'Tienes una venta sin cobrar. Al cambiar de diseño se vacía el carrito.', 'warning', null, 'Cambiar de diseño');
                if (!ok) return;
            }
            await waitForUpload();
            if (UI2) {
                try { localStorage.removeItem('inv_ui'); } catch (e) {}
            } else if (!safeSetItem('inv_ui', '2')) {
                return customAlert('Diseño', 'No se pudo guardar la preferencia en este dispositivo.', 'error');
            }
            location.reload();
        }

        // En esta fase el botón solo lo ve el administrador. Dentro del diseño nuevo se ve siempre, para poder volver.
        document.addEventListener('DOMContentLoaded', () => auth.onAuthStateChanged(() => {
            const btn = $('btnToggleDesign');
            if (!btn) return;
            if (UI2) return btn.classList.remove('hidden');
            isAdminUser().then(ok => btn.classList.toggle('hidden', !ok));
        }));

        // Autoprueba (consola): selfTestUi2()
        function selfTestUi2() {
            const payload = buildCloudPayload();
            const noUiInCloud = !Object.keys(payload).some(k => /^(inv_)?ui$/.test(k)) && !JSON.stringify(payload).includes('"inv_ui"');
            const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
            const dupIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
            const leftover = document.querySelectorAll(`[data-ui="${UI2 ? '1' : '2'}"]`).length;
            const iconOk = icon('box').startsWith('<svg') && icon('nada').includes('aria-hidden="true"');
            console.assert(noUiInCloud, 'inv_ui no debe estar en buildCloudPayload()');
            console.assert(dupIds.length === 0, 'Hay id repetidos en el DOM:', dupIds);
            console.assert(leftover === 0, 'Quedan bloques del diseño inactivo:', leftover);
            console.assert(iconOk, 'icon() no devuelve un SVG');
            const ok = noUiInCloud && dupIds.length === 0 && leftover === 0 && iconOk;
            console.log(ok ? '✅ selfTestUi2: todo bien' : '❌ selfTestUi2: revisar', { ui2: UI2, noUiInCloud, dupIds, leftover, iconOk });
            return ok;
        }

        // ==========================================
        // 23. SISTEMA DE RECIBOS (v42)
        // ==========================================
        let tempReceiptData = null; // Variable volátil para pasar datos al modal

        // --- MANEJO DE CONFIGURACIÓN ---
        function toggleReceiptConfig() {
            const panel = $('receiptConfigPanel');
            panel.classList.toggle('hidden');
            
            // Cargar datos actuales
            if (!panel.classList.contains('hidden')) {
                $('cfgCompanyName').value = state.receiptConfig.companyName || '';
                $('cfgFooter').value = state.receiptConfig.footer || '';
                $('cfgHeaderInfo').value = state.receiptConfig.headerInfo || '';
                // QR de la tienda: necesita vitrina activa y sesión (enlace público)
                const qrBox = $('cfgShowShopQr'), qrNote = $('cfgShopQrNote');
                const cat = normalizeCatalogConfig();
                const qrOk = cat.enabled && !!catalogPublicUrl();
                qrBox.disabled = !qrOk;
                qrBox.checked = qrOk && state.receiptConfig.showShopQr === true;
                qrNote.textContent = !qrOk ? 'Activa la vitrina en Ajustes para usarlo' : (!cat.slug ? 'Ponle nombre a tu vitrina para un enlace más corto' : '');
                qrNote.classList.toggle('hidden', !qrNote.textContent);
                if (state.receiptConfig.logo) {
                    $('receiptLogoPreview').src = state.receiptConfig.logo;
                    $('receiptLogoPreview').classList.remove('hidden');
                    $('receiptLogoIcon').classList.add('hidden');
                }
            }
        }

        function previewReceiptLogo(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Máximo 300 px por lado, PNG para conservar la transparencia
                    const scale = Math.min(1, 300 / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    $('receiptLogoPreview').src = canvas.toDataURL('image/png');
                    $('receiptLogoPreview').classList.remove('hidden');
                    $('receiptLogoIcon').classList.add('hidden');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        function removeReceiptLogo() {
            $('receiptLogoInput').value = '';
            $('receiptLogoPreview').src = '';
            $('receiptLogoPreview').classList.add('hidden');
            $('receiptLogoIcon').classList.remove('hidden');
        }

        function saveReceiptConfig() {
            // 1. Obtener valores de los Inputs
            const nameInput = $('cfgCompanyName').value;
            const footerInput = $('cfgFooter').value;

            // 2. Guardar en el Estado (Limpiando espacios)
            state.receiptConfig.companyName = nameInput.trim();
            state.receiptConfig.footer = footerInput.trim();
            state.receiptConfig.headerInfo = $('cfgHeaderInfo').value.trim().slice(0, 60);
            // Si el interruptor está deshabilitado (sin vitrina) se conserva lo guardado
            if (!$('cfgShowShopQr').disabled) state.receiptConfig.showShopQr = $('cfgShowShopQr').checked === true;

            // 3. Guardar preferencia de "Mostrar Bolívares"
            const chkBs = $('chkReceiptBs');
            if (chkBs) {
                state.receiptConfig.showBs = chkBs.checked;
            }

            // 3. Manejo del Logo
            const preview = $('receiptLogoPreview');

            // Validamos si la imagen está visible y tiene contenido
            // IMPORTANTE: Esto asume que preview.src es una DataURL (Base64)
            if (preview.src && !preview.classList.contains('hidden')) {
                state.receiptConfig.logo = preview.src;
            } else {
                state.receiptConfig.logo = null;
            }

            // 4. Guardar y Sincronizar
            // No necesitamos guardar en 'inv_receipt_config' por separado 
            // porque state.receiptConfig ya viaja dentro del state principal.

            saveData(); // <--- ESTO es lo que sube todo a Firebase (Nube) y guarda en LocalStorage

            toggleReceiptConfig();
            updateReceiptPreview();
            alert('Configuración guardada y sincronizada ☁️');
        }

        // --- APERTURA DE MODALES ---

        // --- RUTEADOR DE RECIBOS ---
        // Pura: a dónde va el recibo. Los abonos nuevos (sin número de factura) siempre llevan el recibo personalizado (Fase 21).
        function receiptTarget(data) {
            if (data.type === 'payment' && !data.isCredit && !data.fiscalNum) return 'personalized';
            if (!state.receiptType) return 'choose'; // nunca ha elegido: modal de elección
            if (state.receiptType === 'FISCAL') return state.fiscalConfig.rif ? 'fiscal' : 'fiscalConfig';
            return 'personalized';
        }

        // Trae del registro guardado (venta o fiado) el número, la fecha del número y la factura emitida, que pudieron cambiar después de armar el recibo
        function syncReceiptRecord(data) {
            const rec = (data.isCredit ? state.credits : state.sales).find(x => x.id == data.id);
            if (!rec) return data;
            ['fiscalNum', 'payNum', 'numAt', 'numPending', 'invoice', 'bcvRate', 'method', 'methodRef', 'clientId'].forEach(k => { if (k in rec) data[k] = rec[k]; else delete data[k]; });
            return data;
        }

        function routeReceipt(data) {
            syncReceiptRecord(data);
            tempReceiptData = data; // Guardamos contexto

            const target = receiptTarget(data);
            if (target === 'choose') $('invoiceTypeModal').classList.remove('hidden');
            else if (target === 'fiscalConfig') $('fiscalConfigModal').classList.remove('hidden');
            else if (target === 'fiscal') prepareFiscalReceiptModal(data);
            else prepareReceiptModal(data);
        }

        // A. Desde el Modal de Éxito
        async function openReceiptFromSuccess() {
            const dataToUse = tempReceiptData;
            if (!dataToUse) return;
            closeSuccessModal();
            syncReceiptRecord(dataToUse);
            // Con red, se espera un momento a que el recibo salga ya con su número
            if (dataToUse.numPending && navigator.onLine) await Promise.race([assignPendingNumbers(), new Promise(r => setTimeout(r, 4000))]);
            routeReceipt(dataToUse);
        }

        function closeSuccessModal() {
            $('successModal').classList.add('hidden');
            if ($('successMsg')) $('successMsg').textContent = 'Los datos se han guardado correctamente.';
            if ($('successTitle')) $('successTitle').textContent = '¡Operación Exitosa!';
            if ($('successOrderWa')) $('successOrderWa').classList.add('hidden');
            // tempReceiptData = null; // ¡NO LIMPIAR AQUÍ, lo necesitamos para el ruteador!
        }

        // B. Desde Historial
        function openReceiptFromHistory(saleId) {
            const sale = state.sales.find(s => s.id == saleId);
            if (!sale) return;
            routeReceipt(paymentReceiptData(sale));
        }

        // Datos del recibo desde una venta o abono guardado (Historial y abono recién cobrado)
        function paymentReceiptData(sale) {
            const note = parseSaleBalanceNote(sale);
            return {
                id: sale.id,
                items: sale.items,
                total: sale.total,
                date: sale.date,
                customer: note.customer,
                toBalance: note.toBalance,
                type: sale.type,
                isHistory: true,
                fiscalNum: sale.fiscalNum,
                payNum: sale.payNum,
                numAt: sale.numAt,
                numPending: sale.numPending,
                invoice: sale.invoice,
                rate: sale.rate,
                method: sale.method,
                methodRef: sale.methodRef,
                clientId: sale.clientId,
                creditId: sale.creditId,
                debtBefore: sale.debtBefore,
                debtTotal: sale.debtTotal,
                debtAfter: sale.debtAfter
            };
        }

        // C. Desde Fiados
        function openReceiptFromCredit(creditId) {
            const credit = state.credits.find(c => c.id == creditId);
            if (!credit) return;
            const realTotal = calculateRealDebt(credit);
            routeReceipt({
                id: credit.id,
                items: credit.items,
                total: realTotal,
                paid: credit.paid,
                date: credit.date,
                customer: credit.customer,
                isCredit: true,
                fromList: true,
                fiscalNum: credit.fiscalNum,
                numAt: credit.numAt,
                numPending: credit.numPending,
                invoice: credit.invoice,
                clientId: credit.clientId
            });
        }

        // Estado de cuenta del recibo. Sin DOM. Devuelve { rows: [[etiqueta, monto]], remaining, pct } o null (venta o abono viejo).
        function receiptAccount(data) {
            const pctOf = (total, remaining) => total > 0 ? Math.min(100, Math.max(0, Math.round((total - remaining) / total * 100))) : 100;
            if (data.isCredit) {
                const paidBefore = data.paidBefore || 0;
                const balanceUsed = data.balanceUsed || 0;
                const paid = data.paid || 0;
                const remaining = roundMoney(data.total - paidBefore - paid - balanceUsed);
                const today = paidBefore > 0 || data.addedToday > 0 || !data.fromList;
                const rows = [['Total del fiado', data.total]];
                if (data.addedToday > 0) rows.push(['Agregado hoy', data.addedToday]);
                if (paidBefore > 0) rows.push(['Abonado antes', paidBefore]);
                rows.push([today ? 'Abonado hoy' : 'Abonado', paid]);
                if (balanceUsed > 0) rows.push(['Pagado con saldo a favor', balanceUsed]);
                return { rows, remaining, pct: pctOf(data.total, remaining) };
            }
            if (data.type === 'payment' && typeof data.debtBefore === 'number') {
                const toBalance = data.toBalance || 0;
                const thisPay = roundMoney(data.total - toBalance);
                const rows = [['Saldo anterior', data.debtBefore], ['Este abono', -thisPay]];
                if (toBalance > 0) rows.push(['A saldo a favor', toBalance]);
                return { rows, remaining: data.debtAfter, pct: pctOf(data.debtTotal, data.debtAfter) };
            }
            return null;
        }

        // Diferencia entre el total del fiado y la suma de sus líneas (precio de cuando se fió): { surcharge, priceAdj }
        function receiptAdjustments(data, credit) {
            const lines = roundMoney((data.items || []).reduce((sum, i) => sum + i.qty * i.price, 0));
            const diff = roundMoney(data.total - lines);
            if (Math.abs(diff) < 0.01) return { surcharge: 0, priceAdj: 0 };
            const sur = credit && credit.surcharge > 0 ? roundMoney(credit.surcharge) : 0;
            if (sur && diff >= sur - 0.005) return { surcharge: sur, priceAdj: roundMoney(diff - sur) < 0.01 ? 0 : roundMoney(diff - sur) };
            return { surcharge: 0, priceAdj: diff };
        }

        function selfTestReceipts() {
            const items = [{ qty: 4, price: 1.2 }, { qty: 2, price: 1.9 }];
            console.assert(receiptAdjustments({ items, total: 8.6 }).priceAdj === 0, 'selfTestReceipts: sin diferencia');
            console.assert(receiptAdjustments({ items, total: 9.8 }, null).priceAdj === 1.2, 'selfTestReceipts: cambio de precios');
            const r = receiptAdjustments({ items, total: 10.1 }, { surcharge: 0.5 });
            console.assert(r.surcharge === 0.5 && r.priceAdj === 1, 'selfTestReceipts: recargo y precios');
            console.assert(receiptAdjustments({ items, total: 8.1 }, null).priceAdj === -0.5, 'selfTestReceipts: precio bajó');

            // Estado de cuenta (Fase 20)
            let a = receiptAccount({ isCredit: true, total: 10, paid: 2, balanceUsed: 1 });
            console.assert(a.remaining === 7 && a.pct === 30, 'selfTestReceipts: fiado nuevo');
            a = receiptAccount({ isCredit: true, total: 10, paidBefore: 3, paid: 2 });
            console.assert(a.remaining === 5 && a.pct === 50, 'selfTestReceipts: fiado sobre uno abierto');
            a = receiptAccount({ type: 'payment', total: 1, debtBefore: 5, debtTotal: 5, debtAfter: 4 });
            console.assert(a.rows[1][1] === -1 && a.remaining === 4 && a.pct === 20, 'selfTestReceipts: abono');
            a = receiptAccount({ type: 'payment', total: 6, toBalance: 1, debtBefore: 5, debtTotal: 5, debtAfter: 0 });
            console.assert(a.rows[1][1] === -5 && a.remaining === 0 && a.pct === 100, 'selfTestReceipts: abono con sobrante');
            console.assert(receiptAccount({ type: 'payment', total: 1 }) === null, 'selfTestReceipts: abono viejo');
            console.assert(receiptAccount({ type: 'sale', total: 1, items: [] }) === null, 'selfTestReceipts: venta');
            console.assert(receiptAccount({ isCredit: true, fromList: true, total: 10, paid: 4 }).rows[1][0] === 'Abonado', 'selfTestReceipts: etiqueta desde la lista');

            // applyCreditPayment guarda el estado de cuenta igual que la ficha
            const bak = structuredClone({ credits: state.credits, products: state.products, sales: state.sales, creditMode: state.creditMode });
            try {
                state.creditMode = 'FIXED';
                state.products = [];
                state.sales = [];
                const c = { id: 1, customer: 'Cliente Prueba', items: [], totalDebt: 10, paid: 2, date: '' };
                state.credits = [c];
                applyCreditPayment(c, 3, 1, Date.now());
                const s = state.sales[0];
                console.assert(s.debtBefore === 8 && s.debtBefore - 3 === s.debtAfter, 'selfTestReceipts: abono guarda saldo antes/después');
                console.assert(s.debtAfter === roundMoney(calculateRealDebt(c) - c.paid) && s.creditId === 1 && s.debtTotal === 10, 'selfTestReceipts: abono cuadra con la ficha');
            } finally {
                state.credits = bak.credits; state.products = bak.products; state.sales = bak.sales; state.creditMode = bak.creditMode;
            }
            console.log('selfTestReceipts terminado');
        }

        // --- RENDERIZADO DEL TICKET ---
        function prepareReceiptModal(data) {
            tempReceiptData = data; // Guardamos contexto actual

            // 1. Rellenar Inputs
            $('receiptCustomerName').value = data.customer || '';

            // 2. Renderizar visualmente
            updateReceiptPreview();

            // 3. Mostrar Modal
            $('receiptModal').classList.remove('hidden');
        }

        function closeReceiptModal() {
            $('receiptModal').classList.add('hidden');
        }

        // Bloque del QR de la tienda; '' si no corresponde. Solo codifica el enlace público de la vitrina.
        function shopQrHtml(conf) {
            if (conf.showShopQr !== true || !normalizeCatalogConfig().enabled || typeof qrcode === 'undefined') return '';
            const url = catalogPublicUrl();
            if (!url) return '';
            let svg;
            try {
                const qr = qrcode(0, 'M');
                qr.addData(url);
                qr.make();
                svg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }).replace('<svg', '<svg style="width:100%;height:100%;display:block"');
            } catch (e) { console.error('QR del recibo:', e); return ''; }
            const bare = url.replace(/^https?:\/\//, '');
            const shown = normalizeCatalogConfig().slug ? bare : bare.split('?')[0];
            return `<div class="flex items-center gap-3 rounded-2xl bg-slate-100 p-3 mt-3">
                <div class="shrink-0 bg-white p-1.5 rounded-lg" style="width:84px;height:84px;box-sizing:border-box">${svg}</div>
                <div class="min-w-0">
                    <p class="text-[11px] font-extrabold leading-tight text-slate-800">Vuelve a comprar desde tu teléfono</p>
                    <p class="text-[9px] leading-tight text-slate-500 mt-1">Escanea el código para ver el catálogo y hacer tu pedido.</p>
                    <p class="text-[9px] font-bold text-indigo-600 mt-1 break-all">${escapeHtml(shown)}</p>
                </div></div>`;
        }

        // Banda oscura con logo, nombre y línea de información: la comparten el recibo y el documento no fiscal (Fase 22)
        function receiptHeaderHtml(name, logo, info) {
            const logoHtml = logo ? `<div class="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden"><img src="${escapeHtml(logo)}" alt="" style="max-width:100%;max-height:100%;object-fit:contain"></div>` : '';
            const infoHtml = info ? `<div class="text-[10px] mt-0.5 break-words" style="color:#cbd5e1">${escapeHtml(info)}</div>` : '';
            return `<div class="flex items-center gap-3 p-4" style="background:#1e293b;color:#fff">
                    ${logoHtml}
                    <div class="min-w-0"><div class="text-base font-black uppercase tracking-wide leading-tight break-words">${escapeHtml(name)}</div>${infoHtml}</div>
                </div>`;
        }

        function updateReceiptPreview() {
            const data = tempReceiptData;
            if (!data) return;

            // Usar configuración de la nube
            const conf = state.receiptConfig || { companyName: "Mi Negocio", footer: "Gracias por su compra", logo: null };
            // Tasa: lo cobrado ese día (historial y abonos), la de fiados si es fiado o abono, la activa si es venta nueva
            const rate = data.rate > 0 ? data.rate : (data.isCredit || data.type === 'payment') ? getFiadosActiveRate() : getActiveRate();
            const isPayment = data.type === 'payment' && !data.isCredit;

            const d = new Date(data.date);
            const dateText = d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeText = d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
            const customerInput = $('receiptCustomerName').value.trim();
            const displayCustomer = (customerInput && customerInput.toLowerCase() !== 'cliente genérico') ? customerInput : 'Consumidor final';
            const account = receiptAccount(data);
            const settled = account && account.remaining <= 0.01;
            // Número propio de la operación: abono A-000001, venta o fiado 000123; «Por asignar» sin conexión; sin línea si es un dato viejo sin número
            const number = data.numPending ? 'Por asignar' : isPayment ? (data.payNum ? 'A-' + data.payNum : data.fiscalNum || '') : (data.fiscalNum || '');

            // Título y chip según el tipo
            let title, chipText, chipCls, kindText, totalLabel;
            if (data.isCredit) {
                title = 'Comprobante de fiado'; kindText = 'Fiado'; totalLabel = 'Total del fiado';
                [chipText, chipCls] = settled ? ['PAGADO', 'bg-green-100 text-green-800'] : ['FIADO', 'bg-amber-100 text-amber-800'];
            } else if (isPayment) {
                title = 'Recibo de abono'; kindText = 'Abono'; totalLabel = 'Monto abonado';
                [chipText, chipCls] = ['ABONO A CUENTA', 'bg-orange-100 text-orange-800'];
            } else {
                title = 'Comprobante de venta'; kindText = 'Contado'; totalLabel = 'Total a pagar';
                [chipText, chipCls] = ['PAGADO', 'bg-green-100 text-green-800'];
            }

            const money = (amount) => `${amount < 0 ? '-' : ''}${formatMoney(Math.abs(amount))}`;
            const row = (label, amount, bold) => `<div class="flex justify-between gap-2 text-[11px] ${bold ? 'font-bold text-slate-800' : 'text-slate-500'}"><span>${escapeHtml(label)}</span><span class="font-bold text-slate-800">${money(amount)}</span></div>`;

            // Productos (venta y fiado) con las líneas de recargo / ajuste del fiado
            let itemsHtml = '';
            if (!isPayment && data.items && data.items.length) {
                const lines = data.items.map(item => `<div class="flex justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
                    <div class="min-w-0"><div class="text-[11px] font-bold text-slate-800 break-words">${escapeHtml(item.name)}</div><div class="text-[10px] text-slate-400">${escapeHtml(item.qty)} × ${formatMoney(item.price)}</div></div>
                    <div class="text-[11px] font-bold text-slate-800 shrink-0">${formatMoney(item.qty * item.price)}</div></div>`).join('');
                let adjHtml = '';
                if (data.isCredit) {
                    const adj = receiptAdjustments(data, state.credits.find(c => c.id == data.id));
                    if (adj.surcharge) adjHtml += row('Recargo', adj.surcharge, true);
                    if (adj.priceAdj) adjHtml += row('Ajuste por cambio de precios', adj.priceAdj, true);
                }
                itemsHtml = `<div class="mt-3"><p class="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 mb-1">Productos</p>${lines}${adjHtml ? `<div class="pt-1.5 space-y-1">${adjHtml}</div>` : ''}</div>`;
            }

            // Bolívares: el interruptor se sigue leyendo como antes
            const chkBs = $('chkReceiptBs');
            let showBs = conf.showBs !== false;
            if (chkBs) {
                // TRUCO: si no fue el evento 'change' (click manual) se restaura lo guardado en la nube; si fue manual, se respeta lo que se tocó
                if (!event || event.type !== 'change') chkBs.checked = (conf.showBs !== false);
                showBs = chkBs.checked;
            }
            const bsHtml = showBs ? `<div class="flex justify-between text-[11px] text-slate-500 mt-1"><span>En bolívares</span><span class="font-bold text-slate-800">Bs ${(data.total * rate).toFixed(2)}</span></div>
                <div class="text-right text-[9px] text-slate-400">Tasa: Bs ${Number(rate).toFixed(2)} / $</div>` : '';
            const noteHtml = data.toBalance > 0 ? `<p class="text-[10px] text-slate-500 mt-2">Esta factura incluye ${formatMoney(data.toBalance)} de saldo a favor del cliente.</p>` : '';

            let accountHtml = '';
            if (account) {
                accountHtml = `<div class="mt-3 rounded-2xl border border-slate-200 p-3">
                    <p class="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 mb-1.5">Estado de cuenta</p>
                    <div class="space-y-1">${account.rows.map(r => row(r[0], r[1])).join('')}</div>
                    <div class="border-t border-slate-200 mt-2 pt-2 flex justify-between items-end"><span class="text-[11px] font-extrabold text-slate-800">Saldo pendiente</span><span class="text-xl font-black leading-none text-slate-900">${formatMoney(account.remaining)}</span></div>
                    <div class="mt-2 h-2 rounded-full overflow-hidden" style="background:#e2e8f0"><div style="width:${account.pct}%;height:100%;background:#166534"></div></div>
                    <p class="text-[10px] font-bold text-green-800 mt-1">${settled ? '¡Deuda saldada!' : `Has pagado el ${account.pct} % de tu deuda.`}</p>
                </div>`;
            }

            // Método de pago (Fase 22): en la tarjeta del cliente, junto al tipo; el fiado no lleva método
            const methodText = !data.isCredit && payMethodLabel(data.method);
            const kindLine = kindText + (methodText ? ' · ' + methodText : '');
            const refLine = methodText && data.methodRef ? `<p class="text-[9px] text-slate-400">Ref. ${escapeHtml(data.methodRef)}</p>` : '';

            $('receiptCanvas').innerHTML = `<div class="bg-white rounded-2xl overflow-hidden" style="color:#1e293b">
                ${receiptHeaderHtml(conf.companyName || 'Mi Negocio', conf.logo, conf.headerInfo)}
                <div class="p-4">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0"><div class="text-sm font-extrabold leading-tight">${title}</div>${number ? `<div class="text-[10px] text-slate-400 font-bold mt-0.5">N° ${escapeHtml(number)}</div>` : ''}</div>
                        <span class="text-[9px] font-extrabold px-2 py-1 rounded-full whitespace-nowrap ${chipCls}">${chipText}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 mt-3">
                        <div class="rounded-xl bg-slate-50 p-2"><p class="text-[9px] font-extrabold uppercase text-slate-400">Fecha</p><p class="text-[11px] font-bold mt-0.5 leading-tight">${escapeHtml(dateText)}<br>${escapeHtml(timeText)}</p></div>
                        <div class="rounded-xl bg-slate-50 p-2 min-w-0"><p class="text-[9px] font-extrabold uppercase text-slate-400">Cliente</p><p class="text-[11px] font-bold mt-0.5 leading-tight break-words">${escapeHtml(displayCustomer)}</p><p class="text-[9px] text-slate-400">${escapeHtml(kindLine)}</p>${refLine}</div>
                    </div>
                    ${itemsHtml}
                    <div class="mt-3 rounded-2xl border-2 border-slate-200 p-3">
                        <div class="flex justify-between items-end"><span class="text-[11px] font-extrabold text-slate-500">${totalLabel}</span><span class="${isPayment ? 'text-2xl' : 'text-xl'} font-black leading-none">${formatMoney(data.total)}</span></div>
                        ${bsHtml}${noteHtml}
                    </div>
                    ${accountHtml}
                    ${shopQrHtml(conf)}
                    <div class="text-center mt-4">
                        <p class="text-[11px] font-extrabold break-words">${escapeHtml(conf.footer || 'Gracias por su compra')}</p>
                        <p class="text-[9px] text-slate-400 mt-1">Este comprobante no sustituye la factura fiscal.</p>
                    </div>
                </div></div>`;
        }

        // --- DESCARGA Y COMPARTIR ---
        // Los botones que la llaman (downloadReceipt y shareReceipt) ya muestran el indicador de carga
        async function generateReceiptImage() {
            const node = document.getElementById('receiptCanvas');
            try {
                // El canvas es de ancho fijo y tiene su propio margen gris: la imagen sale igual a la vista previa
                return await htmlToImage.toPng(node, {
                    backgroundColor: '#f1f5f9',
                    pixelRatio: 3, // Calidad Alta (3x)
                    width: node.scrollWidth,
                    height: node.scrollHeight,
                    style: { transform: 'none', margin: '0' }
                });
            } catch (error) {
                console.error('Error generando recibo:', error);
                alert('Hubo un error generando la imagen. Por favor intenta de nuevo.');
                throw error;
            }
        }

        async function downloadReceipt(type) {
            // 1. Guardar estado del botón
            const btn = event.currentTarget;
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
            btn.disabled = true;

            try {
                // 2. Generar la imagen base (Tu función actual)
                const imgData = await generateReceiptImage();
                const fileName = `recibo_${Date.now()}`;

                if (type === 'img') {
                    // --- Lógica para Imagen (PNG Alta Calidad) ---
                    const link = document.createElement('a');
                    link.download = `${fileName}.png`;
                    link.href = imgData;
                    link.click();
                } else {
                    // --- Lógica para PDF (Optimizada y Ligera) ---
                    const { jsPDF } = window.jspdf;
                    
                    // A. Calcular dimensiones exactas antes de crear el PDF
                    // Usamos un objeto Image temporal para leer las medidas reales
                    const imgProps = new Image();
                    imgProps.src = imgData;
                    await new Promise(resolve => imgProps.onload = resolve);
                    
                    // Ancho estándar de ticket térmico (80mm)
                    const pdfWidth = 80; 
                    // Altura proporcional exacta (sin espacios blancos extra)
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                    // B. Crear PDF con el tamaño justo
                    const pdf = new jsPDF({
                        orientation: 'portrait',
                        unit: 'mm',
                        format: [pdfWidth, pdfHeight] // ¡Altura dinámica!
                    });

                    // C. Agregar imagen con COMPRESIÓN (El truco del peso)
                    // 'JPEG': Convierte a JPG (mucho más ligero que PNG)
                    // 'FAST': Algoritmo de compresión rápida
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
                    
                    pdf.save(`${fileName}.pdf`);
                }

            } catch (e) {
                console.error(e);
                alert('Error generando recibo. Por favor intenta de nuevo.');
            } finally {
                // 3. Restaurar botón siempre
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        }

        async function shareReceipt() {
            const btn = event.currentTarget;
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

            // En PC se abre la pestaña de WhatsApp ahora, con el clic: después de generar la imagen el navegador ya la bloquearía como emergente
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const waWin = isMobile ? null : window.open('', '_blank');

            try {
                const imgData = await generateReceiptImage();
                
                // --- DETECCIÓN DE DISPOSITIVO (LA CLAVE) ---
                // Detectamos si es un móvil real. Si es PC, 'isMobile' será false.

                // 1. MÓVIL: Intentar API Nativa (Envía la imagen directo a la App de WhatsApp)
                // Solo entramos aquí si es móvil Y el navegador soporta compartir
                if (isMobile && navigator.share) {
                    const blob = await (await fetch(imgData)).blob();
                    const file = new File([blob], "recibo.png", { type: "image/png" });
                    
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'Recibo de Compra',
                            text: `Hola ${$('receiptCustomerName').value}, aquí tienes tu recibo.`
                        });
                        return; // ¡Éxito en móvil! Salimos aquí.
                    }
                }

                // Paso A: Descargar la imagen primero
                const link = document.createElement('a');
                link.download = `recibo_para_enviar.png`;
                link.href = imgData;
                link.click();

                // Paso B: Instruir al usuario (Bloqueante)
                // El alert detiene la ejecución del código hasta que el usuario da "Aceptar".
                // Esto garantiza que lea las instrucciones ANTES de que se abra la nueva pestaña.
                alert('✅ La imagen del recibo se ha descargado en tu PC.\n\n👉 INSTRUCCIONES:\n1. Acepta este mensaje.\n2. Se abrirá WhatsApp Web.\n3. Arrastra o adjunta la imagen descargada en el chat.');

                // Paso C: Abrir WhatsApp Web (Solo ocurre después de cerrar la alerta)
                const text = `Hola ${$('receiptCustomerName').value}, aquí tienes tu recibo.`;
                const waUrl = `https://wa.me/${(tempReceiptData && tempReceiptData.waPhone) || ''}?text=${encodeURIComponent(text)}`; // waPhone: pedido en línea (Fase 19)
                if (waWin) waWin.location.href = waUrl; else window.open(waUrl, '_blank');

            } catch (e) {
                console.error(e);
                if (waWin) waWin.close();
                alert('Ocurrió un error al procesar la imagen.');
            } finally {
                btn.innerHTML = originalContent;
            }
        }


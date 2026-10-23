        // ==========================================
        // 🎫 SISTEMA DE FACTURACIÓN FISCAL (SENIAT)
        // ==========================================

        function setInvoiceType(type) {
            state.receiptType = type;
            saveData();
            updateConfigUI(); // Actualizar botones en el modal
        }

        function selectInvoiceType(type) {
            $('invoiceTypeModal').classList.add('hidden');
            setInvoiceType(type);
            routeReceipt(tempReceiptData); // Continuar flujo
        }

        function updateConfigUI() {
            if(!$('btnTypePers')) return;
            if (state.receiptType === 'FISCAL') {
                $('btnTypeFisc').className = "flex-1 py-2 text-xs border rounded transition font-bold bg-blue-600 text-white shadow";
                $('btnTypePers').className = "flex-1 py-2 text-xs border rounded transition font-bold bg-gray-50 text-gray-600 hover:bg-gray-100";
                $('btnConfigFiscal').classList.remove('hidden');
                $('btnConfigPersonalized').classList.add('hidden'); // Ocultar el otro
            } else {
                $('btnTypePers').className = "flex-1 py-2 text-xs border rounded transition font-bold bg-indigo-600 text-white shadow";
                $('btnTypeFisc').className = "flex-1 py-2 text-xs border rounded transition font-bold bg-gray-50 text-gray-600 hover:bg-gray-100";
                $('btnConfigFiscal').classList.add('hidden');
                $('btnConfigPersonalized').classList.remove('hidden'); // Mostrar el personalizado
            }
        }

        function openFiscalConfigFromMenu() {
                // NUEVO: Cargamos el nombre de la empresa (si está vacío, intentamos heredar el de la configuración normal para ahorrarle tiempo al usuario)
                $('fiscCfgCompany').value = state.fiscalConfig.companyName || state.receiptConfig.companyName || '';
                $('fiscCfgRif').value = state.fiscalConfig.rif || '';
                $('fiscCfgAddress').value = state.fiscalConfig.address || '';
                $('fiscCfgZip').value = state.fiscalConfig.zip || '';
                $('fiscCfgIva').checked = state.fiscalConfig.ivaIncluded;
                $('fiscalConfigModal').classList.remove('hidden');
            }

        function closeFiscalConfig() {
            $('fiscalConfigModal').classList.add('hidden');
        }

        function saveFiscalConfig() {
            state.fiscalConfig.companyName = $('fiscCfgCompany').value.trim(); // NUEVO CAMPO
            state.fiscalConfig.rif = $('fiscCfgRif').value.trim();
            state.fiscalConfig.address = $('fiscCfgAddress').value.trim();
            state.fiscalConfig.zip = $('fiscCfgZip').value.trim();
            state.fiscalConfig.ivaIncluded = $('fiscCfgIva').checked;
            
            if (!state.fiscalConfig.companyName) return alert("La Razón Social es obligatoria."); // VALIDACIÓN
            if (!state.fiscalConfig.rif) return alert("El RIF es obligatorio.");
            
            saveData();
            closeFiscalConfig();
            
            // Si venía del flujo de generar factura, continuar
            if (tempReceiptData && !document.getElementById('fiscalReceiptModal').classList.contains('hidden') === false) {
                prepareFiscalReceiptModal(tempReceiptData);
            } else {
                alert("Configuración Fiscal Guardada.");
            }
        }

        function fillGenericClient() {
            $('fiscalClientRif').value = 'J-00000000';
            $('fiscalClientName').value = 'CLIENTE GENERICO';
            $('fiscalClientAddress').value = 'GENERICO';
            $('fiscalClientPhone').value = '0000-0000000';
            updateFiscalPreview();
        }

        function closeFiscalReceiptModal() {
            $('fiscalReceiptModal').classList.add('hidden');
        }

        function prepareFiscalReceiptModal(data) {
            // Llenar datos de la empresa
            $('printFiscRif').textContent = state.fiscalConfig.rif;
            // NUEVO: Usamos el nombre fiscal (y como fallback final 'EMPRESA')
            $('printFiscCompany').textContent = state.fiscalConfig.companyName || 'EMPRESA';
            $('printFiscAddress').textContent = state.fiscalConfig.address;
            $('printFiscZip').textContent = state.fiscalConfig.zip;

            // Datos del cliente por defecto si venían de la venta
            if (data.customer && data.customer.toLowerCase() !== 'cliente genérico') {
                $('fiscalClientName').value = data.customer;
            } else {
                fillGenericClient();
            }

            // Metodo de pago default
            if (data.isCredit) $('fiscalPaymentMethod').value = 'CREDITO';
            else $('fiscalPaymentMethod').value = 'EFECTIVO';

            // Asignar Correlativo Permanente si no tiene
            if (!data.fiscalNum) {
                const newNum = state.fiscalConfig.currentNumber.toString().padStart(6, '0');
                data.fiscalNum = newNum;
                state.fiscalConfig.currentNumber++;
                
                // Buscar y guardar en la DB real para que sea permanente
                if (data.id) {
                    if (data.isCredit) {
                        const cIdx = state.credits.findIndex(c => c.id == data.id);
                        if (cIdx > -1) state.credits[cIdx].fiscalNum = newNum;
                    } else {
                        const sIdx = state.sales.findIndex(s => s.id == data.id);
                        if (sIdx > -1) state.sales[sIdx].fiscalNum = newNum;
                    }
                    saveData(); // Guardar el contador y el numero asignado
                }
            }

            updateFiscalPreview();
            $('fiscalReceiptModal').classList.remove('hidden');
        }

        function updateFiscalPreview() {
            const data = tempReceiptData;
            if (!data) return;

            const rate = getActiveRate();

            // Actualizar inputs de cliente en el ticket
            $('printFiscCliRif').textContent = $('fiscalClientRif').value || 'J-00000000';
            $('printFiscCliName').textContent = $('fiscalClientName').value || 'CLIENTE GENERICO';
            $('printFiscCliAddress').textContent = $('fiscalClientAddress').value || 'GENERICO';
            $('printFiscCliPhone').textContent = $('fiscalClientPhone').value || '0000-0000000';

            // Meta
            const d = new Date(data.date);
            $('printFiscDate').textContent = d.toLocaleDateString('es-VE').replace(/\//g, '-');
            $('printFiscTime').textContent = d.toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit'});
            $('printFiscNum').textContent = data.fiscalNum;

            // Items (Renderizados en Bolívares)
            const tbody = $('printFiscItems');
            tbody.innerHTML = '';
            
            let totalBs = 0;

            if (data.items) {
                data.items.forEach(item => {
                    const priceBs = item.price * rate;
                    const itemTotalBs = (item.qty * item.price) * rate;
                    totalBs += itemTotalBs;
                    
                    // Formato SENIAT:
                    // 1  XIAOMI REDMI 15C
                    //                       Bs XXXXX.XX
                    tbody.innerHTML += `
                        <div class="flex justify-between mb-1">
                            <span class="w-6">${item.qty}</span>
                            <span class="flex-1">${escapeHtml(item.name)}</span>
                        </div>
                        <div class="text-right mb-2 pr-1">Bs ${itemTotalBs.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits:2})}</div>
                    `;
                });
            } else if (data.type === 'payment') {
                totalBs = data.total * rate;
                tbody.innerHTML = `
                    <div class="flex justify-between mb-1"><span class="w-6">1</span><span class="flex-1">ABONO A CUENTA</span></div>
                    <div class="text-right mb-2 pr-1">Bs ${totalBs.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits:2})}</div>`;
            }

            // Cálculos de IVA
            let BI, IVA, FinalTotal;
            if (state.fiscalConfig.ivaIncluded) {
                // Extraemos el 16% hacia atrás
                BI = totalBs / 1.16;
                IVA = totalBs - BI;
                FinalTotal = totalBs;
            } else {
                // Sumamos el 16% hacia adelante
                BI = totalBs;
                IVA = totalBs * 0.16;
                FinalTotal = totalBs + IVA;
            }

            const fmt = (num) => num.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits:2});

            $('printFiscSubtotal').textContent = `Bs ${fmt(BI)}`;
            $('printFiscBI').textContent = `Bs ${fmt(BI)}`;
            $('printFiscIVA').textContent = `Bs ${fmt(IVA)}`;
            $('printFiscTotal').textContent = `Bs ${fmt(FinalTotal)}`;

            // Pago
            const pMethod = $('fiscalPaymentMethod').value;
            $('printFiscPaymentMethod').textContent = pMethod;
            // Si es crédito, mostramos lo abonado (si es venta nueva)
            if (pMethod === 'CREDITO') {
                $('printFiscPaymentAmount').textContent = `Bs ${fmt((data.paid || 0) * rate)}`;
            } else {
                $('printFiscPaymentAmount').textContent = `Bs ${fmt(FinalTotal)}`;
            }
        }

        // Funciones de descarga para Fiscal
        async function generateFiscalImage() {
            const node = document.getElementById('fiscalCanvas');
            const options = { backgroundColor: '#ffffff', pixelRatio: 3, width: node.scrollWidth, height: node.scrollHeight };
            const btn = event.currentTarget;
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
            btn.disabled = true;
            try {
                const dataUrl = await htmlToImage.toPng(node, options);
                btn.innerHTML = originalText; btn.disabled = false;
                return dataUrl;
            } catch (error) {
                alert('Error generando la imagen.');
                btn.innerHTML = originalText; btn.disabled = false; throw error;
            }
        }

        async function downloadFiscalReceipt(type) {
            try {
                const imgData = await generateFiscalImage();
                const fileName = `factura_fiscal_${tempReceiptData.fiscalNum}`;
                if (type === 'img') {
                    const link = document.createElement('a'); link.download = `${fileName}.png`; link.href = imgData; link.click();
                } else {
                    const { jsPDF } = window.jspdf;
                    const imgProps = new Image(); imgProps.src = imgData;
                    await new Promise(resolve => imgProps.onload = resolve);
                    const pdfWidth = 80; const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, pdfHeight] });
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
                    pdf.save(`${fileName}.pdf`);
                }
            } catch (e) { console.error(e); }
        }

        async function shareFiscalReceipt() {
            const btn = event.currentTarget; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>...';
            try {
                const imgData = await generateFiscalImage();
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (isMobile && navigator.share) {
                    const blob = await (await fetch(imgData)).blob();
                    const file = new File([blob], "factura.png", { type: "image/png" });
                    await navigator.share({ files: [file], title: 'Factura', text: `Factura ${tempReceiptData.fiscalNum}` });
                } else {
                    const link = document.createElement('a'); link.download = `factura_para_enviar.png`; link.href = imgData; link.click();
                    alert('Imagen descargada. Se abrirá WhatsApp para que la adjuntes.');
                    window.open(`https://wa.me/?text=Factura%20${tempReceiptData.fiscalNum}`, '_blank');
                }
            } catch (e) { console.error(e); } finally { btn.innerHTML = '<i class="fa-brands fa-whatsapp text-xl mr-2"></i> Compartir Ticket Fiscal'; }
        }


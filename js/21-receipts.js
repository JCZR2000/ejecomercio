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
        function routeReceipt(data) {
            tempReceiptData = data; // Guardamos contexto

            if (!state.receiptType) {
                // Si nunca ha elegido, mostrar el modal de elección
                $('invoiceTypeModal').classList.remove('hidden');
            } else if (state.receiptType === 'FISCAL') {
                // Validar si tiene configuración fiscal
                if (!state.fiscalConfig.rif) {
                    $('fiscalConfigModal').classList.remove('hidden');
                } else {
                    prepareFiscalReceiptModal(data);
                }
            } else {
                prepareReceiptModal(data);
            }
        }

        // A. Desde el Modal de Éxito
        function openReceiptFromSuccess() {
            const dataToUse = tempReceiptData;
            if (!dataToUse) return;
            closeSuccessModal();
            routeReceipt(dataToUse);
        }

        function closeSuccessModal() {
            $('successModal').classList.add('hidden');
            // tempReceiptData = null; // ¡NO LIMPIAR AQUÍ, lo necesitamos para el ruteador!
        }

        // B. Desde Historial
        function openReceiptFromHistory(saleId) {
            const sale = state.sales.find(s => s.id == saleId);
            if (!sale) return;
            routeReceipt({
                id: sale.id,
                items: sale.items,
                total: sale.total,
                date: sale.date,
                customer: sale.description ? sale.description.replace('Abono: ', '') : '',
                type: sale.type,
                isHistory: true,
                fiscalNum: sale.fiscalNum
            });
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
                fiscalNum: credit.fiscalNum
            });
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

        function updateReceiptPreview() {
            const data = tempReceiptData;
            if (!data) return;

            // Usar configuración de la nube
            const conf = state.receiptConfig || { companyName: "Mi Negocio", footer: "Gracias por su compra", logo: null };
            const rate = getActiveRate();

            // 1. Cabecera
            $('printCompanyName').textContent = conf.companyName || "Mi Negocio";
            $('printFooter').textContent = conf.footer || "Gracias por su compra";
            
            // 2. Manejo del Logo
            const logoImg = $('printLogo');
            if (conf.logo) {
                logoImg.src = conf.logo;
                logoImg.classList.remove('hidden');
            } else {
                logoImg.classList.add('hidden');
                // CORRECCIÓN: Quitamos el atributo src para evitar errores de carga 404
                logoImg.removeAttribute('src');
            }

            const d = new Date(data.date);
            $('printDate').textContent = `${d.toLocaleDateString()} ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;

            // 3. Cliente y Tipo
            const customerInput = $('receiptCustomerName').value.trim();
            const displayCustomer = (customerInput && customerInput.toLowerCase() !== 'cliente genérico') ? customerInput : 'CONSUMIDOR FINAL';
            $('printCustomerNameDisplay').textContent = displayCustomer;

            // Etiqueta de Tipo de Venta
            const typeLabel = $('printTxType');
            const typeText = typeLabel.querySelector('span:last-child');
            
            if (data.isCredit) {
                typeLabel.classList.remove('hidden');
                typeText.textContent = "CRÉDITO / FIADO";
                typeText.className = "font-bold bg-black text-white px-1 text-[10px] rounded-sm";
            } else if (data.type === 'payment') {
                typeLabel.classList.remove('hidden');
                typeText.textContent = "ABONO A CUENTA";
                typeText.className = "font-bold bg-gray-200 text-black px-1 text-[10px] rounded-sm border border-black";
            } else {
                typeLabel.classList.add('hidden'); // Venta normal se asume contado
            }

            // 3. Items
            const tbody = $('printItemsList');
            tbody.innerHTML = '';
            
            if (data.items) {
                data.items.forEach(item => {
                    tbody.innerHTML += `
                        <tr>
                            <td class="align-top font-bold">${item.qty}</td>
                            <td class="align-top pr-2">
                                <div>${escapeHtml(item.name)}</div>
                                <div class="text-[9px] text-gray-500">x ${formatMoney(item.price)}</div>
                            </td>
                            <td class="align-top text-right font-bold">
                                ${formatMoney(item.qty * item.price)}
                            </td>
                        </tr>
                    `;
                });
            } else if (data.type === 'payment') {
                tbody.innerHTML = `
                    <tr>
                        <td class="align-top font-bold">1</td>
                        <td class="align-top">ABONO A CUENTA</td>
                        <td class="align-top text-right font-bold">${formatMoney(data.total)}</td>
                    </tr>`;
            }

            // 5. Totales y Bolívares (AQUÍ ESTÁ LA SINCRONIZACIÓN) 🔄
            $('printTotalMain').textContent = formatMoney(data.total);

            const chkBs = $('chkReceiptBs');
            if (chkBs) {
                // TRUCO: Si la función NO fue llamada por el evento 'change' (click manual),
                // entonces restauramos el valor guardado en la nube.
                // Si FUE llamada por click manual, respetamos lo que el usuario acaba de tocar.
                if (!event || event.type !== 'change') {
                    // Si showBs es undefined (primera vez), asumimos true por defecto
                    chkBs.checked = (conf.showBs !== false);
                }

                // Ahora sí leemos el estado (sea restaurado o manual)
                if (chkBs.checked) {
                    $('printTotalBsRow').classList.remove('hidden');
                    $('printTotalBs').textContent = `Bs ${(data.total * rate).toFixed(2)}`;
                } else {
                    $('printTotalBsRow').classList.add('hidden');
                }
            }

            // 5. Sección de Crédito
            if (data.isCredit) {
                $('printCreditInfo').classList.remove('hidden');
                $('printPaid').textContent = formatMoney(data.paid);
                // Si es venta nueva a crédito: Total - Pagado = Restante
                const remaining = data.total - data.paid;
                $('printRemaining').textContent = formatMoney(remaining);
            } else {
                $('printCreditInfo').classList.add('hidden');
            }
        }

        // --- DESCARGA Y COMPARTIR ---
        async function generateReceiptImage() {
            const node = document.getElementById('receiptCanvas');
            
            // 1. Calcular dimensiones reales del contenido (incluyendo lo que no se ve)
            const width = node.scrollWidth;
            const height = node.scrollHeight;

            const options = {
                backgroundColor: '#ffffff',
                pixelRatio: 3, // Calidad Alta (3x)
                width: width,  // Forzar ancho total
                height: height, // Forzar alto total (SOLUCIÓN AL RECORTE)
                style: {
                    // Estos estilos se aplican SOLO para la foto
                    'transform': 'none',
                    'overflow': 'visible',
                    'max-height': 'none',
                    'height': 'auto',
                    'display': 'block'
                },
                // Filtro para reducir errores de consola (opcional)
                filter: (n) => {
                    // Si el elemento es el Logo y está oculto, LO SALTAMOS
                    if (n.id === 'printLogo') {
                        if (n.classList && n.classList.contains('hidden')) return false;
                        if (!n.src || n.src === "") return false;
                    }
                    return true; // El resto se renderiza normal
                }
            };

            try {
                // Indicador visual de carga (opcional pero recomendado)
                const btn = event.currentTarget;
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
                btn.disabled = true;

                // 2. Generar la imagen
                const dataUrl = await htmlToImage.toPng(node, options);
                
                // Restaurar botón
                btn.innerHTML = originalText;
                btn.disabled = false;

                return dataUrl;

            } catch (error) {
                console.error('Error generando recibo:', error);
                // Restaurar botón en caso de error
                const btn = document.querySelector('button[onclick="downloadReceipt(\'img\')"]');
                if(btn) {
                    btn.innerHTML = '<i class="fa-solid fa-image text-lg"></i> Descargar IMG';
                    btn.disabled = false;
                }
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
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

            try {
                const imgData = await generateReceiptImage();
                
                // --- DETECCIÓN DE DISPOSITIVO (LA CLAVE) ---
                // Detectamos si es un móvil real. Si es PC, 'isMobile' será false.
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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
                        btn.innerHTML = '<i class="fa-brands fa-whatsapp text-xl"></i> Compartir';
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
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');

            } catch (e) {
                console.error(e);
                alert('Ocurrió un error al procesar la imagen.');
            } finally {
                btn.innerHTML = '<i class="fa-brands fa-whatsapp text-xl"></i> Compartir';
            }
        }


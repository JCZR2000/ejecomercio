        // ==========================================
        // COMPRESOR DE IMÁGENES (SOLUCIÓN AL LÍMITE DE 1MB)
        // ==========================================
        function previewImage(event) {
            const file = event.target.files[0];
            if (!file) return;

            // 1. Crear un lector de archivos
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const img = new Image();
                img.src = e.target.result;

                img.onload = function() {
                    // 2. Configurar dimensiones máximas (Thumbnail)
                    const maxWidth = 300; // Máximo 300px de ancho
                    const maxHeight = 300; 
                    let width = img.width;
                    let height = img.height;

                    // Calcular nueva proporción (para no deformar)
                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    // 3. Crear Canvas (Lienzo invisible)
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    
                    // 4. Dibujar la imagen redimensionada
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // 5. EXPORTAR COMPRIMIDO (JPEG al 70% de calidad)
                    // Esto reduce una imagen de 3MB a aprox 20KB-50KB
                    state.tempImg = canvas.toDataURL('image/jpeg', 0.7);
                    state.isImageDeleted = false; // <--- ¡BANDERA APAGADA! 🏳️

                    // 6. Mostrar resultado
                    $('imgPreview').src = state.tempImg;
                    $('imgPreview').classList.remove('hidden');
                    $('imgIcon').classList.add('hidden');
                    $('btnRemoveImg').classList.remove('hidden');
                    
                    // Feedback para el usuario (opcional en consola)
                    console.log("📸 Imagen comprimida para Firestore.");
                };
            };
            
            reader.readAsDataURL(file);
        }

        // ==========================================
        // BORRAR IMAGEN (LIBERAR ESPACIO)
        // ==========================================
        function removeImage(e) {
            // Evitamos que el clic traspase y abra el selector de archivos
            e.preventDefault();
            e.stopPropagation();

            // 1. Limpiamos la memoria temporal
            state.tempImg = null;
            state.isImageDeleted = true; // <--- ¡NUEVA BANDERA ACTIVADA! 🚩
            
            // 2. Limpiamos el input file (por si quiere subir la misma foto después)
            document.getElementById('prodImg').value = "";

            // 3. Reseteamos la UI
            const img = document.getElementById('imgPreview');
            const icon = document.getElementById('imgIcon');
            const btn = document.getElementById('btnRemoveImg');

            img.src = "";
            img.classList.add('hidden');
            btn.classList.add('hidden');
            icon.classList.remove('hidden');
        }

        // ==========================================
        // 13. SISTEMA DE ESCÁNER Y API
        // ==========================================
        let html5QrcodeScanner = null;
        let scannerMode = null; // 'LINK' (Formulario) o 'POS' (Venta)
        let isScannerRunning = false; // <--- NUEVA VARIABLE DE CONTROL

        function startScanner(mode) {
            scannerMode = mode;
            // 1. Primero mostramos el modal para que el div tenga tamaño
            $('scannerModal').classList.remove('hidden');

            // 2. Esperamos 300ms para asegurar que el navegador renderizó el modal
            setTimeout(() => {
                if (!html5QrcodeScanner) {
                    // Configuración ajustada para evitar errores de renderizado
                    html5QrcodeScanner = new Html5Qrcode("reader");
                }

                const config = { 
                    fps: 10, 
                    qrbox: { width: 200, height: 200 }, // Reduje un poco la caja para asegurar que quepa
                    aspectRatio: 1.0 
                };
                
                // Iniciamos la cámara
                html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess)
                .then(() => {
                    // ÉXITO: Marcamos que la cámara está corriendo
                    isScannerRunning = true;
                })
                .catch(err => {
                    // ERROR (Permisos, sin cámara, etc.)
                    console.error("Error iniciando cámara:", err);
                    isScannerRunning = false; // Aseguramos que sepa que NO está corriendo
                    
                    // Ocultamos el modal PRIMERO para evitar que se quede pegado visualmente
                    $('scannerModal').classList.add('hidden');
                    
                    // Mostramos el error después de cerrar
                    alert("No se pudo acceder a la cámara. Verifica los permisos.");
                });
            }, 300); // Retraso de 300ms necesario para renderizar el modal y la visualización del videofeed.
        }

        function stopScanner() {
            // Caso 1: La cámara está corriendo -> Debemos detenerla
            if (html5QrcodeScanner && isScannerRunning) {
                html5QrcodeScanner.stop().then(() => {
                    isScannerRunning = false;
                    html5QrcodeScanner.clear();
                    $('scannerModal').classList.add('hidden');
                }).catch(err => {
                    console.error("Error al detener:", err);
                    // Fallback: Si falla al detener, forzamos el cierre visual
                    isScannerRunning = false;
                    $('scannerModal').classList.add('hidden');
                });
            } 
            // Caso 2: La cámara NO arrancó o ya está detenida -> Solo cerramos visualmente
            else {
                isScannerRunning = false;
                if(html5QrcodeScanner) {
                    try { html5QrcodeScanner.clear(); } catch(e){} // Intento de limpieza silenciosa
                }
                $('scannerModal').classList.add('hidden');
            }
        }

        async function onScanSuccess(decodedText, decodedResult) {
            stopScanner(); // Detener cámara
            
            // Efecto de sonido opcional (Beep)
            new Audio('https://www.soundjay.com/button/beep-07.wav').play().catch(e=>{});
            if (navigator.vibrate) navigator.vibrate(200); // Vibra 200ms al detectar

            if (scannerMode === 'LINK') {
                // MODO GESTIÓN:
                // 1. Llenamos el campo del formulario (para registrar/editar)
                $('prodBarcode').value = decodedText;
                
                // 2. ¡CAMBIO IMPORTANTE! Ya NO llamamos a fetchProductData() automáticamente.
                // El usuario debe pulsar el botón de la nube si quiere los datos.

                // 3. Llenamos la barra de búsqueda y filtramos la tabla
                // Esto mostrará el producto si ya existe en el inventario
                $('searchInput').value = decodedText;
                
                // Forzamos el renderizado para que la tabla muestre solo ese producto (Stock/Precio)
                renderAll(); 
                
                // Verificamos si existe para dar feedback visual (opcional)
                const exists = state.products.some(p => p.barcode === decodedText);
                if(exists) {
                    // Si existe, hacemos scroll hacia la tabla para ver el stock
                    $('inventoryTableBody').scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    // Si no existe, hacemos focus en el nombre para empezar a registrar
                    $('prodName').focus();
                }

            } else if (scannerMode === 'POS') {
                // MODO VENTA (Se mantiene igual, funciona bien)
                const p = state.products.find(x => x.barcode === decodedText);
                
                if (p) {
                    // --- ACTUALIZACIÓN PARA EL NUEVO BUSCADOR ---
                    selectPosProduct(p); // Usamos la nueva función para llenar visualmente y lógicamente
                    $('saleQty').value = 1;
                    addToCart();
                    
                    // Limpiamos el buscador visualmente tras añadir (opcional, si quieres que quede listo para el siguiente)
                    // $('posSearchInput').value = ''; 
                    // $('saleProductSelect').value = '';
                    
                    // Feedback visual
                    const btn = $('posTitle');
                    const original = btn.innerHTML;
                    btn.innerHTML = `<i class="fa-solid fa-check text-green-500"></i> ${escapeHtml(p.name)} Agregado`;
                    setTimeout(() => btn.innerHTML = original, 2000);
                } else {
                    if(confirm(`El código ${decodedText} no está registrado. ¿Ir a Gestión para crearlo?`)) {
                        // Cambiamos al tab de gestión y preparamos el formulario
                        $('prodBarcode').value = decodedText;
                        $('searchInput').value = decodedText; // También lo ponemos en búsqueda
                        renderAll();
                        $('prodName').focus();
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }
            }
        }

        async function fetchProductData(barcode) {
            if(!barcode) return;
            
            // 1. Feedback visual en el botón que pulsó el usuario (la nube)
            // Buscamos el botón de la nube específicamente o usamos un selector genérico
            const btn = document.querySelector('button[onclick*="fetchProductData"]'); 
            const originalIcon = btn ? btn.innerHTML : '';
            
            if(btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            }
            
            // Feedback en el input de nombre también
            const nameInput = $('prodName');
            const originalPlaceholder = nameInput.placeholder;
            nameInput.placeholder = "Buscando en bases de datos...";

            // 2. Definimos las APIs a consultar en orden
            const apis = [
                { name: 'Alimentos', url: 'https://world.openfoodfacts.org/api/v0/product/' },
                { name: 'Cosméticos', url: 'https://world.openbeautyfacts.org/api/v0/product/' },
                { name: 'Mascotas', url: 'https://world.openpetfoodfacts.org/api/v0/product/' },
                { name: 'Productos', url: 'https://world.openproductsfacts.org/api/v0/product/' }
            ];

            let foundProduct = null;
            let sourceName = '';

            try {
                // 3. Bucle de búsqueda (Waterfall)
                for (const api of apis) {
                    console.log(`Consultando API: ${api.name}...`);
                    
                    try {
                        const res = await fetch(`${api.url}${barcode}.json`);
                        const data = await res.json();

                        if (data.status === 1) {
                            foundProduct = data.product;
                            sourceName = api.name;
                            break; // ¡Encontrado! Detenemos el bucle
                        }
                    } catch (err) {
                        // Si falla una API (ej. error de red), seguimos con la siguiente
                        console.warn(`Fallo en ${api.name}`, err);
                    }
                }

                // 4. Procesar resultado
                if (foundProduct) {
                    // Llenar Nombre si está vacío
                    if (!$('prodName').value && foundProduct.product_name) {
                        $('prodName').value = foundProduct.product_name;
                    }
                    
                    // Llenar Imagen si no hay una cargada
                    if (!state.tempImg && foundProduct.image_url) {
                        state.tempImg = foundProduct.image_url;
                        $('imgPreview').src = foundProduct.image_url;
                        $('imgPreview').classList.remove('hidden');
                        $('imgIcon').classList.add('hidden');
                    }
                    
                    // Feedback de éxito
                    alert(`¡Producto encontrado en base de datos de ${sourceName}! 🌍`);
                } else {
                    // Feedback de fallo
                    if(confirm('El producto no aparece en las bases de datos públicas (Comida, Belleza, Mascotas o Productos).\n\n¿Deseas buscarlo en Google?')) {
                        window.open(`https://www.google.com/search?q=${barcode}`, '_blank');
                    }
                }

            } catch (e) {
                console.error("Error general API:", e);
                alert("Error de conexión al buscar el producto.");
            } finally {
                // 5. Restaurar UI
                if(btn) {
                    btn.innerHTML = originalIcon;
                    btn.disabled = false;
                }
                nameInput.placeholder = originalPlaceholder;
            }
        }

        // --- FUNCIÓN PARA LIMPIAR BÚSQUEDA ---
        function clearSearch() {
            $('searchInput').value = ''; // Borramos texto
            renderAll(); // Recargamos la tabla completa
            $('searchInput').focus(); // Mantenemos el foco (útil en PC)
        };


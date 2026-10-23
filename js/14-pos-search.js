        // ==========================================
        // 14. BÚSQUEDA INTELIGENTE EN POS (AUTOCOMPLETE)
        // ==========================================
        
        function filterPosOptions() {
            const inputVal = $('posSearchInput').value.toLowerCase();
            const dropdown = $('posDropdown');
            const list = [...state.products].sort((a,b) => a.name.localeCompare(b.name));
            
            // Filtramos los productos
            const filtered = list.filter(p => 
                p.name.toLowerCase().includes(inputVal) || 
                (p.barcode && p.barcode.includes(inputVal))
            );

            dropdown.innerHTML = '';
            
            if (filtered.length === 0) {
                dropdown.innerHTML = '<div class="p-3 text-xs text-gray-400 text-center">No encontrado</div>';
            } else {
                filtered.forEach(p => {
                    // Verificamos stock para estilo visual
                    const noStock = p.qty < 1;
                    const stockClass = noStock ? 'text-red-400 bg-red-50' : 'text-gray-700 hover:bg-indigo-50 cursor-pointer';
                    const stockText = noStock ? '(Agotado)' : '';

                    const item = document.createElement('div');
                    item.className = `p-2 text-sm border-b last:border-0 transition-colors flex justify-between ${stockClass}`;
                    // Formato: Nombre (Precio)
                    item.innerHTML = `<span>${escapeHtml(p.name)} ${stockText}</span> <span class="font-bold">${formatMoney(p.price)}</span>`;
                    
                    if (!noStock) {
                        // Usamos onmousedown para ganar la carrera al evento 'blur'
                        item.onmousedown = () => selectPosProduct(p);
                    }
                    dropdown.appendChild(item);
                });
            }

            dropdown.classList.remove('hidden');
        }

        function selectPosProduct(product) {
            // 1. Llenamos el input visible con el nombre
            $('posSearchInput').value = product.name;
            // 2. Llenamos el input oculto con el ID (para que addToCart funcione)
            $('saleProductSelect').value = product.id;
            // 3. Mostramos el stock disponible en el hint
            if ($('stockHint')) $('stockHint').textContent = `En stock: ${product.qty}`;
            // 4. Ocultamos la lista
            $('posDropdown').classList.add('hidden');
        }

        function hidePosOptionsDelayed() {
            // Retrasamos el ocultado para que dé tiempo de registrar el clic en la opción
            setTimeout(() => {
                $('posDropdown').classList.add('hidden');
            }, 200);
        }


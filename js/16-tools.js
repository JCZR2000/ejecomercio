        // ==========================================
        // UI: MENÚ DE USUARIO (CLICK MODE)
        // ==========================================
        function toggleUserMenu() {
            const menu = document.getElementById('userMenuDropdown');
            menu.classList.toggle('hidden');
        }

        // CERRAR MENÚ AL HACER CLIC FUERA
        window.addEventListener('click', (e) => {
            const menu = document.getElementById('userMenuDropdown');
            const btn = document.querySelector('button[onclick="toggleUserMenu()"]');
            
            // Si el clic NO fue en el botón Y NO fue dentro del menú...
            if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
                // ...entonces ciérralo.
                menu.classList.add('hidden');
            }
        });

        // ==========================================
        // CALCULADORA DE PRECIOS (v42.0)
        // ==========================================
        
        // 1. Abrir Modal y Cargar Preferencias
        function openCalculator() {
            const modal = document.getElementById('calculatorModal');
            modal.classList.remove('hidden');

            // Cargar preferencias guardadas
            const savedTax = localStorage.getItem('calc_use_tax');
            const savedRate = localStorage.getItem('calc_tax_rate');
            const savedMargin = localStorage.getItem('calc_margin');

            if (savedTax === 'true') {
                document.getElementById('chkCalcTax').checked = true;
                document.getElementById('taxInputContainer').classList.remove('hidden');
            }
            if (savedRate) document.getElementById('calcTaxRate').value = savedRate;
            if (savedMargin) document.getElementById('calcMargin').value = savedMargin;
            
            // Enfocar en el primer input
            document.getElementById('calcBaseUSD').focus();
            calculatePriceResult();
        }

        function closeCalculator() {
            document.getElementById('calculatorModal').classList.add('hidden');
        }

        // 2. Toggle IVA (Mostrar/Ocultar y Guardar)
        function toggleCalcTax() {
            const chk = document.getElementById('chkCalcTax');
            const container = document.getElementById('taxInputContainer');
            
            if (chk.checked) {
                container.classList.remove('hidden');
                document.getElementById('calcTaxRate').focus();
            } else {
                container.classList.add('hidden');
            }
            
            localStorage.setItem('calc_use_tax', chk.checked);
            calculatePriceResult();
        }

        // 3. Sincronizar Divisas (Bs <-> USD)
        function syncCalcCurrency(source) {
            const rate = getActiveRate();
            if (rate <= 0) return;

            const inputUSD = document.getElementById('calcBaseUSD');
            const inputBs = document.getElementById('calcBaseBs');

            if (source === 'USD') {
                const val = parseFloat(inputUSD.value);
                inputBs.value = val ? (val * rate).toFixed(2) : '';
            } else {
                const val = parseFloat(inputBs.value);
                inputUSD.value = val ? (val / rate).toFixed(2) : '';
            }
        }

        // 4. EL CÁLCULO MATEMÁTICO PRINCIPAL (Con Conversión a Bs Visual)
        function calculatePriceResult() {
            // Inputs
            const base = parseFloat(document.getElementById('calcBaseUSD').value) || 0;
            const useTax = document.getElementById('chkCalcTax').checked;
            const taxRate = useTax ? (parseFloat(document.getElementById('calcTaxRate').value) || 0) : 0;
            const qty = parseFloat(document.getElementById('calcQty').value) || 1;
            const margin = parseFloat(document.getElementById('calcMargin').value) || 0;

            // Guardar preferencias en vivo
            if(useTax) localStorage.setItem('calc_tax_rate', taxRate);
            localStorage.setItem('calc_margin', margin);

            // 1. Costo Total Lote (Base + IVA)
            const totalCost = base * (1 + (taxRate / 100));

            // 2. Costo Unitario Real
            const unitCost = totalCost / qty;

            // 3. Precio Sugerido (Fórmula: Costo / (1 - Margen%))
            let sellingPrice = 0;
            const marginFactor = 1 - (margin / 100);
            
            if (marginFactor > 0 && marginFactor <= 1) {
                sellingPrice = unitCost / marginFactor;
            }

            // --- LÓGICA NUEVA: Conversión visual a Bs ---
            const rate = getActiveRate(); // Obtenemos la tasa del sistema
            const unitCostBs = unitCost * rate;
            const sellingPriceBs = sellingPrice * rate;

            const sym = getSymbol(); // $ o €

            // 4. Renderizar Resultados (Con HTML inyectado para estilos)
            
            // A. Costo Unitario: $0.00 (Bs 0.00)
            // El Bs va en gris y pequeño
            document.getElementById('displayUnitCost').innerHTML = 
                `${sym}${formatCalcNumber(unitCost)} <span class="text-xs text-gray-400 font-normal ml-1">(Bs ${formatCalcNumber(unitCostBs)})</span>`;

            // B. Precio Final: $0.00 / Bs 0.00
            // El Bs va en Azul y tamaño mediano (text-lg) vs el Grande (text-3xl) del dólar
            document.getElementById('displayFinalPrice').innerHTML = 
                `${sym}${formatCalcNumber(sellingPrice)} <span class="text-lg text-blue-600 font-bold ml-1">/ Bs ${formatCalcNumber(sellingPriceBs)}</span>`;
            
            // Guardamos el resultado limpio (solo el número en divisa fuerte) para el botón "Usar"
            document.getElementById('displayFinalPrice').dataset.value = sellingPrice.toFixed(2);
            document.getElementById('displayUnitCost').dataset.value = unitCost.toFixed(2);
        }

        function formatCalcNumber(num) {
            return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
        }

        // 5. Aplicar al formulario principal
        function applyCalculatedPrice() {
            const price = document.getElementById('displayFinalPrice').dataset.value;
            if (price && parseFloat(price) > 0) {
                $('prodPrice').value = price;
                // El costo unitario de la calculadora se guarda con el producto (aviso corto junto al precio)
                const unitCost = parseFloat(document.getElementById('displayUnitCost').dataset.value);
                $('prodCost').value = unitCost > 0 ? unitCost : '';
                if (unitCost > 0) {
                    let note = $('prodCostNote');
                    if (!note) {
                        note = document.createElement('p');
                        note.id = 'prodCostNote';
                        note.className = 'text-[10px] text-green-700 font-bold mt-1';
                        $('prodPrice').parentElement.appendChild(note);
                    }
                    note.textContent = `Costo guardado: ${formatMoney(unitCost)}`;
                }

                // Feedback visual en el input de precio
                $('prodPrice').classList.add('bg-green-100', 'transition-colors');
                setTimeout(() => $('prodPrice').classList.remove('bg-green-100'), 1000);
                
                closeCalculator();

                // --- NUEVO: Abrir el acordeón automáticamente ---
                toggleProductManager(true);
                // -----------------------------------------------
                
                // Scroll suave al input de precio
                $('prodPrice').scrollIntoView({ behavior: 'smooth', block: 'center' });
                $('prodPrice').focus();
            } else {
                alert("Calcula un precio válido primero.");
            }
        }


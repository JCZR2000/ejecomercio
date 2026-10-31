        // ==========================================
        // 22. SISTEMA DE PRECIOS DINÁMICOS (v42)
        // ==========================================

        function setCreditMode(mode) {
            state.creditMode = mode;
            localStorage.setItem('inv_credit_mode', mode); // Guardado inmediato en disco
            updateCreditConfigUI();
            renderAll(); // Re-renderizar todo para ver los cambios de precio al instante
        }

        function updateCreditConfigUI() {
            const btnDyn = $('btnCredDynamic');
            const btnFix = $('btnCredFixed');
            
            const dynamic = state.creditMode === 'DYNAMIC';
            btnDyn.className = optionClass(dynamic ? 'blue' : '');
            btnFix.className = optionClass(dynamic ? '' : 'slate');
        }

        // ESTA ES LA FUNCIÓN CLAVE: Calcula cuánto debe realmente
        function calculateRealDebt(credit) {
            // 1. Si ya está pagado (tiene fecha de cierre), NO TOCAR. Se respeta el histórico.
            if (credit.paidDate) return credit.totalDebt;

            // 2. Si el modo es FIJO, devolvemos lo que se guardó el día de la venta.
            if (state.creditMode === 'FIXED') return credit.totalDebt;

            // 3. MODO DINÁMICO: Recalcular item por item
            let currentTotal = 0;
            
            credit.items.forEach(item => {
                // Buscamos el producto en el inventario actual por ID
                // Nota: Los "Stubs" (deudas viejas migradas) no tienen ID en inventario, 
                // así que usarán 'item.price' (precio original) como fallback.
                const productInStock = state.products.find(p => p.id == item.id);
                
                const activePrice = productInStock ? productInStock.price : item.price;
                currentTotal += activePrice * item.qty;
            });

            // Sumamos recargos si existen
            if (credit.surcharge) currentTotal += credit.surcharge;

            return roundMoney(currentTotal);
        }


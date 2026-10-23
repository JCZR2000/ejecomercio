        // ==========================================
        // 10. PAGOS DE FIADOS
        // ==========================================
        function payCredit(id) {
            const rate = getFiadosActiveRate();
            const inputUSD = $(`pay_usd_${id}`);
            if (!inputUSD) return;

            const amount = parseFloat(inputUSD.value);
            if (!amount || amount <= 0) return alert('Monto inválido');

            const idx = state.credits.findIndex(c => c.id == id);
            if (idx === -1) return;

            // Antes de cobrar, actualizamos la deuda total en la base de datos
            // con el valor real calculado (incluyendo aumentos)
            const realTotal = calculateRealDebt(state.credits[idx]);
            state.credits[idx].totalDebt = realTotal;
            // ----------------------------------
            
            const c = state.credits[idx];

            // Tolerancia de 0.01 para errores de punto flotante
            if (amount > (c.totalDebt - c.paid + 0.01)) return alert('El monto excede la deuda');

            state.credits[idx].paid += amount;
            
            // --- NUEVO: Detectar si se completó el pago ---
            const remaining = state.credits[idx].totalDebt - state.credits[idx].paid;
            if (remaining <= 0.01) {
                // Se pagó completo: Marcamos la fecha de finalización
                state.credits[idx].paidDate = new Date().toISOString();
                
                // Ejecutamos limpieza automática para borrar los viejos
                setTimeout(autoPruneCredits, 500); 
            }
            // ----------------------------------------------

            state.sales.unshift({
                id: Date.now(),
                date: new Date().toISOString(),
                type: 'payment',
                description: `Abono: ${c.customer}`,
                total: amount,
                rate: rate
            });

            saveData();
            renderAll();
            
            // Pequeño delay para que la UI se actualice antes de la alerta
            setTimeout(() => {
                if (remaining <= 0.01) alert(`¡Deuda de ${c.customer} saldada! Se ha movido al historial.`);
                else alert('Abono registrado.');
            }, 100);
        }


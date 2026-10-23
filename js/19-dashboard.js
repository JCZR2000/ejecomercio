        // ==========================================
        // 20. MONITOR DE ALMACENAMIENTO (v42)
        // ==========================================
        let storageWarned = false; // el aviso del 80 % sale una vez por sesión
        function updateStorageUsage() {
            // 1. Mismas partes que sube saveData; el cifrado agrega ~33 %
            const { main, chunks } = buildCloudParts();
            const factor = encryptionKey ? 1.34 : 1;
            const mainBytes = new Blob([JSON.stringify(main)]).size * factor;
            const chunkBytes = Object.values(chunks).map(c => c.json.length * factor);
            const totalBytes = mainBytes + chunkBytes.reduce((a, b) => a + b, 0);

            // 2. La barra mide el documento más grande frente al límite de Firestore por documento (1 MiB)
            const bytes = Math.max(mainBytes, ...chunkBytes);
            const limit = 1048576;
            const percentage = Math.min(((bytes / limit) * 100), 100).toFixed(1);
            const toKb = n => (n / 1024).toFixed(0);

            // 4. Actualizamos UI
            const bar = $('storageBar');
            const text = $('storageText');
            
            bar.style.width = `${percentage}%`;
            text.textContent = `Documento principal ${toKb(mainBytes)} KB · Total en la nube ${toKb(totalBytes)} KB (documento más grande: ${percentage}% del límite)`;

            // 5. Colores del Semáforo
            bar.className = "h-2.5 rounded-full transition-all duration-1000 ";
            
            if (percentage < 50) {
                bar.classList.add('bg-green-500'); // Zona Segura
            } else if (percentage < 80) {
                bar.classList.add('bg-yellow-500'); // Zona de Precaución
            } else {
                bar.classList.add('bg-red-600', 'animate-pulse'); // ¡PELIGRO!
                if (!storageWarned) {
                    storageWarned = true;
                    alert("⚠️ ¡ADVERTENCIA DE ESPACIO! ⚠️\n\nTu base de datos está cerca del límite de 1MB.\nPor favor, borra historial o comprime imágenes.");
                }
            }
        }

        // ==========================================
        // 21. DASHBOARD ESTADÍSTICO (v42)
        // ==========================================
        let salesChartInstance = null; // Variable para guardar el gráfico

        function openDashboard() {
            $('dashboardModal').classList.remove('hidden');
            // Por defecto cargamos 7 días al abrir
            updateChart('7d');
        }

        function closeDashboard() {
            $('dashboardModal').classList.add('hidden');
        }

        function updateChart(range) {
            // 1. Actualizar estilos de botones
            ['7d', '30d', '12m'].forEach(r => {
                const btn = $(`btnChart${r}`);
                if(r === range) btn.className = "flex-1 py-1 text-xs font-bold rounded shadow bg-white text-indigo-600 transition";
                else btn.className = "flex-1 py-1 text-xs font-bold rounded text-gray-500 hover:bg-gray-200 transition";
            });

            // 2. Filtrar Datos
            const now = new Date();
            let labels = [];
            let dataPoints = [];
            let filteredSales = [];
            
            // Configuración según rango
            if (range === '7d' || range === '30d') {
                const days = range === '7d' ? 7 : 30;
                for (let i = days - 1; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(now.getDate() - i);
                    const dateStr = d.toLocaleDateString(); // Clave para agrupar
                    labels.push(dateStr.split('/')[0] + '/' + dateStr.split('/')[1]); // DD/MM visual
                    
                    // Sumar ventas de ese día
                    const dayTotal = state.sales.filter(s => {
                        const sDate = new Date(s.date);
                        return sDate.toDateString() === d.toDateString() && s.type !== 'payment'; // Solo ventas reales
                    }).reduce((sum, s) => sum + Number(s.total), 0);
                    
                    dataPoints.push(dayTotal);
                }
                
                // Filtramos ventas globales para el producto estrella dentro del rango
                const limitDate = new Date();
                limitDate.setDate(now.getDate() - days);
                filteredSales = state.sales.filter(s => new Date(s.date) >= limitDate && s.type !== 'payment');

            } else if (range === '12m') {
                for (let i = 11; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const monthName = d.toLocaleDateString('es-ES', { month: 'short' });
                    labels.push(monthName);

                    const monthTotal = state.sales.filter(s => {
                        const sDate = new Date(s.date);
                        return sDate.getMonth() === d.getMonth() && sDate.getFullYear() === d.getFullYear() && s.type !== 'payment';
                    }).reduce((sum, s) => sum + Number(s.total), 0);

                    dataPoints.push(monthTotal);
                }
                // Filtro anual para producto estrella
                const limitDate = new Date();
                limitDate.setFullYear(now.getFullYear() - 1);
                filteredSales = state.sales.filter(s => new Date(s.date) >= limitDate && s.type !== 'payment');
            }

            // 3. Renderizar Gráfico
            renderChartCanvas(labels, dataPoints);

            // 4. Calcular Producto Estrella
            calculateStarProduct(filteredSales);
        }

        function renderChartCanvas(labels, data) {
            const ctx = document.getElementById('salesChartCanvas').getContext('2d');
            const sym = getSymbol();

            // Destruir gráfico anterior si existe para evitar bugs visuales
            if (salesChartInstance) salesChartInstance.destroy();

            salesChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: `Ventas (${sym})`,
                        data: data,
                        borderColor: '#4f46e5', // Indigo-600
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        borderWidth: 2,
                        tension: 0.3, // Curvatura suave
                        fill: true,
                        pointRadius: 3,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#4f46e5'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `${sym} ` + context.parsed.y.toFixed(2);
                                }
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        function calculateStarProduct(salesList) {
            const productMap = {};

            // Conteo masivo de items
            salesList.forEach(sale => {
                if (sale.items) {
                    sale.items.forEach(item => {
                        // Ignorar Stubs (deudas viejas)
                        if (item.isStub) return;

                        if (!productMap[item.name]) {
                            productMap[item.name] = { qty: 0, id: item.id };
                        }
                        productMap[item.name].qty += item.qty;
                    });
                }
            });

            // Encontrar el ganador
            let winner = { name: 'Sin datos', qty: 0, img: null };
            let maxQty = -1;

            Object.entries(productMap).forEach(([name, data]) => {
                if (data.qty > maxQty) {
                    maxQty = data.qty;
                    // Buscamos la imagen en el inventario actual
                    const prodInStock = state.products.find(p => p.id == data.id);
                    winner = { 
                        name: name, 
                        qty: data.qty, 
                        img: prodInStock ? productImageSrc(prodInStock) : null 
                    };
                }
            });

            // Actualizar UI
            $('starProductName').textContent = winner.qty > 0 ? winner.name : 'No hay ventas en este periodo';
            $('starProductQty').textContent = winner.qty > 0 ? `${winner.qty} unidades vendidas` : '-';
            
            const imgDiv = $('starProductImg');
            if (winner.img) {
                imgDiv.innerHTML = `<img src="${escapeHtml(winner.img)}" class="w-full h-full object-cover">`;
            } else {
                imgDiv.innerHTML = `<i class="fa-solid fa-trophy"></i>`;
            }
        }

        function downloadChartImage() {
            const link = document.createElement('a');
            link.download = `reporte_ventas_${new Date().toISOString().split('T')[0]}.png`;
            // Chart.js canvas to Base64
            link.href = document.getElementById('salesChartCanvas').toDataURL('image/png');
            link.click();
        }


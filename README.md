# EjeComercio

Aplicación web progresiva (PWA) diseñada para la gestión ágil de inventarios, punto de venta y control de cuentas por cobrar (fiados), optimizada específicamente para el comercio en entornos con múltiples monedas (Dólares/Bolívares). Funciona totalmente en el navegador y almacena los datos localmente.

# Funcionalidades Principales:

### 📦 Gestión de Inventario Inteligente
· **Escáner de Barras Integrado:** Uso de la cámara del dispositivo para leer códigos EAN/UPC.

· **Consulta de API Externa:** Búsqueda automática de nombres e imágenes de productos en bases de datos globales (OpenFoodFacts, etc.).

· **Control de Stock:** Visualización clara de cantidades, precios referenciales y alertas de stock bajo.

<br />

### 🛒 Punto de Venta (POS) Multi-Moneda
· **Conversión en Tiempo Real:** Cálculo automático de precios en Bolívares (Bs) basado en tasas del día (API DolarVzla) o tasa personalizada.

· **Carrito Híbrido:** Capacidad de manejar ventas nuevas (que descuentan stock) y registros de deudas antiguas *(migración de clientes viejos)* en una misma transacción.

· **Buscador Rápido:** Filtrado instantáneo por nombre o código para agregar productos al vuelo.

<br />

### 📒 Sistema de Créditos y Fiados (Cuentas por Cobrar)
· **Expediente de Cliente:** Historial detallado de deudas, abonos y fechas de compra.

· **Migración de Deudas:** Herramienta dedicada para trasladar saldos de "cuadernos viejos" sin afectar el inventario actual.

· **Gestión de Pagos:** Registro de abonos parciales y cálculo automático de deuda restante.

· **Fechas de Compromiso:** Establecimiento de fechas límite de pago con alertas visuales de estado (Al día, Por vencer, Atrasado).

· **Recargos:** Aplicación de penalizaciones por mora (porcentaje % o monto fijo).

<br />

### 📲 Cobranza Social y Métodos de Pago
· **Recordatorios vía mensajeria:** Generación automática de mensajes de cobro detallados con desglose de productos y precios unitarios para compartir en diferentes apps.

· **Gestión de Métodos de Pago:** Configuración y guardado de datos bancarios (Pago Móvil, Transferencia, Binance Pay) para incluirlos automáticamente en los mensajes de cobro.

· **Formato Regional:** Adaptación inteligente de formatos de moneda (ej. Bs. 1.200,50 y $1,200.50).

<br />

### 🛡️ Seguridad y Datos
· **Protección por PIN:** Restricción de acciones críticas (borrar productos, modificar deudas, configuraciones) mediante contraseña de administrador.

· **Integridad de Datos:** Bloqueos lógicos para evitar borrar clientes con abonos pendientes o devolver stock incorrectamente.

· **Backup y Restauración:** Exportación e importación de la base de datos completa en formato JSON.

· **Offline-First:** Funciona sin conexión a internet (una vez cargada) utilizando LocalStorage.

<br />

# Tecnologías:

· HTML5 / JavaScript (Vanilla)

· Tailwind CSS (Diseño Responsivo)

· Html5-QRCode (Escáner)

· LocalStorage API

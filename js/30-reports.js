        // ==========================================
        // 30. REPORTES EXPORTABLES (Fase 33, Pro)
        // PDF con jsPDF + autotable (ya cargados) y Excel (.xlsx) hecho a mano, sin librería.
        // Salen al dispositivo del dueño, no a la nube.
        // ==========================================
        const REPORT_HEAD = ['Fecha', 'Hora', 'Tipo', 'Cliente', 'Producto', 'Cantidad', 'Precio $', 'Subtotal $', 'Método', 'Referencia', 'Tasa'];
        const REPORT_WIDTHS = [12, 8, 10, 26, 34, 10, 12, 13, 18, 16, 10];
        const REPORT_HEAD_ROW = 6; // 1 título, 2 período, 3-4 resumen, 5 en blanco, 6 cabecera
        const reportFileDate = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
        const reportPeriodText = (from, to) => `${formatShareDate(from)} al ${formatShareDate(new Date(to.getTime() - 1))}`;

        // Una fila por línea vendida (contado o fiado) y por abono, dentro de [from, to), por fecha. Pura.
        // Fila: [Date, tipo, cliente, producto, cantidad, precio, subtotal, método, referencia, tasa] ('' = celda vacía)
        // clientName(id) -> nombre del cliente de una venta de contado ('' si no tiene).
        function salesReportRows({ sales, credits, from, to, clientName = () => '' }) {
            const inRange = (d) => d >= from && d < to, rows = [];
            const num = (v) => roundMoney(Number(v) || 0);
            const line = (date, type, customer, it, src) => rows.push([date, type, customer || '',
                it ? it.name : '', it ? Number(it.qty) || 0 : '', it ? num(it.price) : '',
                num(it ? (it.subtotal ?? it.price * it.qty) : src.total),
                payMethodLabel(src.method), src.methodRef || '', src.rate ? num(src.rate) : '']);
            sales.forEach(s => {
                const d = new Date(s.date);
                if (!inRange(d)) return;
                if (s.type === 'payment') line(d, 'Abono', parseSaleBalanceNote(s).customer, null, s);
                else (s.items || []).forEach(it => { if (!it.isStub) line(d, 'Contado', clientName(s.clientId), it, s); });
            });
            credits.forEach(c => (c.items || []).forEach(it => {
                const d = new Date(it.at || c.date);
                if (!it.isStub && inRange(d)) line(d, 'Fiado', c.customer, it, { rate: c.rate });
            }));
            return rows.sort((x, y) => x[0] - y[0]);
        }

        // ---------- Excel (.xlsx): XML + zip sin compresión ----------
        // Texto para XML: sin caracteres de control que Excel rechaza, y escapado.
        const xmlText = (v) => String(v ?? '').replace(/[^\x09\x0A\x0D\x20-퟿-�\u{10000}-\u{10FFFF}]/gu, '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        // Celda. Los textos van como inlineStr: Excel nunca los ejecuta como fórmula (nombres como «=1+1» quedan como texto).
        function xlsxCell(ref, v, style = 0) {
            const st = style ? ` s="${style}"` : '';
            if (v === '' || v === null || v === undefined) return '';
            if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
            return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xmlText(v)}</t></is></c>`;
        }

        // Estilos (índices de cellXfs): 1 cabecera, 2 fecha, 3 hora, 4 dinero, 5 título, 6 negrita, 7 dinero en negrita
        const XLSX_STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            + '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="hh:mm"/></numFmts>'
            + '<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>'
            + '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>'
            + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
            + '<fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/><bgColor indexed="64"/></patternFill></fill></fills>'
            + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
            + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            + '<cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
            + '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
            + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
            + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
            + '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
            + '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
            + '<xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/></cellXfs>'
            + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

        // Hoja «Ventas»: título, período, resumen, cabecera con filtro y fila fija, y las filas de salesReportRows. Pura.
        function buildSalesSheet({ title, period, summary = [], rows }) {
            const col = (i) => 'ABCDEFGHIJK'[i], H = REPORT_HEAD_ROW;
            const row = (n, cells) => `<row r="${n}">${cells}</row>`;
            const serial = (d) => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000; // fecha de Excel
            const DATA_STYLE = [2, 3, 0, 0, 0, 0, 4, 4, 0, 0, 4];
            let xml = row(1, xlsxCell('A1', title, 5)) + row(2, xlsxCell('A2', period));
            summary.slice(0, 2).forEach(([label, value], i) => { xml += row(3 + i, xlsxCell(`A${3 + i}`, label, 6) + xlsxCell(`D${3 + i}`, value, 7)); });
            xml += row(H, REPORT_HEAD.map((h, i) => xlsxCell(col(i) + H, h, 1)).join(''));
            rows.forEach((r, k) => {
                const n = H + 1 + k, d = r[0];
                const vals = [serial(d), (d.getHours() * 60 + d.getMinutes()) / 1440, ...r.slice(1)];
                xml += row(n, vals.map((v, i) => xlsxCell(col(i) + n, v, DATA_STYLE[i])).join(''));
            });
            return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                + `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${H}" topLeftCell="A${H + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
                + '<cols>' + REPORT_WIDTHS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>'
                + `<sheetData>${xml}</sheetData><autoFilter ref="A${H}:K${H + rows.length}"/></worksheet>`;
        }

        const xlsxFiles = (sheetXml) => {
            const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', PKG = 'http://schemas.openxmlformats.org/package/2006/', DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
            const ML = 'application/vnd.openxmlformats-officedocument.spreadsheetml.';
            return [
                { name: '[Content_Types].xml', text: `${X}<Types xmlns="${PKG}content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${ML}sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${ML}worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="${ML}styles+xml"/></Types>` },
                { name: '_rels/.rels', text: `${X}<Relationships xmlns="${PKG}relationships"><Relationship Id="rId1" Type="${DOC}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
                { name: 'xl/workbook.xml', text: `${X}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${DOC}"><sheets><sheet name="Ventas" sheetId="1" r:id="rId1"/></sheets></workbook>` },
                { name: 'xl/_rels/workbook.xml.rels', text: `${X}<Relationships xmlns="${PKG}relationships"><Relationship Id="rId1" Type="${DOC}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${DOC}/styles" Target="styles.xml"/></Relationships>` },
                { name: 'xl/styles.xml', text: XLSX_STYLES },
                { name: 'xl/worksheets/sheet1.xml', text: sheetXml }];
        };

        // zip sin compresión (método 0): basta para un .xlsx y no necesita librería
        const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
        function crc32(bytes) {
            let c = 0xFFFFFFFF;
            for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
            return (c ^ 0xFFFFFFFF) >>> 0;
        }
        function zipStore(files) {
            const enc = new TextEncoder(), parts = [], central = [];
            let offset = 0;
            files.forEach(f => {
                const name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
                // Campos comunes a la cabecera local y a la del directorio: versión, UTF-8, sin compresión, 1980-01-01, crc, tamaños, largo del nombre
                const common = (dv, o) => { dv.setUint16(o, 20, true); dv.setUint16(o + 2, 0x0800, true); dv.setUint16(o + 8, 0x21, true); dv.setUint32(o + 10, crc, true); dv.setUint32(o + 14, data.length, true); dv.setUint32(o + 18, data.length, true); dv.setUint16(o + 22, name.length, true); };
                const local = new DataView(new ArrayBuffer(30)); local.setUint32(0, 0x04034b50, true); common(local, 4);
                const cen = new DataView(new ArrayBuffer(46)); cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); common(cen, 6); cen.setUint32(42, offset, true);
                parts.push(new Uint8Array(local.buffer), name, data);
                central.push(new Uint8Array(cen.buffer), name);
                offset += 30 + name.length + data.length;
            });
            const cdSize = central.reduce((a, p) => a + p.length, 0);
            const end = new DataView(new ArrayBuffer(22));
            end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
            const all = [...parts, ...central, new Uint8Array(end.buffer)], out = new Uint8Array(offset + cdSize + 22);
            let pos = 0;
            all.forEach(p => { out.set(p, pos); pos += p.length; });
            return out;
        }

        function downloadFile(name, data, mime) {
            const url = URL.createObjectURL(new Blob([data], { type: mime }));
            const a = document.createElement('a');
            a.href = url; a.download = name;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        // Candado y librerías: true si se puede generar
        function reportReady(needPdf) {
            if (!hasPro()) { openMyPlan('la exportación de reportes'); return false; }
            if (needPdf && !(window.jspdf && window.jspdf.jsPDF)) {
                customAlert('PDF no disponible', 'Las librerías de PDF aún se están cargando o estás offline. Intenta en unos segundos.', 'warning', null, 'offline');
                return false;
            }
            return true;
        }

        function exportSalesExcel(range = statsCurrent) {
            if (!reportReady(false)) return;
            const R = statsRange(range);
            const rows = salesReportRows({ sales: state.sales, credits: state.credits, from: R.from, to: R.to, clientName: (id) => (getClient(id) || {}).name || '' });
            if (!rows.length) return customAlert('Sin ventas', 'No hay ventas ni abonos en este período.', 'info');
            // Mismas cifras que las tarjetas de Estadísticas
            const st = computeSalesStats({ sales: state.sales, credits: state.credits, archive: state.profitArchive, from: R.from, to: R.to });
            const sheet = buildSalesSheet({
                title: `Ventas · ${String((state.receiptConfig || {}).companyName || 'Mi Negocio').slice(0, 60)}`,
                period: `Período: ${reportPeriodText(R.from, R.to)} · Generado el ${formatShareDate(new Date())}`,
                summary: [['Vendido (contado + fiados)', st.sold], ['Cobrado (contado + abonos)', st.collected]],
                rows });
            downloadFile(`ventas_${reportFileDate()}.xlsx`, zipStore(xlsxFiles(sheet)), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        }

        // Documento con encabezado (negocio, título, período) y pie; body(doc, table) añade las tablas
        function buildReportPdf(title, period, body) {
            const doc = new window.jspdf.jsPDF();
            const w = doc.internal.pageSize.width;
            doc.setFillColor(15, 23, 42); doc.rect(0, 0, w, 30, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
            doc.text(String((state.receiptConfig || {}).companyName || 'Mi Negocio').slice(0, 60), 14, 13);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
            doc.text(`${title} · ${period}`, 14, 21);
            doc.text(`Generado el ${formatShareDate(new Date())}`, w - 14, 21, { align: 'right' });
            let y = 38;
            const table = (head, rows, opts = {}) => {
                doc.autoTable({ startY: y, head: [head], body: rows, theme: 'striped', styles: { fontSize: 9 }, headStyles: { fillColor: [79, 70, 229] }, margin: { left: 14, right: 14 }, ...opts });
                y = doc.lastAutoTable.finalY + 8;
            };
            body(doc, table);
            const pages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pages; i++) {
                doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
                doc.text(`Generado con EjeComercio · Página ${i} de ${pages}`, w / 2, doc.internal.pageSize.height - 8, { align: 'center' });
            }
            return doc;
        }
        const reportDeltaText = (cur, prev, label) => { const p = statsDelta(cur, prev); return p === null ? 'Sin datos del período anterior' : `${p >= 0 ? '+' : '-'}${Math.abs(p)} % vs. ${label}`; };
        const REPORT_RIGHT = { halign: 'right' };
        const pdfMoney = (v) => formatMoney(v).replace('€', 'EUR '); // la fuente estándar del PDF no trae el símbolo del euro

        function exportSalesReportPDF(range = statsCurrent) {
            if (!reportReady(true)) return;
            const R = statsRange(range), base = { sales: state.sales, credits: state.credits, archive: state.profitArchive };
            const r = computeSalesStats({ ...base, from: R.from, to: R.to, buckets: R.buckets, topN: 10 });
            const prev = computeSalesStats({ ...base, from: R.prevFrom, to: R.prevTo }).sold;
            buildReportPdf('Reporte de ventas', reportPeriodText(R.from, R.to), (doc, table) => {
                table(['Resumen', ''], [
                    ['Vendido (contado + fiados)', pdfMoney(r.sold)],
                    ['Comparación', reportDeltaText(r.sold, prev, R.prevLabel)],
                    ['Cobrado (contado + abonos)', pdfMoney(r.collected)],
                    ['Ventas', String(r.tickets)],
                    ['Ticket promedio', pdfMoney(r.avgTicket)]], { columnStyles: { 1: REPORT_RIGHT } });
                table([range === '12m' ? 'Mes' : 'Día', 'Vendido'], R.buckets.map((b, i) => [b.label, pdfMoney(r.series[i])]), { columnStyles: { 1: REPORT_RIGHT } });
                table(['Los 10 más vendidos', 'Unidades', 'Vendido'], r.top.length ? r.top.map(t => [t.name, String(t.qty), pdfMoney(t.sold)]) : [['Sin ventas en este período', '', '']], { columnStyles: { 1: REPORT_RIGHT, 2: REPORT_RIGHT } });
            }).save(`reporte_ventas_${reportFileDate()}.pdf`);
        }

        // El botón está dentro de Ganancias: ya pasó por el candado Pro y el PIN
        function exportProfitReportPDF(period = profitPeriod) {
            if (!reportReady(true)) return;
            const { from, to } = profitRange(period), prev = profitPrevRange(period);
            const src = { sales: state.sales, credits: state.credits, archive: state.profitArchive, products: state.products };
            const r = computeProfit({ ...src, from, to });
            const prevProfit = computeProfit({ ...src, from: prev.from, to: prev.to }).profit;
            const pending = roundMoney(state.credits.reduce((a, c) => a + Math.max(0, creditPending(c)), 0));
            const prods = Object.values(r.byProduct);
            const noCost = {};
            profitLines(state.sales, state.credits).forEach(({ item, date }) => {
                if (!(date >= from && date < to)) return;
                const l = profitLine(item, state.products);
                if (l.cost === null) noCost[item.name] = roundMoney((noCost[item.name] || 0) + l.amount);
            });
            buildReportPdf('Reporte de ganancias', reportPeriodText(from, to), (doc, table) => {
                table(['Resumen', ''], [
                    ['Ganancia', pdfMoney(r.profit)],
                    ['Margen', `${(r.margin * 100).toFixed(1)} %`],
                    ['Comparación', reportDeltaText(r.profit, prevProfit, prev.label)],
                    ['Vendido', pdfMoney(r.sold)],
                    ['Costo de lo vendido', pdfMoney(r.cost)],
                    ['Cobrado', pdfMoney(r.collected)],
                    ['Por cobrar (hoy, no del período)', pdfMoney(pending)],
                    ...(r.noCost > 0 ? [['Vendido sin costo (no entra en la ganancia)', pdfMoney(r.noCost)]] : [])], { columnStyles: { 1: REPORT_RIGHT } });
                const rows = (list) => list.length ? list.map(b => [b.name, String(b.qty), pdfMoney(b.sold), pdfMoney(b.profit)]) : [['Ninguno', '', '', '']];
                const cols = { columnStyles: { 1: REPORT_RIGHT, 2: REPORT_RIGHT, 3: REPORT_RIGHT } };
                table(['Los que más ganancia dejan', 'Unidades', 'Vendido', 'Ganancia'], rows(prods.filter(b => b.profit > 0).sort((a, b) => b.profit - a.profit).slice(0, 10)), cols);
                table(['Vendidos por debajo del costo', 'Unidades', 'Vendido', 'Ganancia'], rows(prods.filter(b => b.profit < 0).sort((a, b) => a.profit - b.profit).slice(0, 10)), cols);
                const nc = Object.entries(noCost);
                table(['Productos vendidos sin costo', 'Vendido'], nc.length ? nc.map(([name, sold]) => [name, pdfMoney(sold)]) : [['Ninguno', '']], { columnStyles: { 1: REPORT_RIGHT } });
            }).save(`reporte_ganancias_${reportFileDate()}.pdf`);
        }

        // ---------- Autoprueba (datos ficticios, no descarga nada). Ejecutar en consola: selfTestReports() ----------
        function selfTestReports() {
            let fails = 0;
            const t = (cond, msg) => { console.assert(cond, 'selfTestReports: ' + msg); if (!cond) fails++; };
            const iso = (d, h) => new Date(2026, 5, d, h, 5).toISOString();
            const sales = [
                { date: iso(10, 9), type: 'sale', total: 6, rate: 40.5, method: 'EFECTIVO', clientId: 'c1', items: [{ id: 1, name: '=1+1', price: 3, qty: 2, subtotal: 6 }, { id: 9, name: 'Deuda vieja', price: 1, qty: 1, isStub: true }] },
                { date: iso(10, 12), type: 'payment', total: 5, description: 'Abono: Cliente Ficticio', rate: 40.5, methodRef: '0012' },
                { date: iso(2, 9), type: 'sale', total: 1, items: [{ id: 1, name: 'Fuera de rango', price: 1, qty: 1 }] }];
            const credits = [{ id: 7, customer: 'Ana & <Hijos>', date: iso(9, 8), rate: 39, items: [{ id: 2, name: 'Arroz', price: 2.5, qty: 2 }, { id: 2, name: 'Stub', price: 2, qty: 1, isStub: true }] }];
            const rows = salesReportRows({ sales, credits, from: new Date(2026, 5, 4), to: new Date(2026, 5, 11), clientName: (id) => id === 'c1' ? 'Ana' : '' });
            t(rows.length === 3 && rows.every(r => r.length === REPORT_HEAD.length - 1), 'una fila por línea vendida y por abono, sin isStub ni fuera de rango');
            t(rows[0][1] === 'Fiado' && rows[0][0].getDate() === 9 && rows[0][4] === 2 && rows[0][5] === 2.5 && rows[0][6] === 5 && rows[0][9] === 39, 'fila de fiado, ordenada por fecha, con números');
            t(rows[1][1] === 'Contado' && rows[1][2] === 'Ana' && rows[1][3] === '=1+1' && rows[1][6] === 6 && rows[1][7] !== '', 'fila de contado con cliente y método');
            t(rows[2][1] === 'Abono' && rows[2][2] === 'Cliente Ficticio' && rows[2][3] === '' && rows[2][4] === '' && rows[2][6] === 5 && rows[2][8] === '0012', 'fila de abono');
            // Hoja
            t(xmlText('a<b>&"c"') === 'a&lt;b&gt;&amp;&quot;c&quot;' && xmlText('x\u0001y\u000Bz') === 'xyz' && xmlText(null) === '', 'texto XML escapado y sin caracteres de control');
            t(xlsxCell('A1', '') === '' && xlsxCell('B2', 1.5, 4) === '<c r="B2" s="4"><v>1.5</v></c>' && xlsxCell('C3', '=1+1').includes('t="inlineStr"'), 'celdas: vacía, número y texto');
            const sheet = buildSalesSheet({ title: 'Ventas · Negocio Ficticio', period: 'Período', summary: [['Vendido', 11], ['Cobrado', 11]], rows });
            const H = REPORT_HEAD_ROW;
            t(!sheet.includes('<f>') && sheet.includes('<t xml:space="preserve">=1+1</t>'), 'un producto «=1+1» va como texto, nunca como fórmula');
            t(sheet.includes('Ana &amp; &lt;Hijos&gt;') && sheet.includes('<t xml:space="preserve">0012</t>'), 'nombres escapados y referencia con ceros a la izquierda');
            t(sheet.includes(`<autoFilter ref="A${H}:K${H + 3}"/>`) && sheet.includes(`ySplit="${H}"`) && (sheet.match(/<row /g) || []).length === 8, 'cabecera fija, filtro y número de filas');
            t(sheet.includes(`<c r="A${H + 1}" s="2"><v>46182</v></c>`) && sheet.includes(`<c r="G${H + 1}" s="4"><v>2.5</v></c>`), 'fecha como número de Excel (09/06/2026 = 46182) y dinero con formato');
            // zip
            const enc = new TextEncoder();
            t(crc32(enc.encode('123456789')) === 0xCBF43926, 'crc32 del valor de referencia');
            const files = xlsxFiles(sheet), zip = zipStore(files), dv = new DataView(zip.buffer);
            t(dv.getUint32(0, true) === 0x04034b50 && dv.getUint32(zip.length - 22, true) === 0x06054b50 && dv.getUint16(zip.length - 12, true) === 6, 'zip: firma, fin y 6 archivos');
            const total = files.reduce((a, f) => a + 30 + 46 + 2 * enc.encode(f.name).length + enc.encode(f.text).length, 22);
            t(zip.length === total && dv.getUint32(zip.length - 6, true) === zip.length - 22 - dv.getUint32(zip.length - 10, true), 'zip: tamaño y posición del directorio');
            console.log(fails ? `selfTestReports: ${fails} fallas` : 'selfTestReports: OK');
            return fails;
        }

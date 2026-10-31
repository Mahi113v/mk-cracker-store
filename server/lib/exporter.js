const ExcelJS = require('exceljs');

// Sends an .xlsx report to the browser
async function sendXlsx(res, filename, sheetName, columns, rows, totals) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 16, style: c.numFmt ? { numFmt: c.numFmt } : {} }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C3C' } };
  rows.forEach((r) => ws.addRow(r));
  if (totals) { const t = ws.addRow(totals); t.font = { bold: true }; }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

module.exports = { sendXlsx };

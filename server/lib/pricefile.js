const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { PDFDocument: PdfLib } = require('pdf-lib');
const { Readable } = require('stream');
const { httpErr } = require('../middleware/auth');

const fieldName = (code) => 'qty__' + String(code).replace(/\./g, '~');
const codeFromField = (name) => name.slice(5).replace(/~/g, '.');

/* ---------------------------------------------------------------- EXCEL PRICE LIST */
async function buildExcel(company, products) {
  const wb = new ExcelJS.Workbook();
  wb.creator = company.name;
  const ws = wb.addWorksheet('Price List', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'S.No', key: 'sno', width: 7 }, { header: 'Code', key: 'code', width: 14 }, { header: 'Name', key: 'name', width: 38 },
    { header: 'Brand', key: 'brand', width: 14 }, { header: 'Category', key: 'category', width: 26 }, { header: 'Pack', key: 'pack', width: 12 },
    { header: 'MRP', key: 'mrp', width: 12, style: { numFmt: '#,##0.00' } }, { header: 'Discount %', key: 'disc', width: 12 },
    { header: 'Price', key: 'price', width: 12, style: { numFmt: '#,##0.00' } }, { header: 'Qty', key: 'qty', width: 10 },
  ];
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C3C' } };
  products.forEach((p, i) => {
    const r = ws.addRow({ sno: i + 1, code: p.code, name: p.name, brand: p.brand, category: p.category, pack: p.pack, mrp: p.mrp, disc: Number(p.discount_percent), price: p.price, qty: null });
    r.getCell('qty').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3C4' } };
  });
  const help = wb.addWorksheet('How to use');
  help.getColumn(1).width = 90;
  ['1. Type the quantity you want in the yellow "Qty" column of the "Price List" sheet.',
    '2. Do not change the "Code" column.', '3. Save the file and upload it in Quick Buy (Upload Excel / PDF).',
    `Generated for ${company.name} on ${new Date().toLocaleDateString('en-IN')}`].forEach((t) => help.addRow([t]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------------------------------------------------------------- PDF PRICE LIST (fillable Qty boxes) */
function buildPdf(company, products) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 30 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.initForm();

    const X = { sno: 30, code: 58, name: 122, pack: 318, mrp: 372, disc: 420, price: 462, qty: 514 };
    const header = () => {
      const y = doc.y;
      doc.rect(30, y, 535, 20).fill('#b91c3c');
      doc.fillColor('#fff').fontSize(8.5).font('Helvetica-Bold');
      [['S.No', 'sno'], ['Code', 'code'], ['Name', 'name'], ['Pack', 'pack'], ['MRP', 'mrp'], ['Disc %', 'disc'], ['Price', 'price'], ['Qty', 'qty']]
        .forEach(([t, k]) => doc.text(t, X[k] + 2, y + 6, { lineBreak: false }));
      doc.y = y + 24;
      doc.fillColor('#000').font('Helvetica');
    };

    doc.fontSize(18).font('Helvetica-Bold').fillColor('#b91c3c').text(company.name, { align: 'left' });
    doc.fontSize(11).fillColor('#333').font('Helvetica').text(`Price List  |  ${new Date().toLocaleDateString('en-IN')}`);
    doc.fontSize(8.5).fillColor('#666').text('Fill the yellow Qty boxes, save the PDF and upload it in Quick Buy (Upload Excel / PDF).');
    doc.moveDown(0.6);
    header();

    let cat = null, n = 0;
    for (const p of products) {
      if (doc.y > 770) { doc.addPage(); header(); cat = null; }
      if (p.category !== cat) {
        cat = p.category;
        doc.rect(30, doc.y, 535, 16).fill('#fde8ee');
        doc.fillColor('#9f1239').font('Helvetica-Bold').fontSize(8.5).text(String(cat || 'Others').toUpperCase(), 34, doc.y + 4.5, { lineBreak: false });
        doc.y += 19; doc.fillColor('#000').font('Helvetica');
      }
      const y = doc.y;
      doc.fontSize(8.5).fillColor('#000');
      doc.text(String(++n), X.sno + 2, y + 6, { lineBreak: false });
      doc.text(p.code, X.code + 2, y + 6, { lineBreak: false, width: 62 });
      doc.text(p.name, X.name + 2, y + 6, { lineBreak: false, width: 190, ellipsis: true });
      doc.text(p.pack || '', X.pack + 2, y + 6, { lineBreak: false, width: 50 });
      doc.text(String(p.mrp), X.mrp + 2, y + 6, { lineBreak: false, width: 46 });
      doc.text(`${Math.round(p.discount_percent)}%`, X.disc + 2, y + 6, { lineBreak: false, width: 40 });
      doc.text(String(p.price), X.price + 2, y + 6, { lineBreak: false, width: 48 });
      doc.formText(fieldName(p.code), X.qty, y + 2, 50, 18, { align: 'center', backgroundColor: '#fff3c4', borderColor: '#c9a227' });
      doc.moveTo(30, y + 22).lineTo(565, y + 22).lineWidth(0.3).strokeColor('#ddd').stroke();
      doc.y = y + 23;
    }
    doc.end();
  });
}

/* ---------------------------------------------------------------- READ QUANTITIES BACK */
const cellNum = (cell) => {
  const n = parseFloat(String(cell.text ?? cell.value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

async function parseSheet(buffer, isCsv) {
  const wb = new ExcelJS.Workbook();
  if (isCsv) await wb.csv.read(Readable.from(buffer)); else await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw httpErr(400, 'The file has no sheet');
  let hdr = -1, cc = -1, qc = -1;
  for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
    let c1 = -1, q1 = -1;
    ws.getRow(r).eachCell((cell, col) => {
      const t = String(cell.text || '').toLowerCase().trim();
      if (/^(code|item code|product code|sku)$/.test(t)) c1 = col;
      if (/^(qty|quantity|order qty|order quantity)$/.test(t)) q1 = col;
    });
    if (c1 > 0 && q1 > 0) { hdr = r; cc = c1; qc = q1; break; }
  }
  if (hdr < 0) throw httpErr(400, 'Could not find the "Code" and "Qty" columns. Use the Price List Excel downloaded from this site');
  const rows = [];
  for (let r = hdr + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const code = String(row.getCell(cc).text || '').trim();
    const qty = cellNum(row.getCell(qc));
    if (code && qty > 0) rows.push({ code, qty: Math.floor(qty) });
  }
  return rows;
}

async function parsePdf(buffer, byCode) {
  // 1) our own fillable PDF -> read the Qty boxes
  try {
    const pdf = await PdfLib.load(buffer, { ignoreEncryption: true, updateMetadata: false });
    const rows = [];
    let hasForm = false;
    for (const f of pdf.getForm().getFields()) {
      const name = f.getName();
      if (!name.startsWith('qty__')) continue;
      hasForm = true;
      let v = '';
      try { v = f.getText() || ''; } catch { v = ''; }
      const qty = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
      if (qty > 0) rows.push({ code: codeFromField(name), qty });
    }
    if (hasForm) return rows;
  } catch { /* not a form PDF -> text fallback */ }

  // 2) normal PDF text: lines like "CK-0031 ... 5"  (last whole number on the line is the qty)
  const pdfParse = require('pdf-parse/lib/pdf-parse.js');
  const data = await pdfParse(buffer);
  const rows = [];
  for (const line of String(data.text || '').split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/);
    const idx = tokens.findIndex((t) => byCode.has(t.toUpperCase().replace(/[,;:]+$/, '')));
    if (idx < 0) continue;
    const p = byCode.get(tokens[idx].toUpperCase().replace(/[,;:]+$/, ''));
    const nums = tokens.slice(idx + 1).filter((t) => /^\d+$/.test(t)).map(Number);
    if (!nums.length) continue;
    const q = nums[nums.length - 1];
    if (q === Number(p.price) || q === Number(p.mrp) || q === Math.round(p.discount_percent)) continue; // that is a price column, not a qty
    if (q > 0) rows.push({ code: p.code, qty: q });
  }
  return rows;
}

async function parseQuantities(file, products) {
  const byCode = new Map(products.map((p) => [String(p.code).toUpperCase(), p]));
  const name = String(file.originalname || '').toLowerCase();
  let rows;
  if (name.endsWith('.pdf')) rows = await parsePdf(file.buffer, byCode);
  else if (name.endsWith('.xlsx') || name.endsWith('.csv')) rows = await parseSheet(file.buffer, name.endsWith('.csv'));
  else throw httpErr(400, 'Upload an Excel (.xlsx), CSV or PDF file');
  const items = [], unknown = [];
  const seen = new Set();
  for (const r of rows) {
    const p = byCode.get(String(r.code).toUpperCase());
    if (!p) { unknown.push(r.code); continue; }
    if (seen.has(p.code)) continue;
    seen.add(p.code);
    items.push({ code: p.code, qty: r.qty });
  }
  return { items, unknown };
}

module.exports = { buildExcel, buildPdf, parseQuantities };

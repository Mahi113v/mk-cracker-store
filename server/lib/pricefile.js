const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { PDFDocument: PdfLib } = require('pdf-lib');
const { Readable } = require('stream');
const { httpErr } = require('../middleware/auth');

const fs = require('fs');
const path = require('path');

const fieldName = (code) => 'qty__' + String(code).replace(/\./g, '~');
const codeFromField = (name) => name.slice(5).replace(/~/g, '.');

const BACKEND_ROOT = path.join(__dirname, '../..');
const FONT_DIR = path.join(__dirname, '../assets/fonts');
const hexOk = (c, d) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : d);
// mix a colour with white: amount 0..1 (1 = original colour)
const tint = (hex, amount) => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v) => Math.round(255 - (255 - v) * amount);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, '0')).join('');
};
const argb = (hex) => 'FF' + hex.slice(1).toUpperCase();

// Company logo (or icon) as a PNG / JPEG buffer for the PDF. Other formats (webp, gif, ico) are skipped.
function logoBuffer(company) {
  for (const p of [company.logo, company.icon]) {
    if (!p || !String(p).startsWith('/uploads/')) continue;
    try {
      const full = path.join(BACKEND_ROOT, p);
      if (!full.startsWith(path.join(BACKEND_ROOT, 'uploads'))) continue;
      const b = fs.readFileSync(full);
      const png = b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
      const jpg = b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
      if (png || jpg) return b;
    } catch { /* try next */ }
  }
  return null;
}

/* ---------------------------------------------------------------- EXCEL PRICE LIST */
async function buildExcel(company, products) {
  const brand = hexOk(company.brand_color, '#b91c3c');
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
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(brand) } };
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
const TAMIL = /[\u0B80-\u0BFF]/;
const NEUTRAL = /[\s\d.,:;%()\-/+&'"!?₹]/;
const TEXT = {
  en: {
    title: 'Price List', no: 'S.No', code: 'Code', name: 'Name', pack: 'Pack', mrp: 'MRP', disc: 'Disc %', price: 'Price', qty: 'Qty', others: 'Others',
    hint: 'Fill the yellow Qty boxes, save the PDF and upload it in Quick Buy (Upload Excel / PDF).',
  },
  ta: {
    title: 'விலை பட்டியல்', no: 'எண்', code: 'குறியீடு', name: 'பெயர்', pack: 'பேக்', mrp: 'MRP', disc: 'தள்ளுபடி', price: 'விலை', qty: 'அளவு', others: 'மற்றவை',
    hint: 'மஞ்சள் நிறப் பெட்டிகளில் எண்ணிக்கையை நிரப்பி, PDF-ஐச் சேமித்து, Quick Buy பக்கத்தில் பதிவேற்றவும்.',
  },
};

// Splits a string into runs: Tamil text uses the Tamil font, everything else uses Helvetica.
function runsOf(str) {
  const out = [];
  let cur = ''; let ta = null;
  for (const ch of String(str ?? '')) {
    const isTa = TAMIL.test(ch);
    const t = !isTa && NEUTRAL.test(ch) && ta !== null ? ta : isTa;
    if (ta === null) ta = t;
    if (t !== ta) { out.push([cur, ta]); cur = ''; ta = t; }
    cur += ch;
  }
  if (cur) out.push([cur, ta]);
  return out;
}

function buildPdf(company, products, opts = {}) {
  const lang = opts.lang === 'ta' ? 'ta' : 'en';
  const T = TEXT[lang];
  const brand = hexOk(company.brand_color, '#b91c3c');
  const soft = tint(brand, 0.12);
  const dark = tint(brand, 1);
  const logo = logoBuffer(company);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 30, info: { Title: `${company.name} ${T.title}`, Author: company.name } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.initForm();
    try {
      doc.registerFont('ta', path.join(FONT_DIR, 'NotoSansTamil-Regular.ttf'));
      doc.registerFont('ta-b', path.join(FONT_DIR, 'NotoSansTamil-Bold.ttf'));
    } catch { /* font files missing -> Tamil falls back to boxes, English still works */ }

    const fontOf = (ta, bold) => (ta ? (bold ? 'ta-b' : 'ta') : bold ? 'Helvetica-Bold' : 'Helvetica');
    // draw one line of mixed Tamil / English text (cut with ... when wider than width)
    const put = (str, x, y, o = {}) => {
      const { size = 8.5, bold = false, color = '#000', width = null, align = 'left' } = o;
      let parts = runsOf(str).map(([t, ta]) => [Array.from(t), ta]);
      const w = (t, ta) => doc.font(fontOf(ta, bold)).fontSize(size).widthOfString(t);
      const total = () => parts.reduce((a, [t, ta]) => a + w(t.join(''), ta), 0);
      let tw = total();
      if (width && tw > width) {
        while (parts.length && tw > width - 6) {
          const last = parts[parts.length - 1];
          last[0].pop();
          if (!last[0].length) parts.pop();
          tw = total();
        }
        if (parts.length) parts[parts.length - 1][0].push('…');
        tw = total();
      }
      let cx = x;
      if (width && align === 'center') cx = x + (width - tw) / 2;
      if (width && align === 'right') cx = x + width - tw;
      for (const [t, ta] of parts) {
        const txt = t.join('');
        doc.font(fontOf(ta, bold)).fontSize(size).fillColor(color).text(txt, cx, y, { lineBreak: false });
        cx += w(txt, ta);
      }
    };

    const X = { sno: 30, code: 58, name: 120, pack: 296, mrp: 350, disc: 398, price: 454, qty: 508 };
    const header = () => {
      const y = doc.y;
      doc.rect(30, y, 535, 20).fill(brand);
      [[T.no, 'sno'], [T.code, 'code'], [T.name, 'name'], [T.pack, 'pack'], [T.mrp, 'mrp'], [T.disc, 'disc'], [T.price, 'price'], [T.qty, 'qty']]
        .forEach(([t, k]) => put(t, X[k] + 2, y + 6, { size: 8.5, bold: true, color: '#fff' }));
      doc.y = y + 24;
    };

    // ---- title block with company logo
    let tx = 30;
    if (logo) {
      try { doc.image(logo, 30, 28, { fit: [46, 46], align: 'center', valign: 'center' }); tx = 86; } catch { /* unsupported image */ }
    }
    if (tx === 30) {
      doc.roundedRect(30, 28, 46, 46, 8).fill(brand);
      put(String(company.name || '?').trim().charAt(0).toUpperCase(), 30, 38, { size: 24, bold: true, color: '#fff', width: 46, align: 'center' });
      tx = 86;
    }
    put(company.name, tx, 30, { size: 19, bold: true, color: dark, width: 470 });
    put(`${T.title}  |  ${new Date().toLocaleDateString('en-IN')}`, tx, 54, { size: 11, color: '#333' });
    put(T.hint, 30, 82, { size: 8, color: '#666', width: 535 });
    doc.y = 100;
    header();

    let cat = null; let n = 0;
    for (const p of products) {
      if (doc.y > 770) { doc.addPage(); header(); cat = null; }
      if (p.category !== cat) {
        cat = p.category;
        const cy = doc.y;
        doc.rect(30, cy, 535, 16).fill(soft);
        put(String(cat || T.others).toUpperCase(), 34, cy + 4.5, { size: 8.5, bold: true, color: dark });
        doc.y = cy + 19;
      }
      const y = doc.y;
      put(String(++n), X.sno + 2, y + 6);
      put(p.code, X.code + 2, y + 6, { width: 60 });
      put(p.name, X.name + 2, y + 6, { width: 172 });
      put(p.pack || '', X.pack + 2, y + 6, { width: 52 });
      put(String(p.mrp), X.mrp + 2, y + 6, { width: 46 });
      put(`${Math.round(p.discount_percent * 10) / 10}%`, X.disc + 2, y + 6, { width: 54 });
      put(String(p.price), X.price + 2, y + 6, { width: 50 });
      doc.formText(fieldName(p.code), X.qty, y + 2, 52, 18, { align: 'center', backgroundColor: '#fff3c4', borderColor: '#c9a227' });
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

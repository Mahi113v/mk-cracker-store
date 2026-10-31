const router = require('express').Router();
const { ah, httpErr } = require('../middleware/auth');
const { sendXlsx } = require('../lib/exporter');

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const EXPR = {
  day: "DATE_FORMAT({c},'%Y-%m-%d')",
  week: "DATE_FORMAT(DATE_SUB(DATE({c}), INTERVAL WEEKDAY({c}) DAY),'%Y-%m-%d')",
  month: "DATE_FORMAT({c},'%Y-%m')",
  year: "DATE_FORMAT({c},'%Y')",
};
const SALES = ["'paid'", "'delivered'"];
const ALLOPEN = ["'unpaid'", "'pending_verification'", "'paid'", "'delivered'"];

function params(req) {
  const period = EXPR[req.query.period] ? req.query.period : 'day';
  const now = new Date();
  const back = { day: 30, week: 84, month: 365, year: 1825 }[period];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : ymd(start);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : ymd(now);
  if (from > to) throw httpErr(400, 'From date must be before To date');
  const statuses = req.query.scope === 'all' ? ALLOPEN : SALES;
  return { period, from, to, statuses, fromTs: `${from} 00:00:00`, toTs: `${to} 00:00:00` };
}
const expr = (period, col) => EXPR[period].split('{c}').join(col);

// ---------- SALES by period (daily / weekly / monthly / yearly)
router.get('/sales', ah(async (req, res) => {
  const q = params(req);
  const [rows] = await req.db.query(
    `SELECT ${expr(q.period, 'o.created_at')} AS period, COUNT(DISTINCT o.id) AS orders,
       COALESCE(SUM(oi.qty),0) AS qty, COALESCE(SUM(oi.mrp*oi.qty),0) AS mrp_total, COALESCE(SUM(oi.amount),0) AS net
     FROM orders o JOIN order_items oi ON oi.order_id=o.id
     WHERE o.created_at>=? AND o.created_at<DATE_ADD(?, INTERVAL 1 DAY) AND o.status IN (${q.statuses.join(',')})
     GROUP BY period ORDER BY period`, [q.fromTs, q.toTs]);
  rows.forEach((r) => { r.discount = Math.round((r.mrp_total - r.net) * 100) / 100; });
  const totals = rows.reduce((t, r) => ({ orders: t.orders + r.orders, qty: t.qty + Number(r.qty), mrp_total: t.mrp_total + Number(r.mrp_total), net: t.net + Number(r.net), discount: t.discount + r.discount }),
    { orders: 0, qty: 0, mrp_total: 0, net: 0, discount: 0 });
  if (req.query.format === 'xlsx') {
    return sendXlsx(res, `sales-${q.period}-${q.from}-to-${q.to}.xlsx`, 'Sales',
      [{ header: 'Period', key: 'period' }, { header: 'Orders', key: 'orders', width: 10 }, { header: 'Qty', key: 'qty', width: 10 },
       { header: 'MRP Value', key: 'mrp_total', numFmt: '#,##0.00' }, { header: 'Discount', key: 'discount', numFmt: '#,##0.00' }, { header: 'Net Sales', key: 'net', numFmt: '#,##0.00' }],
      rows, { period: 'TOTAL', ...totals });
  }
  res.json({ ...q, statuses: undefined, rows, totals });
}));

// ---------- SALES by product
router.get('/sales/products', ah(async (req, res) => {
  const q = params(req);
  const [rows] = await req.db.query(
    `SELECT oi.code, oi.name, COALESCE(SUM(oi.qty),0) AS qty, COALESCE(SUM(oi.mrp*oi.qty),0) AS mrp_total, COALESCE(SUM(oi.amount),0) AS net
     FROM orders o JOIN order_items oi ON oi.order_id=o.id
     WHERE o.created_at>=? AND o.created_at<DATE_ADD(?, INTERVAL 1 DAY) AND o.status IN (${q.statuses.join(',')})
     GROUP BY oi.code, oi.name ORDER BY net DESC`, [q.fromTs, q.toTs]);
  if (req.query.format === 'xlsx') {
    return sendXlsx(res, `product-sales-${q.from}-to-${q.to}.xlsx`, 'Product Sales',
      [{ header: 'Code', key: 'code' }, { header: 'Product', key: 'name', width: 36 }, { header: 'Qty Sold', key: 'qty' },
       { header: 'MRP Value', key: 'mrp_total', numFmt: '#,##0.00' }, { header: 'Net Sales', key: 'net', numFmt: '#,##0.00' }], rows);
  }
  res.json({ from: q.from, to: q.to, rows });
}));

// ---------- STOCK movement summary by period
router.get('/stock', ah(async (req, res) => {
  const q = params(req);
  const [rows] = await req.db.query(
    `SELECT ${expr(q.period, 'created_at')} AS period,
       COALESCE(SUM(CASE WHEN type='IN' THEN qty END),0) AS stock_in,
       COALESCE(SUM(CASE WHEN type='OUT' THEN -qty END),0) AS stock_out,
       COALESCE(SUM(CASE WHEN type='SET' THEN qty END),0) AS adjusted,
       COALESCE(SUM(CASE WHEN type='ORDER' THEN -qty END),0) AS sold,
       COALESCE(SUM(CASE WHEN type='CANCEL' THEN qty END),0) AS returned
     FROM stock_movements WHERE created_at>=? AND created_at<DATE_ADD(?, INTERVAL 1 DAY)
     GROUP BY period ORDER BY period`, [q.fromTs, q.toTs]);
  const totals = rows.reduce((t, r) => ({ stock_in: t.stock_in + Number(r.stock_in), stock_out: t.stock_out + Number(r.stock_out), adjusted: t.adjusted + Number(r.adjusted), sold: t.sold + Number(r.sold), returned: t.returned + Number(r.returned) }),
    { stock_in: 0, stock_out: 0, adjusted: 0, sold: 0, returned: 0 });
  if (req.query.format === 'xlsx') {
    return sendXlsx(res, `stock-${q.period}-${q.from}-to-${q.to}.xlsx`, 'Stock',
      [{ header: 'Period', key: 'period' }, { header: 'Stock In', key: 'stock_in' }, { header: 'Stock Out', key: 'stock_out' },
       { header: 'Adjusted (+/-)', key: 'adjusted' }, { header: 'Sold (orders)', key: 'sold' }, { header: 'Returned (cancel)', key: 'returned' }],
      rows, { period: 'TOTAL', ...totals });
  }
  res.json({ ...q, statuses: undefined, rows, totals });
}));

// ---------- STOCK per product: opening, in, out, sold, closing + value
router.get('/stock/products', ah(async (req, res) => {
  const q = params(req);
  const a = [q.fromTs, q.toTs];
  const inRange = 'm.created_at>=? AND m.created_at<DATE_ADD(?, INTERVAL 1 DAY)';
  const [rows] = await req.db.query(
    `SELECT p.code, p.name, p.price, p.stock AS current_stock,
       COALESCE(SUM(CASE WHEN ${inRange} THEN m.qty END),0) AS net_change,
       COALESCE(SUM(CASE WHEN ${inRange} AND m.type='IN' THEN m.qty END),0) AS stock_in,
       COALESCE(SUM(CASE WHEN ${inRange} AND m.type='OUT' THEN -m.qty END),0) AS stock_out,
       COALESCE(SUM(CASE WHEN ${inRange} AND m.type='ORDER' THEN -m.qty END),0) AS sold,
       COALESCE(SUM(CASE WHEN ${inRange} AND m.type='CANCEL' THEN m.qty END),0) AS returned,
       COALESCE(SUM(CASE WHEN ${inRange} AND m.type='SET' THEN m.qty END),0) AS adjusted,
       COALESCE(SUM(CASE WHEN m.created_at>=DATE_ADD(?, INTERVAL 1 DAY) THEN m.qty END),0) AS after_range
     FROM products p LEFT JOIN stock_movements m ON m.product_id=p.id
     GROUP BY p.id, p.code, p.name, p.price, p.stock ORDER BY p.code`,
    [...a, ...a, ...a, ...a, ...a, ...a, q.toTs]);
  rows.forEach((r) => {
    r.closing = r.current_stock - r.after_range;
    r.opening = r.closing - r.net_change;
    r.value = r.current_stock * r.price;
  });
  if (req.query.format === 'xlsx') {
    return sendXlsx(res, `stock-products-${q.from}-to-${q.to}.xlsx`, 'Product Stock',
      [{ header: 'Code', key: 'code' }, { header: 'Product', key: 'name', width: 36 }, { header: 'Opening', key: 'opening' }, { header: 'Stock In', key: 'stock_in' },
       { header: 'Stock Out', key: 'stock_out' }, { header: 'Adjusted', key: 'adjusted' }, { header: 'Sold', key: 'sold' }, { header: 'Returned', key: 'returned' },
       { header: 'Closing', key: 'closing' }, { header: 'Current Stock', key: 'current_stock' }, { header: 'Rate', key: 'price', numFmt: '#,##0.00' }, { header: 'Stock Value', key: 'value', numFmt: '#,##0.00' }], rows);
  }
  res.json({ from: q.from, to: q.to, rows });
}));

module.exports = router;

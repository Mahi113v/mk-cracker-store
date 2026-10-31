const QRCode = require('qrcode');

const BASE_SELECT = `SELECT p.id,p.code,p.name,p.pack,p.mrp,p.discount_percent,p.price,p.stock,p.low_stock_level,
  p.description,p.is_active,p.category_id,p.brand_id,c.name AS category,b.name AS brand
  FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id`;

async function attachImages(db, list) {
  if (!list.length) return list;
  const [imgs] = await db.query(
    'SELECT id,product_id,path FROM product_images WHERE product_id IN (?) ORDER BY sort_order,id',
    [list.map((p) => p.id)]
  );
  const map = {};
  imgs.forEach((i) => (map[i.product_id] = map[i.product_id] || []).push({ id: i.id, path: i.path }));
  list.forEach((p) => {
    p.images = map[p.id] || [];
    p.image = p.images[0] ? p.images[0].path : null;
  });
  return list;
}

async function addMovement(conn, { product_id, type, qty, balance, reason, user_id }) {
  await conn.query(
    'INSERT INTO stock_movements (product_id,type,qty,balance,reason,user_id) VALUES (?,?,?,?,?,?)',
    [product_id, type, qty, balance, reason || null, user_id || null]
  );
}

async function restoreStock(conn, orderId, userId, reason) {
  const [items] = await conn.query('SELECT product_id,qty FROM order_items WHERE order_id=? AND product_id IS NOT NULL', [orderId]);
  for (const it of items) {
    await conn.query('UPDATE products SET stock=stock+? WHERE id=?', [it.qty, it.product_id]);
    const [[p]] = await conn.query('SELECT stock FROM products WHERE id=?', [it.product_id]);
    await addMovement(conn, { product_id: it.product_id, type: 'CANCEL', qty: it.qty, balance: p.stock, reason, user_id: userId });
  }
}

async function getSettings(db) {
  const [rows] = await db.query('SELECT k,v FROM settings');
  return Object.fromEntries(rows.map((r) => [r.k, r.v]));
}

async function getOrderDetail(db, id) {
  const [[o]] = await db.query(
    `SELECT o.*,u.name AS user_name,u.email AS user_email,u.phone AS user_phone
     FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=?`, [id]);
  if (!o) return null;
  const [items] = await db.query(
    `SELECT oi.*,(SELECT path FROM product_images WHERE product_id=oi.product_id ORDER BY sort_order,id LIMIT 1) AS image
     FROM order_items oi WHERE order_id=?`, [id]);
  o.items = items;
  return o;
}

async function buildPayment(db, order) {
  const s = await getSettings(db);
  if (!s.upi_id) return { upi_id: '', upi_name: '', qr: null };
  const link = `upi://pay?pa=${s.upi_id}&pn=${encodeURIComponent(s.upi_name || s.store_name || 'Store')}&am=${order.total}&cu=INR&tn=${encodeURIComponent(order.order_no)}`;
  const qr = await QRCode.toDataURL(link, { width: 320, margin: 1 });
  return { upi_id: s.upi_id, upi_name: s.upi_name, qr, link };
}

const calcPrice = (mrp, disc) => Math.round((Number(mrp) * (100 - Number(disc))) / 100);

module.exports = { BASE_SELECT, attachImages, addMovement, restoreStock, getSettings, getOrderDetail, buildPayment, calcPrice };

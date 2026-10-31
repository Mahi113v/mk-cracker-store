const router = require('express').Router();
const { auth, canDiscount, ah, httpErr } = require('../middleware/auth');
const { uploader, urlPath, removeFile } = require('../middleware/upload');
const { addMovement, restoreStock, getOrderDetail, buildPayment, calcPrice } = require('../lib/helpers');

router.use(auth);
const proofUpload = uploader('payments');

// Place an enquiry (order). Stock is reserved immediately.
// Discount override (Quick Buy) is accepted ONLY from company admin / users with "discount.change".
router.post('/', ah(async (req, res) => {
  const { items, name, phone, address } = req.body;
  if (!Array.isArray(items) || !items.length) throw httpErr(400, 'Your cart is empty');
  if (!name || !phone || !address) throw httpErr(400, 'Name, phone and delivery address are required');
  const allowDisc = canDiscount(req.user);

  const wanted = new Map();
  items.forEach((i) => {
    const q = parseInt(i.qty, 10);
    if (!(q > 0)) return;
    const id = Number(i.product_id);
    const prev = wanted.get(id) || { qty: 0, disc: null };
    const d = allowDisc && i.discount_percent !== undefined && i.discount_percent !== null && i.discount_percent !== ''
      ? Math.min(100, Math.max(0, Number(i.discount_percent) || 0)) : null;
    wanted.set(id, { qty: prev.qty + q, disc: d });
  });
  if (!wanted.size) throw httpErr(400, 'Your cart is empty');

  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();
    const ids = [...wanted.keys()];
    const [prods] = await conn.query('SELECT * FROM products WHERE id IN (?) FOR UPDATE', [ids]);
    if (prods.length !== ids.length) throw httpErr(400, 'Some products are no longer available');
    let total = 0;
    const lines = [];
    for (const p of prods) {
      const w = wanted.get(p.id);
      if (!p.is_active) throw httpErr(400, `${p.name} is not available now`);
      if (p.stock < w.qty) throw httpErr(400, `Only ${p.stock} left for ${p.name}`);
      const disc = w.disc !== null ? w.disc : Number(p.discount_percent);
      const rate = w.disc !== null ? calcPrice(p.mrp, w.disc) : p.price;
      total += rate * w.qty;
      lines.push({ p, qty: w.qty, disc, rate });
    }
    const [r] = await conn.query(
      'INSERT INTO orders (order_no,user_id,total,name,phone,address) VALUES (?,?,?,?,?,?)',
      [`TMP-${Date.now()}`, req.user.id, total, name.trim(), phone.trim(), address.trim()]);
    const orderNo = `O-${1000 + r.insertId}`;
    await conn.query('UPDATE orders SET order_no=? WHERE id=?', [orderNo, r.insertId]);
    for (const { p, qty, disc, rate } of lines) {
      await conn.query(
        'INSERT INTO order_items (order_id,product_id,code,name,pack,mrp,discount_percent,price,qty,amount) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [r.insertId, p.id, p.code, p.name, p.pack, p.mrp, disc, rate, qty, rate * qty]);
      await conn.query('UPDATE products SET stock=stock-? WHERE id=?', [qty, p.id]);
      await addMovement(conn, { product_id: p.id, type: 'ORDER', qty: -qty, balance: p.stock - qty, reason: orderNo, user_id: req.user.id });
    }
    await conn.commit();
    res.status(201).json({ id: r.insertId, order_no: orderNo, total });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

router.get('/', ah(async (req, res) => {
  const [rows] = await req.db.query(
    `SELECT o.id,o.order_no,o.total,o.status,o.address,o.created_at,
     (SELECT COUNT(*) FROM order_items WHERE order_id=o.id) AS items_count
     FROM orders o WHERE o.user_id=? ORDER BY o.id DESC`, [req.user.id]);
  res.json(rows);
}));

const ownOrder = async (req) => {
  const o = await getOrderDetail(req.db, req.params.id);
  if (!o || o.user_id !== req.user.id) throw httpErr(404, 'Order not found');
  return o;
};

router.get('/:id', ah(async (req, res) => {
  const o = await ownOrder(req);
  if (o.status === 'unpaid' || o.status === 'pending_verification') o.payment = await buildPayment(req.db, o);
  res.json(o);
}));

router.post('/:id/payment', proofUpload.single('screenshot'), ah(async (req, res) => {
  const o = await ownOrder(req);
  if (!req.file) throw httpErr(400, 'Please choose the payment screenshot');
  if (!['unpaid', 'pending_verification'].includes(o.status)) throw httpErr(400, 'Payment cannot be updated for this order');
  removeFile(o.payment_proof);
  await req.db.query('UPDATE orders SET payment_proof=?,payment_note=?,status=? WHERE id=?',
    [urlPath(req, 'payments', req.file), (req.body.note || '').slice(0, 250) || null, 'pending_verification', o.id]);
  res.json({ message: 'Screenshot uploaded. We will verify your payment shortly.' });
}));

router.post('/:id/cancel', ah(async (req, res) => {
  const o = await ownOrder(req);
  if (o.status !== 'unpaid') throw httpErr(400, 'Only unpaid enquiries can be cancelled');
  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();
    await restoreStock(conn, o.id, req.user.id, `Cancelled ${o.order_no}`);
    await conn.query("UPDATE orders SET status='cancelled' WHERE id=?", [o.id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  res.json({ message: 'Enquiry cancelled' });
}));

module.exports = router;

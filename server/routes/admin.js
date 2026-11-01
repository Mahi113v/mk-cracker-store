const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { auth, perm, companyAdminOnly, ah, httpErr } = require('../middleware/auth');
const { feature } = require('../middleware/tenant');
const { master } = require('../config/db');
const { clearCompanyCache } = require('../middleware/tenant');
const { GROUPS, ALL, PRESETS } = require('../lib/permissions');
const { uploader, urlPath, removeFile } = require('../middleware/upload');
const { BASE_SELECT, attachImages, addMovement, restoreStock, getSettings, getOrderDetail } = require('../lib/helpers');
const wa = require('../lib/whatsapp');
const archive = require('../lib/archive');
const { guard } = require('../lib/maintenance');
const { sendXlsx } = require('../lib/exporter');
const { tenantPool } = require('../config/db');

router.use(auth);
router.use('/reports', perm('reports.view'), feature('reports'), require('./reports'));

const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const dupErr = (e, msg) => (e.code === 'ER_DUP_ENTRY' ? httpErr(409, msg) : e);

// ---------------------------------------------------------------- DASHBOARD
router.get('/stats', perm('dashboard.view'), ah(async (req, res) => {
  const one = async (sql) => (await req.db.query(sql))[0][0];
  const products = await one('SELECT COUNT(*) AS n FROM products');
  const low = await one('SELECT COUNT(*) AS n FROM products WHERE stock>0 AND stock<=low_stock_level');
  const out = await one('SELECT COUNT(*) AS n FROM products WHERE stock<=0');
  const users = await one("SELECT COUNT(*) AS n FROM users WHERE role='user'");
  const revenue = await one("SELECT COALESCE(SUM(total),0) AS n FROM orders WHERE status IN ('paid','delivered')");
  const today = await one("SELECT COALESCE(SUM(total),0) AS n FROM orders WHERE status IN ('paid','delivered') AND DATE(created_at)=CURDATE()");
  const month = await one("SELECT COALESCE(SUM(total),0) AS n FROM orders WHERE status IN ('paid','delivered') AND DATE_FORMAT(created_at,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')");
  const [byStatus] = await req.db.query('SELECT status,COUNT(*) AS n FROM orders GROUP BY status');
  const [recent] = await req.db.query(
    `SELECT o.id,o.order_no,o.total,o.status,o.created_at,u.name AS user_name
     FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 6`);
  res.json({
    products: products.n, low_stock: low.n, out_of_stock: out.n, users: users.n, revenue: revenue.n, today_sales: today.n, month_sales: month.n,
    orders: Object.fromEntries(byStatus.map((r) => [r.status, r.n])), recent,
  });
}));

// ---------------------------------------------------------------- PRODUCTS
const productUpload = uploader('products');

router.get('/products', perm('products.view', 'products.manage'), ah(async (req, res) => {
  const { search } = req.query;
  const where = [], args = [];
  if (search) { where.push('(p.name LIKE ? OR p.code LIKE ?)'); args.push(`%${search}%`, `%${search}%`); }
  const [rows] = await req.db.query(`${BASE_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.id DESC`, args);
  res.json(await attachImages(req.db, rows));
}));

router.post('/products', perm('products.manage'), productUpload.array('images', 8), ah(async (req, res) => {
  const b = req.body;
  if (!b.code || !b.name || !b.mrp) throw httpErr(400, 'Code, name and MRP are required');
  const stock = Math.max(0, parseInt(b.stock, 10) || 0);
  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO products (code,name,brand_id,category_id,pack,mrp,discount_percent,stock,low_stock_level,description,is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [b.code.trim(), b.name.trim(), b.brand_id || null, b.category_id || null, b.pack || null, num(b.mrp),
       num(b.discount_percent), stock, parseInt(b.low_stock_level, 10) || 10, b.description || null,
       b.is_active === '0' || b.is_active === 'false' ? 0 : 1]);
    const files = req.files || [];
    for (let i = 0; i < files.length; i++) {
      await conn.query('INSERT INTO product_images (product_id,path,sort_order) VALUES (?,?,?)', [r.insertId, urlPath(req, 'products', files[i]), i]);
    }
    if (stock > 0) await addMovement(conn, { product_id: r.insertId, type: 'IN', qty: stock, balance: stock, reason: 'Opening stock', user_id: req.user.id });
    await conn.commit();
    res.status(201).json({ id: r.insertId });
  } catch (e) { await conn.rollback(); throw dupErr(e, 'Product code already exists'); } finally { conn.release(); }
}));

router.put('/products/:id', perm('products.manage'), productUpload.array('images', 8), ah(async (req, res) => {
  const b = req.body, id = req.params.id;
  const [[exists]] = await req.db.query('SELECT id FROM products WHERE id=?', [id]);
  if (!exists) throw httpErr(404, 'Product not found');
  if (!b.code || !b.name || !b.mrp) throw httpErr(400, 'Code, name and MRP are required');
  try {
    await req.db.query(
      `UPDATE products SET code=?,name=?,brand_id=?,category_id=?,pack=?,mrp=?,discount_percent=?,low_stock_level=?,description=?,is_active=? WHERE id=?`,
      [b.code.trim(), b.name.trim(), b.brand_id || null, b.category_id || null, b.pack || null, num(b.mrp),
       num(b.discount_percent), parseInt(b.low_stock_level, 10) || 10, b.description || null,
       b.is_active === '0' || b.is_active === 'false' ? 0 : 1, id]);
  } catch (e) { throw dupErr(e, 'Product code already exists'); }
  const files = req.files || [];
  if (files.length) {
    const [[m]] = await req.db.query('SELECT COALESCE(MAX(sort_order),-1) AS m FROM product_images WHERE product_id=?', [id]);
    for (let i = 0; i < files.length; i++) {
      await req.db.query('INSERT INTO product_images (product_id,path,sort_order) VALUES (?,?,?)', [id, urlPath(req, 'products', files[i]), m.m + 1 + i]);
    }
  }
  res.json({ message: 'Product updated' });
}));

router.delete('/products/:id', perm('products.manage'), ah(async (req, res) => {
  const [imgs] = await req.db.query('SELECT path FROM product_images WHERE product_id=?', [req.params.id]);
  const [r] = await req.db.query('DELETE FROM products WHERE id=?', [req.params.id]);
  if (!r.affectedRows) throw httpErr(404, 'Product not found');
  imgs.forEach((i) => removeFile(i.path));
  res.json({ message: 'Product deleted' });
}));

router.delete('/products/:pid/images/:id', perm('products.manage'), ah(async (req, res) => {
  const [[img]] = await req.db.query('SELECT path FROM product_images WHERE id=? AND product_id=?', [req.params.id, req.params.pid]);
  if (!img) throw httpErr(404, 'Image not found');
  await req.db.query('DELETE FROM product_images WHERE id=?', [req.params.id]);
  removeFile(img.path);
  res.json({ message: 'Image removed' });
}));

router.put('/products/:pid/images/:id/main', perm('products.manage'), ah(async (req, res) => {
  await req.db.query('UPDATE product_images SET sort_order=sort_order+1 WHERE product_id=?', [req.params.pid]);
  await req.db.query('UPDATE product_images SET sort_order=0 WHERE id=? AND product_id=?', [req.params.id, req.params.pid]);
  res.json({ message: 'Main image updated' });
}));

// ---------------------------------------------------------------- CATEGORIES / BRANDS
const catUpload = uploader('categories');

router.post('/categories', perm('categories.manage'), catUpload.single('image'), ah(async (req, res) => {
  if (!req.body.name) throw httpErr(400, 'Category name is required');
  try {
    const [r] = await req.db.query('INSERT INTO categories (name,image) VALUES (?,?)',
      [req.body.name.trim(), req.file ? urlPath(req, 'categories', req.file) : null]);
    res.status(201).json({ id: r.insertId });
  } catch (e) { throw dupErr(e, 'Category already exists'); }
}));

router.put('/categories/:id', perm('categories.manage'), catUpload.single('image'), ah(async (req, res) => {
  const [[c]] = await req.db.query('SELECT * FROM categories WHERE id=?', [req.params.id]);
  if (!c) throw httpErr(404, 'Category not found');
  let image = c.image;
  if (req.file) { removeFile(c.image); image = urlPath(req, 'categories', req.file); }
  else if (req.body.remove_image === '1') { removeFile(c.image); image = null; }
  try { await req.db.query('UPDATE categories SET name=?,image=? WHERE id=?', [(req.body.name || c.name).trim(), image, c.id]); }
  catch (e) { throw dupErr(e, 'Category already exists'); }
  res.json({ message: 'Category updated' });
}));

router.delete('/categories/:id', perm('categories.manage'), ah(async (req, res) => {
  const [[c]] = await req.db.query('SELECT image FROM categories WHERE id=?', [req.params.id]);
  if (!c) throw httpErr(404, 'Category not found');
  await req.db.query('DELETE FROM categories WHERE id=?', [req.params.id]);
  removeFile(c.image);
  res.json({ message: 'Category deleted' });
}));

router.post('/brands', perm('categories.manage'), ah(async (req, res) => {
  if (!req.body.name) throw httpErr(400, 'Brand name is required');
  try {
    const [r] = await req.db.query('INSERT INTO brands (name) VALUES (?)', [req.body.name.trim()]);
    res.status(201).json({ id: r.insertId });
  } catch (e) { throw dupErr(e, 'Brand already exists'); }
}));
router.put('/brands/:id', perm('categories.manage'), ah(async (req, res) => {
  try { await req.db.query('UPDATE brands SET name=? WHERE id=?', [String(req.body.name || '').trim(), req.params.id]); }
  catch (e) { throw dupErr(e, 'Brand already exists'); }
  res.json({ message: 'Brand updated' });
}));
router.delete('/brands/:id', perm('categories.manage'), ah(async (req, res) => {
  await req.db.query('DELETE FROM brands WHERE id=?', [req.params.id]);
  res.json({ message: 'Brand deleted' });
}));

// ---------------------------------------------------------------- STOCK
router.get('/stock', perm('stock.view', 'stock.manage'), ah(async (req, res) => {
  const { search, filter } = req.query;
  const where = [], args = [];
  if (search) { where.push('(p.name LIKE ? OR p.code LIKE ?)'); args.push(`%${search}%`, `%${search}%`); }
  if (filter === 'out') where.push('p.stock<=0');
  if (filter === 'low') where.push('(p.stock>0 AND p.stock<=p.low_stock_level)');
  const [rows] = await req.db.query(`${BASE_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.stock ASC, p.name`, args);
  res.json(await attachImages(req.db, rows));
}));

router.post('/stock/adjust', perm('stock.manage'), ah(async (req, res) => {
  const { product_id, type, reason } = req.body;
  const qty = parseInt(req.body.qty, 10);
  if (!['IN', 'OUT', 'SET'].includes(type)) throw httpErr(400, 'Choose Stock In, Stock Out or Set Stock');
  if (!Number.isInteger(qty) || qty < 0) throw httpErr(400, 'Enter a valid quantity');
  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();
    const [[p]] = await conn.query('SELECT id,stock FROM products WHERE id=? FOR UPDATE', [product_id]);
    if (!p) throw httpErr(404, 'Product not found');
    const next = type === 'IN' ? p.stock + qty : type === 'OUT' ? p.stock - qty : qty;
    if (next < 0) throw httpErr(400, `Cannot remove ${qty}. Only ${p.stock} in stock`);
    await conn.query('UPDATE products SET stock=? WHERE id=?', [next, p.id]);
    await addMovement(conn, { product_id: p.id, type, qty: next - p.stock, balance: next, reason: reason || null, user_id: req.user.id });
    await conn.commit();
    res.json({ stock: next });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

router.get('/stock/movements', perm('stock.history'), ah(async (req, res) => {
  const where = [], args = [];
  if (req.query.product_id) { where.push('m.product_id=?'); args.push(req.query.product_id); }
  if (req.query.type) { where.push('m.type=?'); args.push(req.query.type); }
  if (req.query.from) { where.push('m.created_at>=?'); args.push(`${req.query.from} 00:00:00`); }
  if (req.query.to) { where.push('m.created_at<DATE_ADD(?, INTERVAL 1 DAY)'); args.push(`${req.query.to} 00:00:00`); }
  const [rows] = await req.db.query(
    `SELECT m.*,p.name,p.code,u.name AS user_name FROM stock_movements m
     JOIN products p ON p.id=m.product_id LEFT JOIN users u ON u.id=m.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.id DESC LIMIT 1000`, args);
  res.json(rows);
}));

// ---------------------------------------------------------------- ORDERS
router.get('/orders', perm('orders.view', 'orders.manage'), ah(async (req, res) => {
  const { status, search } = req.query;
  const where = [], args = [];
  if (status) { where.push('o.status=?'); args.push(status); }
  if (search) { where.push('(o.order_no LIKE ? OR u.name LIKE ? OR o.phone LIKE ?)'); args.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  const [rows] = await req.db.query(
    `SELECT o.id,o.order_no,o.total,o.status,o.phone,o.payment_proof,o.created_at,u.name AS user_name,
     (SELECT COUNT(*) FROM order_items WHERE order_id=o.id) AS items_count
     FROM orders o JOIN users u ON u.id=o.user_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.id DESC`, args);
  res.json(rows);
}));

router.get('/orders/:id', perm('orders.view', 'orders.manage'), ah(async (req, res) => {
  const o = await getOrderDetail(req.db, req.params.id);
  if (!o) throw httpErr(404, 'Order not found');
  try {
    const [log] = await req.db.query('SELECT id,event,status,error,created_at FROM whatsapp_log WHERE order_id=? ORDER BY id DESC LIMIT 20', [o.id]);
    o.wa_log = log;
  } catch { o.wa_log = []; }
  res.json(o);
}));

router.put('/orders/:id/status', perm('orders.manage'), guard, ah(async (req, res) => {
  const { status, admin_note } = req.body;
  if (!['unpaid', 'pending_verification', 'paid', 'delivered', 'cancelled'].includes(status)) throw httpErr(400, 'Invalid status');
  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();
    const [[o]] = await conn.query('SELECT * FROM orders WHERE id=? FOR UPDATE', [req.params.id]);
    if (!o) throw httpErr(404, 'Order not found');
    if (o.status === 'cancelled') throw httpErr(400, 'Cancelled orders cannot be changed');
    if (status === 'cancelled') await restoreStock(conn, o.id, req.user.id, `Cancelled ${o.order_no}`);
    await conn.query('UPDATE orders SET status=?,admin_note=? WHERE id=?', [status, admin_note || o.admin_note, o.id]);
    await conn.commit();
    res.json({ message: 'Order updated' });
    if (o.status !== status) {
      const event = { paid: 'paid', delivered: 'delivered', cancelled: 'cancelled' }[status];
      if (event) wa.fire(req.company, req.db, o.id, event);
    }
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

// Send a WhatsApp message for this order (admin button): body.event = created | pending_verification | paid | delivered | cancelled | reminder_12h | reminder_1h
router.post('/orders/:id/whatsapp', perm('orders.manage'), ah(async (req, res) => {
  if (!Number(req.company.whatsapp_enabled)) throw httpErr(400, 'WhatsApp messages are not enabled for this company. Ask the platform admin to enable it.');
  const [[o]] = await req.db.query('SELECT id,status FROM orders WHERE id=?', [req.params.id]);
  if (!o) throw httpErr(404, 'Order not found');
  const byStatus = { unpaid: 'created', pending_verification: 'pending_verification', paid: 'paid', delivered: 'delivered', cancelled: 'cancelled' }[o.status];
  const event = wa.EVENT_KEYS.includes(req.body.event) ? req.body.event : byStatus;
  const r = await wa.notifyOrder(req.company, req.db, o.id, event, { force: true });
  res.json({ status: r.status, error: r.error || null });
}));

// ---------------------------------------------------------------- USERS & ACCESS CONTROL
const isCA = (req) => req.user.role === 'company_admin';
const cleanPerms = (list) => (Array.isArray(list) ? list.filter((p) => ALL.includes(p)) : []);
const roleOf = (r) => (['company_admin', 'staff', 'user'].includes(r) ? r : 'user');

router.get('/permissions', perm('users.manage'), (req, res) => res.json({ groups: GROUPS, presets: PRESETS }));

router.get('/users', perm('users.manage'), ah(async (req, res) => {
  const args = [];
  let where = '';
  if (req.query.search) {
    where = 'WHERE (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
    args.push(`%${req.query.search}%`, `%${req.query.search}%`, `%${req.query.search}%`);
  }
  const [rows] = await req.db.query(
    `SELECT u.id,u.name,u.email,u.phone,u.role,u.status,u.permissions,u.created_at,
     (SELECT COUNT(*) FROM orders WHERE user_id=u.id) AS orders_count
     FROM users u ${where} ORDER BY FIELD(u.role,'company_admin','staff','user'), u.id DESC`, args);
  rows.forEach((u) => { try { u.permissions = JSON.parse(u.permissions || '[]'); } catch { u.permissions = []; } });
  res.json(rows);
}));

router.post('/users', perm('users.manage'), ah(async (req, res) => {
  const { name, email, phone, password } = req.body;
  const role = roleOf(req.body.role);
  if (!name || !email || !password) throw httpErr(400, 'Name, email and password are required');
  if (password.length < 6) throw httpErr(400, 'Password must be at least 6 characters');
  if (role !== 'user' && !isCA(req)) throw httpErr(403, 'Only the company admin can create staff or admin users');
  try {
    const [r] = await req.db.query('INSERT INTO users (name,email,phone,password,role,permissions) VALUES (?,?,?,?,?,?)',
      [name.trim(), email.toLowerCase().trim(), phone || null, await bcrypt.hash(password, 10), role,
       role === 'staff' ? JSON.stringify(cleanPerms(req.body.permissions)) : null]);
    res.status(201).json({ id: r.insertId });
  } catch (e) { throw dupErr(e, 'This email is already registered'); }
}));

router.put('/users/:id', perm('users.manage'), ah(async (req, res) => {
  const [[target]] = await req.db.query('SELECT id,role FROM users WHERE id=?', [req.params.id]);
  if (!target) throw httpErr(404, 'User not found');
  const role = roleOf(req.body.role);
  const status = req.body.status === 'blocked' ? 'blocked' : 'active';
  if ((target.role !== 'user' || role !== 'user') && !isCA(req)) throw httpErr(403, 'Only the company admin can change staff or admin users');
  if (Number(req.params.id) === req.user.id && (role !== 'company_admin' || status !== 'active'))
    throw httpErr(400, 'You cannot block or demote your own account');
  await req.db.query('UPDATE users SET name=?,phone=?,role=?,status=?,permissions=? WHERE id=?',
    [req.body.name, req.body.phone || null, role, status, role === 'staff' ? JSON.stringify(cleanPerms(req.body.permissions)) : null, req.params.id]);
  res.json({ message: 'User updated' });
}));

router.put('/users/:id/password', perm('users.manage'), ah(async (req, res) => {
  if (!req.body.password || req.body.password.length < 6) throw httpErr(400, 'Password must be at least 6 characters');
  const [[target]] = await req.db.query('SELECT role FROM users WHERE id=?', [req.params.id]);
  if (!target) throw httpErr(404, 'User not found');
  if (target.role !== 'user' && !isCA(req)) throw httpErr(403, 'Only the company admin can change this password');
  await req.db.query('UPDATE users SET password=? WHERE id=?', [await bcrypt.hash(req.body.password, 10), req.params.id]);
  res.json({ message: 'Password changed' });
}));

router.delete('/users/:id', perm('users.manage'), ah(async (req, res) => {
  if (Number(req.params.id) === req.user.id) throw httpErr(400, 'You cannot delete your own account');
  const [[target]] = await req.db.query('SELECT role FROM users WHERE id=?', [req.params.id]);
  if (!target) throw httpErr(404, 'User not found');
  if (target.role !== 'user' && !isCA(req)) throw httpErr(403, 'Only the company admin can delete this user');
  const [[c]] = await req.db.query('SELECT COUNT(*) AS n FROM orders WHERE user_id=?', [req.params.id]);
  if (c.n > 0) throw httpErr(400, 'This user has orders. Block the user instead of deleting.');
  await req.db.query('DELETE FROM users WHERE id=?', [req.params.id]);
  res.json({ message: 'User deleted' });
}));

// Company design (default | normal | current) + brand colour - company admin only
router.put('/design', companyAdminOnly, ah(async (req, res) => {
  const { design, brand_color } = req.body;
  if (!['default', 'normal', 'current'].includes(design)) throw httpErr(400, 'Invalid design');
  const color = /^#[0-9a-fA-F]{6}$/.test(brand_color || '') ? brand_color : req.company.brand_color;
  await master.query('UPDATE companies SET design=?,brand_color=? WHERE id=?', [design, color, req.company.id]);
  clearCompanyCache();
  res.json({ message: 'Design updated', design, brand_color: color });
}));

// ---------------------------------------------------------------- YEAR-END ARCHIVES (old data)
// Close the year: full copy of this company's database (kept for viewing), then the orders table is emptied.
router.get('/archives', perm('reports.view', 'orders.view', 'settings.manage'), ah(async (req, res) => {
  const [rows] = await master.query('SELECT id,label,orders_count,sales_total,first_order_at,last_order_at,created_by,created_at FROM year_archives WHERE company_id=? ORDER BY id DESC', [req.company.id]);
  res.json(rows);
}));

router.get('/archives/preview', companyAdminOnly, ah(async (req, res) => {
  res.json({ ...(await archive.preview(req.db)), db_name: req.company.db_name });
}));

router.post('/archives/close', companyAdminOnly, ah(async (req, res) => {
  const [[me]] = await req.db.query('SELECT name,password FROM users WHERE id=?', [req.user.id]);
  if (!(await bcrypt.compare(String(req.body.password || ''), me.password))) throw httpErr(401, 'Your password is not correct');
  if (String(req.body.confirm || '').trim().toUpperCase() !== 'RESET') throw httpErr(400, 'Type RESET to confirm');
  const done = await archive.closeYear({ company: req.company, userName: me.name, label: req.body.label });
  res.status(201).json({ message: `Year ${done.label} archived and orders cleared`, ...done });
}));

const archiveOf = async (req) => {
  const [[a]] = await master.query('SELECT * FROM year_archives WHERE id=? AND company_id=?', [req.params.aid, req.company.id]);
  if (!a) throw httpErr(404, 'Archive not found');
  return { a, db: tenantPool(a.db_name) };
};
const archPerm = perm('reports.view', 'orders.view');

router.get('/archives/:aid/summary', archPerm, ah(async (req, res) => {
  const { a, db } = await archiveOf(req);
  const [months] = await db.query(
    `SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, COUNT(*) AS orders, COALESCE(SUM(total),0) AS sales
     FROM orders WHERE status IN ('paid','delivered') GROUP BY month ORDER BY month`);
  const [status] = await db.query('SELECT status,COUNT(*) AS n FROM orders GROUP BY status');
  res.json({ archive: a, months, status: Object.fromEntries(status.map((r) => [r.status, r.n])) });
}));

router.get('/archives/:aid/orders', archPerm, ah(async (req, res) => {
  const { a, db } = await archiveOf(req);
  const where = [], args = [];
  if (req.query.status) { where.push('o.status=?'); args.push(req.query.status); }
  if (req.query.search) { where.push('(o.order_no LIKE ? OR u.name LIKE ? OR o.phone LIKE ?)'); args.push(`%${req.query.search}%`, `%${req.query.search}%`, `%${req.query.search}%`); }
  const [rows] = await db.query(
    `SELECT o.id,o.order_no,o.total,o.status,o.phone,o.created_at,u.name AS user_name,
     (SELECT COUNT(*) FROM order_items WHERE order_id=o.id) AS items_count
     FROM orders o JOIN users u ON u.id=o.user_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.id DESC LIMIT 2000`, args);
  if (req.query.format === 'xlsx') {
    return sendXlsx(res, `orders-${a.label}.xlsx`, `Orders ${a.label}`,
      [{ header: 'Order', key: 'order_no' }, { header: 'Customer', key: 'user_name', width: 26 }, { header: 'Phone', key: 'phone', width: 14 },
        { header: 'Date', key: 'created_at', width: 20 }, { header: 'Items', key: 'items_count', width: 8 }, { header: 'Total', key: 'total', numFmt: '#,##0.00' }, { header: 'Status', key: 'status', width: 20 }],
      rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toLocaleString('en-IN') })));
  }
  res.json(rows);
}));

router.get('/archives/:aid/orders/:id', archPerm, ah(async (req, res) => {
  const { db } = await archiveOf(req);
  const o = await getOrderDetail(db, req.params.id);
  if (!o) throw httpErr(404, 'Order not found');
  res.json(o);
}));

// ---------------------------------------------------------------- SETTINGS
const bannerUpload = uploader('banners');
const SETTING_KEYS = [ 'store_name', 'phone', 'announcement', 'upi_id', 'upi_name', 'tagline', 'address', 'phone2',
  'email', 'hours', 'whatsapp', 'facebook', 'instagram', 'youtube', ];

router.get('/settings', perm('settings.manage'), ah(async (req, res) => res.json(await getSettings(req.db))));

router.put('/settings', perm('settings.manage'), bannerUpload.single('banner'), ah(async (req, res) => {
  const current = await getSettings(req.db);
  for (const k of SETTING_KEYS) {
    if (req.body[k] !== undefined) {
      await req.db.query('INSERT INTO settings (k,v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)', [k, String(req.body[k]).trim()]);
    }
  }
  if (req.file) {
    removeFile(current.banner_image);
    await req.db.query('INSERT INTO settings (k,v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)', ['banner_image', urlPath(req, 'banners', req.file)]);
  } else if (req.body.remove_banner === '1') {
    removeFile(current.banner_image);
    await req.db.query("DELETE FROM settings WHERE k='banner_image'");
  }
  res.json({ message: 'Settings saved' });
}));

module.exports = router;

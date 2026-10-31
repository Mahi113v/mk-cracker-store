// Platform (product owner) admin: create companies, create their database, choose design, manage access
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { master, tenantPool, dropTenantPool } = require('../config/db');
const { platformAuth, ah, httpErr } = require('../middleware/auth');
const { clearCompanyCache } = require('../middleware/tenant');
const { provisionCompany, DESIGNS, ALL_FEATURES } = require('../lib/provision');

router.post('/login', ah(async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await master.query('SELECT * FROM platform_users WHERE email=?', [String(email || '').toLowerCase().trim()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(password || ''), u.password))) throw httpErr(401, 'Invalid email or password');
  if (u.status !== 'active') throw httpErr(403, 'Account blocked');
  res.json({ token: jwt.sign({ t: 'p', id: u.id }, process.env.JWT_SECRET, { expiresIn: '7d' }), user: { id: u.id, name: u.name, email: u.email, role: 'platform' } });
}));

router.use(platformAuth);

router.get('/me', (req, res) => res.json({ user: { ...req.platform, role: 'platform' } }));

router.put('/me/password', ah(async (req, res) => {
  if (!req.body.password || req.body.password.length < 6) throw httpErr(400, 'Password must be at least 6 characters');
  await master.query('UPDATE platform_users SET password=? WHERE id=?', [await bcrypt.hash(req.body.password, 10), req.platform.id]);
  res.json({ message: 'Password changed' });
}));

router.get('/meta', (req, res) => res.json({ designs: DESIGNS, features: ALL_FEATURES }));

const parse = (c) => { try { c.features = JSON.parse(c.features || '[]'); } catch { c.features = []; } return c; };

router.get('/companies', ah(async (req, res) => {
  const [rows] = await master.query('SELECT * FROM companies ORDER BY id DESC');
  const list = await Promise.all(rows.map(async (c) => {
    parse(c);
    c.counts = null;
    if (c.status !== 'provisioning') {
      try {
        const [[r]] = await tenantPool(c.db_name).query(
          `SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM products) AS products,(SELECT COUNT(*) FROM orders) AS orders`);
        c.counts = r;
      } catch { c.counts = null; }
    }
    return c;
  }));
  res.json(list);
}));

router.post('/companies', ah(async (req, res) => {
  const company = await provisionCompany(req.body);
  clearCompanyCache();
  res.status(201).json(parse(company));
}));

router.put('/companies/:id', ah(async (req, res) => {
  const { name, design, brand_color, status } = req.body;
  const features = Array.isArray(req.body.features) ? req.body.features.filter((f) => ALL_FEATURES.includes(f)) : null;
  const [[c]] = await master.query('SELECT * FROM companies WHERE id=?', [req.params.id]);
  if (!c) throw httpErr(404, 'Company not found');
  await master.query('UPDATE companies SET name=?,design=?,brand_color=?,features=?,status=? WHERE id=?', [
    (name || c.name).trim(),
    DESIGNS.includes(design) ? design : c.design,
    /^#[0-9a-fA-F]{6}$/.test(brand_color || '') ? brand_color : c.brand_color,
    features ? JSON.stringify(features) : c.features,
    ['active', 'blocked'].includes(status) ? status : c.status,
    c.id]);
  clearCompanyCache();
  res.json({ message: 'Company updated' });
}));

// Reset the password of the company admin (first company_admin user of that company's DB)
router.put('/companies/:id/admin-password', ah(async (req, res) => {
  if (!req.body.password || req.body.password.length < 6) throw httpErr(400, 'Password must be at least 6 characters');
  const [[c]] = await master.query('SELECT * FROM companies WHERE id=?', [req.params.id]);
  if (!c) throw httpErr(404, 'Company not found');
  const [r] = await tenantPool(c.db_name).query("UPDATE users SET password=? WHERE role='company_admin' ORDER BY id LIMIT 1", [await bcrypt.hash(req.body.password, 10)]);
  res.json({ message: r.affectedRows ? 'Company admin password changed' : 'No company admin found' });
}));

// Open the company panel as its company admin (support / demo)
router.post('/companies/:id/impersonate', ah(async (req, res) => {
  const [[c]] = await master.query('SELECT * FROM companies WHERE id=? AND status=\'active\'', [req.params.id]);
  if (!c) throw httpErr(404, 'Company not found or not active');
  const [[u]] = await tenantPool(c.db_name).query("SELECT id,name,email FROM users WHERE role='company_admin' AND status='active' ORDER BY id LIMIT 1");
  if (!u) throw httpErr(404, 'This company has no active admin');
  const token = jwt.sign({ t: 'u', id: u.id, cid: c.id, imp: true }, process.env.JWT_SECRET, { expiresIn: '3h' });
  res.json({ token, code: c.code });
}));

module.exports = router;

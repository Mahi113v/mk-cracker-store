// Platform (product owner) admin: create companies, create their database, choose design, manage access
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { master, tenantPool, dropTenantPool } = require('../config/db');
const { platformAuth, ah, httpErr } = require('../middleware/auth');
const { clearCompanyCache } = require('../middleware/tenant');
const { provisionCompany, DESIGNS, ALL_FEATURES } = require('../lib/provision');
const wa = require('../lib/whatsapp');
const fs = require('fs');
const path = require('path');
const { imageFields, discard } = require('../lib/imageUpload');
const { UPLOAD_ROOT } = require('../middleware/upload');

const PLATFORM_DIR = path.join(UPLOAD_ROOT, 'platform');
const PLATFORM_URL = '/uploads/platform/';
const removeOld = (p) => { if (p && String(p).startsWith(PLATFORM_URL)) fs.unlink(path.join(PLATFORM_DIR, path.basename(p)), () => {}); };

async function getBranding() {
  const [rows] = await master.query('SELECT k,v FROM platform_settings');
  const s = Object.fromEntries(rows.map((r) => [r.k, r.v]));
  return { name: s.name || 'MK Platform', logo: s.logo || null, icon: s.icon || null, brand_color: /^#[0-9a-fA-F]{6}$/.test(s.brand_color || '') ? s.brand_color : '#e11d48' };
}
const setSetting = (k, v) => master.query('INSERT INTO platform_settings (k,v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=VALUES(v)', [k, v]);

router.post('/login', ah(async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await master.query('SELECT * FROM platform_users WHERE email=?', [String(email || '').toLowerCase().trim()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(password || ''), u.password))) throw httpErr(401, 'Invalid email or password');
  if (u.status !== 'active') throw httpErr(403, 'Account blocked');
  res.json({ token: jwt.sign({ t: 'p', id: u.id }, process.env.JWT_SECRET, { expiresIn: '7d' }), user: { id: u.id, name: u.name, email: u.email, role: 'platform' } });
}));

// Public: platform name / logo / icon (login page, favicon)
router.get('/branding', ah(async (req, res) => res.json(await getBranding())));

router.use(platformAuth);

router.get('/me', (req, res) => res.json({ user: { ...req.platform, role: 'platform' } }));

router.put('/me/password', ah(async (req, res) => {
  if (!req.body.password || req.body.password.length < 6) throw httpErr(400, 'Password must be at least 6 characters');
  await master.query('UPDATE platform_users SET password=? WHERE id=?', [await bcrypt.hash(req.body.password, 10), req.platform.id]);
  res.json({ message: 'Password changed' });
}));

router.get('/meta', (req, res) => res.json({
  designs: DESIGNS, features: ALL_FEATURES,
  wa_events: wa.EVENTS.map(([key, label]) => ({ key, label })), wa_provider: wa.providerInfo(),
}));

// ---------------------------------------------------------------- BRANDING (platform name, logo, icon)
const brandingUpload = imageFields({ dir: PLATFORM_DIR, fields: ['logo', 'icon'] });
router.put('/branding',
  (req, res, next) => brandingUpload(req, res, (err) => { if (err) { discard(req); return next(err); } return next(); }),
  ah(async (req, res) => {
    try {
      const cur = await getBranding();
      const b = req.body || {};
      if (b.name !== undefined) await setSetting('name', String(b.name).trim().slice(0, 60) || 'MK Platform');
      if (b.brand_color !== undefined && /^#[0-9a-fA-F]{6}$/.test(b.brand_color)) await setSetting('brand_color', b.brand_color);
      for (const k of ['logo', 'icon']) {
        const f = req.files && req.files[k] && req.files[k][0];
        if (f) { await setSetting(k, PLATFORM_URL + f.filename); removeOld(cur[k]); }
        else if (b[`remove_${k}`] === '1') { await master.query('DELETE FROM platform_settings WHERE k=?', [k]); removeOld(cur[k]); }
      }
    } catch (e) { discard(req); throw e; }
    res.json(await getBranding());
  }));

// ---------------------------------------------------------------- SUPER ADMINS (create / update / password / block / delete)
const admPub = 'id,name,email,status,created_at';
router.get('/admins', ah(async (req, res) => {
  const [rows] = await master.query(`SELECT ${admPub} FROM platform_users ORDER BY id`);
  res.json(rows);
}));

router.post('/admins', ah(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) throw httpErr(400, 'Name, email and password are required');
  if (String(password).length < 6) throw httpErr(400, 'Password must be at least 6 characters');
  try {
    const [r] = await master.query('INSERT INTO platform_users (name,email,password) VALUES (?,?,?)',
      [String(name).trim(), String(email).toLowerCase().trim(), await bcrypt.hash(String(password), 10)]);
    res.status(201).json({ id: r.insertId });
  } catch (e) { throw e.code === 'ER_DUP_ENTRY' ? httpErr(409, 'This email is already used by another super admin') : e; }
}));

router.put('/admins/:id', ah(async (req, res) => {
  const [[u]] = await master.query('SELECT * FROM platform_users WHERE id=?', [req.params.id]);
  if (!u) throw httpErr(404, 'Super admin not found');
  const status = req.body.status === 'blocked' ? 'blocked' : 'active';
  if (u.id === req.platform.id && status === 'blocked') throw httpErr(400, 'You cannot block your own account');
  try {
    await master.query('UPDATE platform_users SET name=?,email=?,status=? WHERE id=?', [
      String(req.body.name || u.name).trim(), String(req.body.email || u.email).toLowerCase().trim(), status, u.id]);
  } catch (e) { throw e.code === 'ER_DUP_ENTRY' ? httpErr(409, 'This email is already used by another super admin') : e; }
  res.json({ message: 'Super admin updated' });
}));

router.put('/admins/:id/password', ah(async (req, res) => {
  if (!req.body.password || String(req.body.password).length < 6) throw httpErr(400, 'Password must be at least 6 characters');
  const [r] = await master.query('UPDATE platform_users SET password=? WHERE id=?', [await bcrypt.hash(String(req.body.password), 10), req.params.id]);
  if (!r.affectedRows) throw httpErr(404, 'Super admin not found');
  res.json({ message: 'Password changed' });
}));

router.delete('/admins/:id', ah(async (req, res) => {
  if (Number(req.params.id) === req.platform.id) throw httpErr(400, 'You cannot delete your own account');
  const [[c]] = await master.query("SELECT COUNT(*) AS n FROM platform_users WHERE status='active'");
  if (c.n <= 1) throw httpErr(400, 'At least one active super admin must remain');
  const [r] = await master.query('DELETE FROM platform_users WHERE id=?', [req.params.id]);
  if (!r.affectedRows) throw httpErr(404, 'Super admin not found');
  res.json({ message: 'Super admin deleted' });
}));

// ---------------------------------------------------------------- WHATSAPP test
router.post('/whatsapp/test', ah(async (req, res) => {
  const to = wa.normalizePhone(req.body.phone);
  if (!to) throw httpErr(400, 'Enter a valid mobile number');
  const text = wa.compose('paid', { store: (await getBranding()).name, name: 'Test', orderNo: 'O-TEST', total: 100, link: '', trackLink: '' });
  try { res.json(await wa.sendRaw(to, text, { company: 'platform', event: 'test' })); } catch (e) { throw httpErr(502, `WhatsApp gateway error: ${e.message}`); }
}));

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
  let company = await provisionCompany(req.body);
  const w = wa.companyPatch(req.body);
  await master.query('UPDATE companies SET whatsapp_enabled=?,wa_events=?,payment_hold_hours=?,auto_cancel_unpaid=? WHERE id=?',
    [w.whatsapp_enabled, w.wa_events, w.payment_hold_hours, w.auto_cancel_unpaid, company.id]);
  [[company]] = await master.query('SELECT * FROM companies WHERE id=?', [company.id]);
  clearCompanyCache();
  res.status(201).json(parse(company));
}));

// the image / logo / icon paths are cached with the company for a few seconds -> clear when the upload is finished
router.use('/companies/:id/assets', (req, res, next) => { res.on('finish', clearCompanyCache); next(); }, require('./companyAssets'));

router.put('/companies/:id', ah(async (req, res) => {
  const { name, design, brand_color, status } = req.body;
  const features = Array.isArray(req.body.features) ? req.body.features.filter((f) => ALL_FEATURES.includes(f)) : null;
  const [[c]] = await master.query('SELECT * FROM companies WHERE id=?', [req.params.id]);
  if (!c) throw httpErr(404, 'Company not found');
  const w = wa.companyPatch(req.body, c);
  await master.query('UPDATE companies SET name=?,design=?,brand_color=?,features=?,status=?,whatsapp_enabled=?,wa_events=?,payment_hold_hours=?,auto_cancel_unpaid=? WHERE id=?', [
    (name || c.name).trim(),
    DESIGNS.includes(design) ? design : c.design,
    /^#[0-9a-fA-F]{6}$/.test(brand_color || '') ? brand_color : c.brand_color,
    features ? JSON.stringify(features) : c.features,
    ['active', 'blocked'].includes(status) ? status : c.status,
    w.whatsapp_enabled, w.wa_events, w.payment_hold_hours, w.auto_cancel_unpaid,
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

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { auth, ah, httpErr } = require('../middleware/auth');

const sign = (req, u) => jwt.sign({ t: 'u', id: u.id, cid: req.company.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, permissions: u.permissions || [] });
const { effective } = require('../lib/permissions');

router.post('/register', ah(async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) throw httpErr(400, 'Name, email and password are required');
  if (password.length < 6) throw httpErr(400, 'Password must be at least 6 characters');
  const mail = String(email).toLowerCase().trim();
  const [ex] = await req.db.query('SELECT id FROM users WHERE email=?', [mail]);
  if (ex.length) throw httpErr(409, 'This email is already registered');
  const [r] = await req.db.query('INSERT INTO users (name,email,phone,password,role) VALUES (?,?,?,?,?)',
    [name.trim(), mail, phone || null, await bcrypt.hash(password, 10), 'user']);
  const user = { id: r.insertId, name: name.trim(), email: mail, phone: phone || null, role: 'user', permissions: [] };
  res.status(201).json({ token: sign(req, user), user: pub(user) });
}));

const login = (adminMode) => ah(async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await req.db.query('SELECT * FROM users WHERE email=?', [String(email || '').toLowerCase().trim()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(password || ''), u.password))) throw httpErr(401, 'Invalid email or password');
  if (u.status === 'blocked') throw httpErr(403, 'Your account is blocked. Contact the store.');
  const isStaff = u.role === 'company_admin' || u.role === 'staff';
  if (adminMode && !isStaff) throw httpErr(403, 'This is not a company admin / staff account');
  if (!adminMode && isStaff) throw httpErr(403, 'Admin and staff must use the Admin Login page');
  u.permissions = effective(u);
  res.json({ token: sign(req, u), user: pub(u) });
});

router.post('/login', login(false));
router.post('/admin/login', login(true));
router.get('/me', auth, (req, res) => res.json({ user: pub(req.user) }));

module.exports = router;

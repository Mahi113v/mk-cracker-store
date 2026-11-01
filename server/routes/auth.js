const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { auth, ah, httpErr } = require('../middleware/auth');
const { effective } = require('../lib/permissions');

const sign = (req, u) => jwt.sign({ t: 'u', id: u.id, cid: req.company.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const pub = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
  address: u.address || '', city: u.city || '', state: u.state || '', pincode: u.pincode || '',
  permissions: u.permissions || [], created_at: u.created_at || null,
});

const cleanPhone = (v) => String(v || '').replace(/\D/g, '').slice(-10);
const txt = (v) => String(v || '').trim() || null;

router.post('/register', ah(async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) throw httpErr(400, 'Name, email and password are required');
  if (password.length < 6) throw httpErr(400, 'Password must be at least 6 characters');
  const mail = String(email).toLowerCase().trim();
  const ph = cleanPhone(phone) || null;
  if (ph && ph.length !== 10) throw httpErr(400, 'Enter a valid 10 digit mobile number');

  const [ex] = await req.db.query('SELECT id, email FROM users WHERE email=? OR (? IS NOT NULL AND phone=?) LIMIT 1', [mail, ph, ph]);
  if (ex.length) throw httpErr(409, ex[0].email === mail ? 'This email is already registered' : 'This mobile number is already registered');

  const [r] = await req.db.query('INSERT INTO users (name,email,phone,password,role) VALUES (?,?,?,?,?)',
    [name.trim(), mail, ph, await bcrypt.hash(password, 10), 'user']);
  const user = { id: r.insertId, name: name.trim(), email: mail, phone: ph, role: 'user', permissions: [], created_at: new Date() };
  res.status(201).json({ token: sign(req, user), user: pub(user) });
}));

// identifier = email OR 10 digit mobile number
const login = (adminMode) => ah(async (req, res) => {
  const { password } = req.body;
  const raw = String(req.body.identifier || req.body.email || '').trim();
  if (!raw || !password) throw httpErr(400, 'Enter email or mobile number and password');

  const isEmail = raw.includes('@');
  const [rows] = isEmail
    ? await req.db.query('SELECT * FROM users WHERE email=? LIMIT 1', [raw.toLowerCase()])
    : await req.db.query('SELECT * FROM users WHERE phone=? LIMIT 1', [cleanPhone(raw)]);

  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(password), u.password))) throw httpErr(401, 'Invalid email / mobile or password');
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

// Update own profile: name, email, mobile, address
router.put('/profile', auth, ah(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase() || null;
  const phone = cleanPhone(req.body.phone) || null;

  if (!name) throw httpErr(400, 'Name is required');
  if (!email) throw httpErr(400, 'Email is required');
  if (phone && phone.length !== 10) throw httpErr(400, 'Enter a valid 10 digit mobile number');

  const [dup] = await req.db.query(
    'SELECT id, email FROM users WHERE id<>? AND (email=? OR (? IS NOT NULL AND phone=?)) LIMIT 1',
    [req.user.id, email, phone, phone]);
  if (dup.length) throw httpErr(409, dup[0].email === email ? 'This email is already registered' : 'This mobile number is already registered');

  await req.db.query(
    'UPDATE users SET name=?, email=?, phone=?, address=?, city=?, state=?, pincode=? WHERE id=?',
    [name, email, phone, txt(req.body.address), txt(req.body.city), txt(req.body.state), txt(req.body.pincode), req.user.id]);
  res.json({ message: 'Profile updated' });
}));

module.exports = router;
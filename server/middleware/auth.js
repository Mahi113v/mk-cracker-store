const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { effective } = require('../lib/permissions');

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const httpErr = (status, message) => Object.assign(new Error(message), { status });

const bearer = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};
const verify = (token) => {
  if (!token) throw httpErr(401, 'Please login first');
  try { return jwt.verify(token, process.env.JWT_SECRET); }
  catch { throw httpErr(401, 'Session expired, please login again'); }
};

// Company user (customer / staff / company admin). Needs tenant middleware first (req.company, req.db)
const auth = ah(async (req, res, next) => {
  const p = verify(bearer(req));
  if (p.t !== 'u' || p.cid !== req.company.id) throw httpErr(401, 'Please login to this company');
  const [rows] = await req.db.query('SELECT id,name,email,phone,role,status,permissions FROM users WHERE id=?', [p.id]);
  const u = rows[0];
  if (!u) throw httpErr(401, 'Account not found');
  if (u.status === 'blocked') throw httpErr(403, 'Your account is blocked. Contact the store.');
  u.permissions = effective(u);
  u.imp = !!p.imp;
  req.user = u;
  next();
});

// Platform (super) admin
const platformAuth = ah(async (req, res, next) => {
  const p = verify(bearer(req));
  if (p.t !== 'p') throw httpErr(401, 'Platform login required');
  const [rows] = await db.master.query('SELECT id,name,email,status FROM platform_users WHERE id=?', [p.id]);
  if (!rows[0] || rows[0].status !== 'active') throw httpErr(401, 'Account not found');
  req.platform = rows[0];
  next();
});

// Allow if user has ANY of the given permission keys (company_admin has all)
const perm = (...keys) => (req, res, next) =>
  req.user && (req.user.role === 'company_admin' || keys.some((k) => req.user.permissions.includes(k)))
    ? next()
    : res.status(403).json({ error: 'You do not have access to this option' });

const companyAdminOnly = (req, res, next) =>
  req.user && req.user.role === 'company_admin' ? next() : res.status(403).json({ error: 'Only the company admin can do this' });

const canDiscount = (u) => u && (u.role === 'company_admin' || u.permissions.includes('discount.change'));

module.exports = { auth, platformAuth, perm, companyAdminOnly, canDiscount, ah, httpErr };

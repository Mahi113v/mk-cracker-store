const { master, tenantPool } = require('../config/db');
const { ah, httpErr } = require('./auth');

const cache = new Map(); // code -> { at, company }
const TTL = 20 * 1000;

async function loadCompany(code) {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < TTL) return hit.company;
  const [rows] = await master.query('SELECT id,name,code,db_name,design,brand_color,features,status FROM companies WHERE code=?', [code]);
  let company = rows[0] || null;
  if (company) {
    try { company.features = JSON.parse(company.features || '[]'); } catch { company.features = []; }
  }
  cache.set(code, { at: Date.now(), company });
  return company;
}
const clearCompanyCache = () => cache.clear();

// Every company API call must send header  X-Company: <company code>
const tenant = ah(async (req, res, next) => {
  const code = String(req.headers['x-company'] || '').toLowerCase().trim();
  if (!code) throw httpErr(400, 'Company code is missing');
  const company = await loadCompany(code);
  if (!company) throw httpErr(404, 'Company not found');
  if (company.status !== 'active') throw httpErr(403, 'This company is not active');
  req.company = company;
  req.db = tenantPool(company.db_name);   // this company's own database
  next();
});

const feature = (name) => (req, res, next) =>
  req.company.features.includes(name) ? next() : res.status(403).json({ error: 'This feature is not enabled for your company' });

module.exports = { tenant, feature, clearCompanyCache };

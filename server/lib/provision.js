const bcrypt = require('bcryptjs');
const { master, rootConn, MASTER_DB } = require('../config/db');
const { applyMigrations } = require('./migrator');
const { httpErr } = require('../middleware/auth');

const DESIGNS = ['default', 'normal', 'current'];
const ALL_FEATURES = ['reports', 'pricelist', 'import', 'quick_discount', 'print'];
const RESERVED = ['mysql', 'sys', 'information_schema', 'performance_schema', MASTER_DB.toLowerCase()];

function validate(input) {
  const name = String(input.name || '').trim();
  const code = String(input.code || '').toLowerCase().trim();
  const db_name = String(input.db_name || '').toLowerCase().trim();
  if (!name) throw httpErr(400, 'Company name is required');
  if (!/^[a-z][a-z0-9-]{1,29}$/.test(code)) throw httpErr(400, 'Company code: 2-30 letters / numbers / hyphen, start with a letter (example: mk)');
  if (!/^[a-z][a-z0-9_]{2,39}$/.test(db_name)) throw httpErr(400, 'Database name: 3-40 characters, lowercase letters, numbers and underscore only (example: mk_crackers)');
  if (RESERVED.includes(db_name)) throw httpErr(400, 'This database name is reserved. Choose another name');
  if (['platform', 'api', 'uploads', 'assets', 'admin'].includes(code)) throw httpErr(400, 'This company code is reserved');
  return { name, code, db_name };
}

// Creates the company record + its OWN database + all tables, then the company admin user.
async function provisionCompany(input) {
  const { name, code, db_name } = validate(input);
  const design = DESIGNS.includes(input.design) ? input.design : 'normal';
  const brand = /^#[0-9a-fA-F]{6}$/.test(input.brand_color || '') ? input.brand_color : '#e11d48';
  const features = Array.isArray(input.features) ? input.features.filter((f) => ALL_FEATURES.includes(f)) : ALL_FEATURES;
  const a = input.admin || {};
  if (!a.name || !a.email || !a.password) throw httpErr(400, 'Company admin name, email and password are required');
  if (String(a.password).length < 6) throw httpErr(400, 'Admin password must be at least 6 characters');

  const [dup] = await master.query('SELECT code,db_name FROM companies WHERE code=? OR db_name=?', [code, db_name]);
  if (dup.length) throw httpErr(409, dup[0].code === code ? 'Company code already used' : 'This database name is already used by another company');

  const root = await rootConn();
  let companyId = null;
  let createdDb = false;
  try {
    const [exists] = await root.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [db_name]);
    if (exists.length) {
      const [t] = await root.query('SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=?', [db_name]);
      if (t[0].n > 0) throw httpErr(409, 'A database with this name already exists and has tables. Choose a new database name');
    }
    const [r] = await master.query('INSERT INTO companies (name,code,db_name,design,brand_color,features,status) VALUES (?,?,?,?,?,?,?)',
      [name, code, db_name, design, brand, JSON.stringify(features), 'provisioning']);
    companyId = r.insertId;

    await root.query(`CREATE DATABASE IF NOT EXISTS \`${db_name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    createdDb = !exists.length;
    await root.query(`USE \`${db_name}\``);
    await applyMigrations(root, 'tenant', { CID: companyId });

    await root.query('INSERT INTO users (name,email,phone,password,role) VALUES (?,?,?,?,?)',
      [a.name.trim(), String(a.email).toLowerCase().trim(), a.phone || null, await bcrypt.hash(String(a.password), 10), 'company_admin']);
    const defaults = { store_name: name, phone: input.phone || '', announcement: `Welcome to ${name}`, upi_id: '', upi_name: name };
    for (const [k, v] of Object.entries(defaults)) await root.query('INSERT IGNORE INTO settings (k,v) VALUES (?,?)', [k, v]);

    await master.query("UPDATE companies SET status='active' WHERE id=?", [companyId]);
    const [[company]] = await master.query('SELECT * FROM companies WHERE id=?', [companyId]);
    return company;
  } catch (e) {
    if (companyId) await master.query('DELETE FROM companies WHERE id=?', [companyId]).catch(() => {});
    if (createdDb) await root.query(`DROP DATABASE IF EXISTS \`${db_name}\``).catch(() => {});
    if (e.code === 'ER_DUP_ENTRY') throw httpErr(409, 'Admin email or company already exists');
    throw e;
  } finally {
    await root.end().catch(() => {});
  }
}

module.exports = { provisionCompany, DESIGNS, ALL_FEATURES };

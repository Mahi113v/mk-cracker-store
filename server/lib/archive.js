// Year-end close:  1) full copy of the company database  ->  <db>_<label>   2) orders are emptied in the live database.
// Products, stock, users, settings stay. The copy stays in MySQL and can be browsed read-only (Admin > Old Data).
const { master, tenantPool, rootConn } = require('../config/db');
const { httpErr } = require('../middleware/auth');
const maintenance = require('./maintenance');

const TRUNCATE = ['order_items', 'orders', 'whatsapp_log']; // what is emptied in the live database
const SALES = "('paid','delivered')";

async function preview(db) {
  const [[o]] = await db.query(
    `SELECT COUNT(*) AS orders, MIN(created_at) AS first_at, MAX(created_at) AS last_at,
       COALESCE(SUM(CASE WHEN status IN ${SALES} THEN total END),0) AS sales,
       COALESCE(SUM(CASE WHEN status IN ('unpaid','pending_verification') THEN 1 END),0) AS open_orders FROM orders`);
  const year = (d) => (d ? new Date(d).getFullYear() : null);
  const y1 = year(o.first_at); const y2 = year(o.last_at);
  const label = !y1 ? String(new Date().getFullYear()) : y1 === y2 ? String(y1) : `${y1}-${y2}`;
  return { orders: o.orders, first_at: o.first_at, last_at: o.last_at, sales: Number(o.sales), open_orders: Number(o.open_orders), label };
}

const safeLabel = (v, fallback) => {
  const s = String(v || fallback || '').trim();
  if (!/^[0-9A-Za-z][0-9A-Za-z-]{0,19}$/.test(s)) throw httpErr(400, 'Label: letters, numbers and hyphen only, up to 20 characters (example: 2026)');
  return s;
};

async function closeYear({ company, userName, label }) {
  if (maintenance.isLocked(company.id)) throw httpErr(409, 'A year-end process is already running for this company');
  maintenance.lock(company.id);
  const live = company.db_name;
  const db = tenantPool(live);
  let root = null;
  let archDb = null;
  let backedUp = false;
  try {
    const p = await preview(db);
    if (!p.orders) throw httpErr(400, 'There are no orders to archive');
    if (p.open_orders > 0) throw httpErr(400, `${p.open_orders} order(s) are still Unpaid / Pending verification. Verify, mark paid or cancel them first, then close the year.`);
    const lab = safeLabel(label, p.label);

    root = await rootConn();
    // unique archive database name
    const base = `${live}_${lab.replace(/-/g, '_')}`.slice(0, 60);
    let name = base; let n = 1;
    for (;;) {
      const [ex] = await root.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [name]);
      if (!ex.length) break;
      n += 1; name = `${base}_${n}`;
    }
    archDb = name;
    await root.query(`CREATE DATABASE \`${archDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    const [tabs] = await root.query("SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE'", [live]);
    for (const { t } of tabs) await root.query(`CREATE TABLE \`${archDb}\`.\`${t}\` LIKE \`${live}\`.\`${t}\``);
    for (const { t } of tabs) {
      const [cols] = await root.query(
        "SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND EXTRA NOT LIKE '%GENERATED%' ORDER BY ORDINAL_POSITION", [live, t]);
      const list = cols.map((x) => `\`${x.c}\``).join(',');
      await root.query(`INSERT INTO \`${archDb}\`.\`${t}\` (${list}) SELECT ${list} FROM \`${live}\`.\`${t}\``);
    }
    // verify: every table must have the same number of rows in the copy
    for (const { t } of tabs) {
      const [[a]] = await root.query(`SELECT COUNT(*) AS n FROM \`${live}\`.\`${t}\``);
      const [[b]] = await root.query(`SELECT COUNT(*) AS n FROM \`${archDb}\`.\`${t}\``);
      if (a.n !== b.n) throw httpErr(500, `Backup check failed for table ${t} (${a.n} rows, copy has ${b.n}). Nothing was deleted.`);
    }
    backedUp = true;

    const [r] = await master.query(
      'INSERT INTO year_archives (company_id,label,db_name,orders_count,sales_total,first_order_at,last_order_at,created_by) VALUES (?,?,?,?,?,?,?,?)',
      [company.id, lab, archDb, p.orders, p.sales, p.first_at, p.last_at, userName || null]);

    const existing = new Set(tabs.map((x) => x.t));
    const conn = await db.getConnection();
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS=0');
      for (const t of TRUNCATE) if (existing.has(t)) await conn.query(`TRUNCATE TABLE \`${t}\``);
      await conn.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (e) {
      throw httpErr(500, `The backup "${archDb}" was saved, but emptying the orders failed: ${e.message}`);
    } finally { conn.release(); }

    return { id: r.insertId, label: lab, db_name: archDb, orders_count: p.orders, sales_total: p.sales };
  } catch (e) {
    if (archDb && !backedUp && root) await root.query(`DROP DATABASE IF EXISTS \`${archDb}\``).catch(() => {});
    throw e;
  } finally {
    if (root) await root.end().catch(() => {});
    maintenance.unlock(company.id);
  }
}

module.exports = { preview, closeYear };

const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '../../database/migrations');

const list = (kind) => fs.readdirSync(path.join(DIR, kind)).filter((f) => f.endsWith('.sql')).sort();

async function ensureTable(conn) {
  await conn.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(150) PRIMARY KEY, ran_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
}

// conn must already be "USE"-ing the target database. vars e.g. { CID: 3 }
async function applyMigrations(conn, kind, vars = {}) {
  await ensureTable(conn);
  const [done] = await conn.query('SELECT name FROM schema_migrations');
  const have = new Set(done.map((r) => r.name));
  const ran = [];
  for (const f of list(kind)) {
    if (have.has(f)) continue;
    let sql = fs.readFileSync(path.join(DIR, kind, f), 'utf8');
    for (const [k, v] of Object.entries(vars)) sql = sql.split(`{{${k}}}`).join(String(v));
    await conn.query(sql);
    await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [f]);
    ran.push(f);
  }
  return ran;
}

async function migrationStatus(conn, kind) {
  await ensureTable(conn);
  const [done] = await conn.query('SELECT name,ran_at FROM schema_migrations');
  const map = new Map(done.map((r) => [r.name, r.ran_at]));
  return list(kind).map((f) => ({ name: f, ran: map.has(f), ran_at: map.get(f) || null }));
}

module.exports = { applyMigrations, migrationStatus };

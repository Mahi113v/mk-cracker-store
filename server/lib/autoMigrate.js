// Runs pending migrations on the master DB and on every company DB when the server starts (safe to run many times).
const { master, rootConn, MASTER_DB } = require('../config/db');
const { applyMigrations } = require('./migrator');

async function autoMigrate() {
  const root = await rootConn();
  try {
    await root.query(`CREATE DATABASE IF NOT EXISTS \`${MASTER_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`USE \`${MASTER_DB}\``);
    const ran = await applyMigrations(root, 'master');
    if (ran.length) console.log(`[migrate] master: ${ran.join(', ')}`);
    const [companies] = await master.query("SELECT id,name,db_name FROM companies WHERE status<>'provisioning'");
    for (const c of companies) {
      try {
        await root.query(`USE \`${c.db_name}\``);
        const r = await applyMigrations(root, 'tenant', { CID: c.id });
        if (r.length) console.log(`[migrate] ${c.name} (${c.db_name}): ${r.join(', ')}`);
      } catch (e) { console.error(`[migrate] ${c.name} (${c.db_name}) FAILED:`, e.message); }
    }
  } finally { await root.end().catch(() => {}); }
}

module.exports = { autoMigrate };

// CLI:  node scripts/db.js migrate | status | seed | setup | fresh --yes
require('../server/config/db');
const { master, rootConn, MASTER_DB, tenantPool } = require('../server/config/db');
const { applyMigrations, migrationStatus } = require('../server/lib/migrator');

async function migrate() {
  const root = await rootConn();
  await root.query(`CREATE DATABASE IF NOT EXISTS \`${MASTER_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await root.query(`USE \`${MASTER_DB}\``);
  const ran = await applyMigrations(root, 'master');
  console.log(`[master:${MASTER_DB}]`, ran.length ? 'ran ' + ran.join(', ') : 'up to date');
  const [companies] = await master.query("SELECT id,name,db_name FROM companies WHERE status<>'provisioning'");
  for (const c of companies) {
    await root.query(`USE \`${c.db_name}\``);
    const r = await applyMigrations(root, 'tenant', { CID: c.id });
    console.log(`[company:${c.name} -> ${c.db_name}]`, r.length ? 'ran ' + r.join(', ') : 'up to date');
  }
  await root.end();
}

async function status() {
  const root = await rootConn();
  await root.query(`USE \`${MASTER_DB}\``);
  console.log(`MASTER (${MASTER_DB})`);
  (await migrationStatus(root, 'master')).forEach((m) => console.log(`  [${m.ran ? 'x' : ' '}] ${m.name}`));
  const [companies] = await master.query('SELECT id,name,db_name FROM companies');
  for (const c of companies) {
    await root.query(`USE \`${c.db_name}\``);
    console.log(`COMPANY ${c.name} (${c.db_name})`);
    (await migrationStatus(root, 'tenant')).forEach((m) => console.log(`  [${m.ran ? 'x' : ' '}] ${m.name}`));
  }
  await root.end();
}

async function fresh() {
  if (!process.argv.includes('--yes')) { console.log('This DROPS the master database and every company database. Run: npm run db:fresh'); return; }
  const root = await rootConn();
  try {
    const [companies] = await master.query('SELECT db_name FROM companies');
    for (const c of companies) { await root.query(`DROP DATABASE IF EXISTS \`${c.db_name}\``); console.log('dropped', c.db_name); }
  } catch { /* master may not exist yet */ }
  await root.query(`DROP DATABASE IF EXISTS \`${MASTER_DB}\``);
  console.log('dropped', MASTER_DB);
  await root.end();
}

(async () => {
  const cmd = process.argv[2];
  try {
    if (cmd === 'migrate') await migrate();
    else if (cmd === 'status') await status();
    else if (cmd === 'seed') await require('../database/seeders').seedAll();
    else if (cmd === 'setup') { await migrate(); await require('../database/seeders').seedAll(); }
    else if (cmd === 'fresh') { await fresh(); if (process.argv.includes('--yes')) { await migrate(); await require('../database/seeders').seedAll(); } }
    else console.log('Usage: node scripts/db.js migrate | status | seed | setup | fresh --yes');
  } catch (e) { console.error('FAILED:', e.message); process.exitCode = 1; }
  process.exit();
})();

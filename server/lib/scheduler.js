// Runs every few minutes:
//   * unpaid orders  -> WhatsApp reminder 12 hours before and 1 hour before the payment hold ends
//   * hold ended + "auto cancel" ON for the company -> order is cancelled and the stock goes back
const { master, tenantPool } = require('../config/db');
const { restoreStock } = require('./helpers');
const wa = require('./whatsapp');
const maintenance = require('./maintenance');

const EVERY = 5 * 60 * 1000;
let running = false;

async function expire(db, company, id) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[o]] = await conn.query("SELECT id,order_no FROM orders WHERE id=? AND status='unpaid' AND hold_until<=NOW() FOR UPDATE", [id]);
    if (!o) { await conn.rollback(); return false; }
    await restoreStock(conn, o.id, null, `Auto-cancelled ${o.order_no}`);
    await conn.query("UPDATE orders SET status='cancelled',admin_note=? WHERE id=?", ['Auto-cancelled: payment not received in time', o.id]);
    await conn.commit();
    return true;
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

async function sweepCompany(c) {
  const db = tenantPool(c.db_name);
  const autoCancel = !!Number(c.auto_cancel_unpaid);
  const [rows] = await db.query("SELECT id,TIMESTAMPDIFF(MINUTE,NOW(),hold_until) AS mins FROM orders WHERE status='unpaid' AND hold_until IS NOT NULL");
  const holdHours = Number(c.payment_hold_hours) || 0;
  for (const o of rows) {
    if (o.mins <= 0) {
      if (autoCancel && (await expire(db, c, o.id))) wa.fire(c, db, o.id, 'cancelled', { expired: true });
    } else if (o.mins <= 60) {
      await wa.notifyOrder(c, db, o.id, 'reminder_1h');
    } else if (o.mins <= 720 && holdHours > 12) {
      await wa.notifyOrder(c, db, o.id, 'reminder_12h');
    }
  }
}

async function sweep() {
  if (running) return;
  running = true;
  try {
    const [companies] = await master.query("SELECT * FROM companies WHERE status='active' AND (whatsapp_enabled=1 OR auto_cancel_unpaid=1)");
    for (const c of companies) {
      if (maintenance.isLocked(c.id)) continue;
      try { await sweepCompany(c); } catch (e) { console.error(`[scheduler] ${c.code}:`, e.message); }
    }
  } catch (e) { console.error('[scheduler]', e.message); } finally { running = false; }
}

function start() {
  setTimeout(sweep, 20 * 1000).unref();
  setInterval(sweep, EVERY).unref();
}

module.exports = { start, sweep };

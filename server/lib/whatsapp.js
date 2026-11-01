// WhatsApp messages (Tamil + English in ONE message).
// The platform (super admin) decides per company: WhatsApp ON/OFF, which events, unpaid hold hours, auto-cancel.
// The sending provider is chosen once for the whole server with WHATSAPP_PROVIDER in .env (see .env.example).

const EVENTS = [
  ['created', 'Order placed (unpaid)'],
  ['pending_verification', 'Payment screenshot received (pending verification)'],
  ['paid', 'Payment verified / paid'],
  ['delivered', 'Delivered (with track order link)'],
  ['cancelled', 'Order cancelled'],
  ['reminder_12h', 'Unpaid reminder - 12 hours left'],
  ['reminder_1h', 'Unpaid reminder - 1 hour left'],
];
const EVENT_KEYS = EVENTS.map((e) => e[0]);

const parseEvents = (raw) => {
  if (raw === null || raw === undefined || raw === '') return EVENT_KEYS;
  if (Array.isArray(raw)) return raw.filter((k) => EVENT_KEYS.includes(k));
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a.filter((k) => EVENT_KEYS.includes(k)) : EVENT_KEYS; } catch { return EVENT_KEYS; }
};
const flag = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);

// Values for companies.whatsapp_enabled / wa_events / payment_hold_hours / auto_cancel_unpaid from a request body
function companyPatch(body, current = {}) {
  const hours = body.payment_hold_hours === undefined || body.payment_hold_hours === ''
    ? Number(current.payment_hold_hours ?? 24) : Number(body.payment_hold_hours);
  return {
    whatsapp_enabled: body.whatsapp_enabled === undefined ? Number(current.whatsapp_enabled || 0) : flag(body.whatsapp_enabled),
    wa_events: Array.isArray(body.wa_events) ? JSON.stringify(parseEvents(body.wa_events)) : (current.wa_events ?? null),
    payment_hold_hours: Number.isFinite(hours) ? Math.min(720, Math.max(0, Math.round(hours))) : 24,
    auto_cancel_unpaid: body.auto_cancel_unpaid === undefined ? Number(current.auto_cancel_unpaid || 0) : flag(body.auto_cancel_unpaid),
  };
}

/* ------------------------------------------------------------------ phone / links */
function normalizePhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) return '91' + d;
  if (d.length === 11 && d.startsWith('0')) return '91' + d.slice(1);
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}
const baseUrl = () => String(process.env.APP_URL || (process.env.CLIENT_URL || '').split(',')[0] || '').trim().replace(/\/+$/, '');
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

/* ------------------------------------------------------------------ message text (English + Tamil) */
function compose(event, c) {
  const { store, name, orderNo, total, link, trackLink, autoCancel, expired } = c;
  const hi = name ? `Hi ${name}, ` : '';
  const vanakkam = name ? `வணக்கம் ${name}, ` : 'வணக்கம், ';
  const amt = money(total);
  let en; let ta;
  switch (event) {
    case 'created':
      en = `${hi}your order *${orderNo}* (${amt}) has been placed. Please pay by UPI and upload the payment screenshot here:\n${link}`;
      ta = `${vanakkam}உங்கள் ஆர்டர் *${orderNo}* (${amt}) பதிவு செய்யப்பட்டது. UPI மூலம் பணம் செலுத்தி, கட்டண ஸ்கிரீன்ஷாட்டை இங்கே பதிவேற்றவும்:\n${link}`;
      break;
    case 'pending_verification':
      en = `We received your payment screenshot for order *${orderNo}* (${amt}). We are verifying it and will confirm shortly.\nTrack: ${trackLink}`;
      ta = `ஆர்டர் *${orderNo}* (${amt}) க்கான உங்கள் கட்டண ஸ்கிரீன்ஷாட் கிடைத்தது. சரிபார்த்து விரைவில் உறுதிப்படுத்துவோம்.\nஆர்டர் நிலை: ${trackLink}`;
      break;
    case 'paid':
      en = `Payment received for order *${orderNo}* (${amt}). Thank you! Your order is confirmed and is being prepared.\nTrack: ${trackLink}`;
      ta = `ஆர்டர் *${orderNo}* (${amt}) க்கான பணம் பெறப்பட்டது. நன்றி! உங்கள் ஆர்டர் உறுதி செய்யப்பட்டு தயார் செய்யப்படுகிறது.\nஆர்டர் நிலை: ${trackLink}`;
      break;
    case 'delivered':
      en = `Your order *${orderNo}* has been delivered. Thank you for shopping with us!\nTrack your order: ${trackLink}`;
      ta = `உங்கள் ஆர்டர் *${orderNo}* டெலிவரி செய்யப்பட்டது. எங்களிடம் வாங்கியதற்கு நன்றி!\nஆர்டர் நிலையைப் பார்க்க: ${trackLink}`;
      break;
    case 'cancelled':
      en = `Your order *${orderNo}* has been cancelled${expired ? ' because the payment was not received in time' : ''}.`;
      ta = `உங்கள் ஆர்டர் *${orderNo}* ரத்து செய்யப்பட்டது${expired ? ' (குறிப்பிட்ட நேரத்திற்குள் பணம் செலுத்தப்படவில்லை)' : ''}.`;
      break;
    case 'reminder_12h':
    case 'reminder_1h': {
      const h = event === 'reminder_12h' ? 12 : 1;
      en = `Reminder: payment for order *${orderNo}* (${amt}) is still pending. Please pay within ${h} hour${h > 1 ? 's' : ''}${autoCancel ? ', otherwise the order will be cancelled automatically' : ''}.\nPay here: ${link}`;
      ta = `நினைவூட்டல்: ஆர்டர் *${orderNo}* (${amt}) க்கான பணம் இன்னும் செலுத்தப்படவில்லை. தயவுசெய்து ${h} மணி நேரத்திற்குள் செலுத்தவும்${autoCancel ? '; இல்லையெனில் ஆர்டர் தானாகவே ரத்தாகிவிடும்' : ''}.\nபணம் செலுத்த: ${link}`;
      break;
    }
    default:
      en = `Update for order *${orderNo}*.`;
      ta = `ஆர்டர் *${orderNo}* பற்றிய தகவல்.`;
  }
  return `*${store}*\n\n${en}\n\n${ta}`;
}

/* ------------------------------------------------------------------ providers */
async function http(url, opts, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    const body = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${body.slice(0, 180)}`);
    return body;
  } finally { clearTimeout(t); }
}

const providerName = () => String(process.env.WHATSAPP_PROVIDER || 'log').toLowerCase();
function providerInfo() {
  const p = providerName();
  const env = process.env;
  const configured = p === 'cloud' ? !!(env.WA_CLOUD_TOKEN && env.WA_CLOUD_PHONE_ID)
    : p === 'twilio' ? !!(env.TWILIO_SID && env.TWILIO_TOKEN && env.TWILIO_WHATSAPP_FROM)
      : p === 'webhook' ? !!env.WA_WEBHOOK_URL
        : p === 'gateway' ? !!env.WA_GATEWAY_URL : false;
  return { provider: p, configured };
}


// Any simple HTTP gateway (e.g. web.cloudwhatsapp.com/wapp/api/send): you describe the request in .env
//   WA_GATEWAY_URL      full url
//   WA_GATEWAY_METHOD   GET (default) | POST
//   WA_GATEWAY_FORMAT   query (default for GET) | form | json
//   WA_GATEWAY_PARAMS   JSON, placeholders {{to}} (919876543210)  {{to10}} (9876543210)  {{message}}  {{event}}  {{company}}
//   WA_GATEWAY_HEADERS  optional JSON of headers (e.g. {"Authorization":"Bearer xxx"})
//   WA_GATEWAY_SUCCESS  optional text that the reply must contain (e.g. success) - otherwise it is treated as failed
const fill = (v, vars) => {
  if (typeof v === 'string') return v.replace(/\{\{(\w+)\}\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  if (Array.isArray(v)) return v.map((x) => fill(x, vars));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x, vars)]));
  return v;
};
async function sendGateway(to, text, meta) {
  const env = process.env;
  let tpl; let headers = {};
  try { tpl = JSON.parse(env.WA_GATEWAY_PARAMS || '{}'); } catch { throw new Error('WA_GATEWAY_PARAMS is not valid JSON'); }
  try { headers = JSON.parse(env.WA_GATEWAY_HEADERS || '{}'); } catch { throw new Error('WA_GATEWAY_HEADERS is not valid JSON'); }
  const vars = { to, to10: to.length === 12 && to.startsWith('91') ? to.slice(2) : to, message: text, event: meta.event || '', company: meta.company || '' };
  const params = fill(tpl, vars);
  const method = String(env.WA_GATEWAY_METHOD || 'GET').toUpperCase();
  const format = String(env.WA_GATEWAY_FORMAT || (method === 'GET' ? 'query' : 'form')).toLowerCase();
  let url = env.WA_GATEWAY_URL; const opts = { method, headers };
  if (format === 'json') { opts.headers = { 'Content-Type': 'application/json', ...headers }; opts.body = JSON.stringify(params); }
  else {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])).toString();
    if (method === 'GET' || format === 'query') url += (url.includes('?') ? '&' : '?') + qs;
    else { opts.headers = { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }; opts.body = qs; }
  }
  const body = await http(url, opts);
  if (env.WA_GATEWAY_SUCCESS && !body.toLowerCase().includes(String(env.WA_GATEWAY_SUCCESS).toLowerCase())) throw new Error(`Gateway reply: ${body.slice(0, 180)}`);
}

// Sends one message. Returns { status: 'sent' | 'skipped' }. Throws when the gateway rejects it.
async function sendRaw(to, text, meta = {}) {
  const p = providerName();
  const env = process.env;
  if (!providerInfo().configured) return { status: 'skipped', provider: p, error: 'WhatsApp provider is not configured (WHATSAPP_PROVIDER)' };
  if (p === 'cloud') {
    const body = env.WA_CLOUD_TEMPLATE
      ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: env.WA_CLOUD_TEMPLATE, language: { code: env.WA_CLOUD_TEMPLATE_LANG || 'en' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: text.replace(/\s*\n+\s*/g, ' | ').replace(/ {2,}/g, ' ').slice(0, 1000) }] }] } }
      : { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: true, body: text } };
    await http(`https://graph.facebook.com/v20.0/${env.WA_CLOUD_PHONE_ID}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.WA_CLOUD_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } else if (p === 'twilio') {
    const from = String(env.TWILIO_WHATSAPP_FROM).replace(/^whatsapp:/, '');
    await http(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(`${env.TWILIO_SID}:${env.TWILIO_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: `whatsapp:${from}`, To: `whatsapp:+${to}`, Body: text }).toString(),
    });
  } else if (p === 'gateway') {
    await sendGateway(to, text, meta);
  } else if (p === 'webhook') {
    await http(env.WA_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(env.WA_WEBHOOK_TOKEN ? { Authorization: `Bearer ${env.WA_WEBHOOK_TOKEN}` } : {}) },
      body: JSON.stringify({ to, message: text, ...meta }),
    });
  }
  return { status: 'sent', provider: p };
}

/* ------------------------------------------------------------------ order notifications */
async function writeLog(db, row) {
  try {
    await db.query('INSERT INTO whatsapp_log (order_id,event,phone,status,provider,error,message) VALUES (?,?,?,?,?,?,?)',
      [row.order_id || null, row.event, row.phone || null, row.status, row.provider || null, row.error ? String(row.error).slice(0, 250) : null, row.message || null]);
  } catch (e) { console.error('[whatsapp] log failed:', e.message); }
}

// company = row from tenant middleware / master (needs id, code, name, whatsapp_enabled, wa_events, auto_cancel_unpaid)
async function notifyOrder(company, db, orderId, event, opts = {}) {
  if (!company || !Number(company.whatsapp_enabled)) return { status: 'skipped', error: 'WhatsApp is switched off for this company' };
  const events = parseEvents(company.wa_events);
  if (!opts.force && !events.includes(event)) return { status: 'skipped', error: 'This message type is switched off' };

  const [[o]] = await db.query('SELECT id,order_no,total,name,phone FROM orders WHERE id=?', [orderId]);
  if (!o) return { status: 'skipped', error: 'Order not found' };
  if (event.startsWith('reminder_') && !opts.force) {
    const [dup] = await db.query('SELECT id FROM whatsapp_log WHERE order_id=? AND event=? LIMIT 1', [o.id, event]);
    if (dup.length) return { status: 'skipped', error: 'Already sent' };
  }
  const to = normalizePhone(o.phone);
  if (!to) { await writeLog(db, { order_id: o.id, event, phone: o.phone, status: 'failed', error: 'Invalid phone number' }); return { status: 'failed', error: 'Invalid phone number' }; }

  let store = company.name;
  try { const [[s]] = await db.query("SELECT v FROM settings WHERE k='store_name'"); if (s && s.v) store = s.v; } catch { /* ignore */ }
  const base = baseUrl();
  const text = compose(event, {
    store, name: o.name, orderNo: o.order_no, total: o.total,
    link: base ? `${base}/${company.code}/enquiries/${o.id}` : '',
    trackLink: base ? `${base}/${company.code}/track` : '',
    autoCancel: !!Number(company.auto_cancel_unpaid), expired: !!opts.expired,
  });

  try {
    const r = await sendRaw(to, text, { company: company.code, event, order_no: o.order_no });
    await writeLog(db, { order_id: o.id, event, phone: to, status: r.status, provider: r.provider, error: r.error, message: text });
    return r;
  } catch (e) {
    await writeLog(db, { order_id: o.id, event, phone: to, status: 'failed', provider: providerName(), error: e.message, message: text });
    return { status: 'failed', error: e.message };
  }
}

// fire-and-forget: never blocks or breaks the order request
const fire = (company, db, orderId, event, opts) => {
  notifyOrder(company, db, orderId, event, opts).catch((e) => console.error('[whatsapp]', e.message));
};

module.exports = { EVENTS, EVENT_KEYS, parseEvents, companyPatch, normalizePhone, compose, sendRaw, providerInfo, notifyOrder, fire, flag };

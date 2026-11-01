const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { master, tenantPool } = require('../../server/config/db');
const { provisionCompany, ALL_FEATURES } = require('../../server/lib/provision');
const { PRESETS } = require('../../server/lib/permissions');
const { UPLOAD_ROOT } = require('../../server/middleware/upload');
const SAMPLE_USERS = require('./sampleUsers');

const COMPANIES = [
  { name: 'MK Crackers', code: 'mk', db_name: 'mk_cracker_store', design: 'normal', brand_color: '#e11d48', domain: 'mkcrackers', limit: 12, orders: 40 },
  { name: 'M-Trio Crackers', code: 'm-trio', db_name: 'm_trio_crackers', design: 'normal', brand_color: '#f97316', domain: 'mtrio', limit: 8, orders: 18 },
];
const CATS = ['Children Special Novelties', 'Sparklers', 'Flower Pots', 'Sky Shots', 'Rockets', 'Gift Boxes'];
const BRANDS = ['Krishna', 'Standard', 'Sony', 'Ayyan'];
const PRODUCTS = [
  ['CK-0031', 'Crackling Pot', 'Krishna', 'Children Special Novelties', '5 PCS', 1720, 75, 220],
  ['CK-0047', '3D Pot Gold/Silver', 'Krishna', 'Children Special Novelties', '3 PCS', 224, 75, 300],
  ['CK-0048', 'Gee Boom Baa', 'Krishna', 'Children Special Novelties', '50 PCS', 480, 75, 180],
  ['CK-0053', 'Moon Drops', 'Krishna', 'Children Special Novelties', '3 PCS', 392, 75, 16],
  ['SP-0101', 'Electric Sparklers 10cm', 'Standard', 'Sparklers', '10 PCS', 120, 70, 400],
  ['SP-0102', 'Colour Sparklers 15cm', 'Standard', 'Sparklers', '10 PCS', 180, 70, 0],
  ['FP-0201', 'Flower Pot Big', 'Sony', 'Flower Pots', '10 PCS', 600, 75, 250],
  ['FP-0202', 'Flower Pot Deluxe', 'Sony', 'Flower Pots', '5 PCS', 450, 75, 190],
  ['SS-0301', '7 Shot Sky Shot', 'Ayyan', 'Sky Shots', '1 PCS', 300, 74, 160],
  ['SS-0302', '30 Shot Multicolour', 'Ayyan', 'Sky Shots', '1 PCS', 1500, 74, 95],
  ['RK-0401', 'Rocket Bomb', 'Standard', 'Rockets', '10 PCS', 500, 73, 200],
  ['GB-0501', 'Family Gift Box (51 items)', 'Krishna', 'Gift Boxes', '1 BOX', 3800, 75, 65],
];
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function seedPlatform() {
  const email = (process.env.PLATFORM_EMAIL || 'superadmin@mkcrackers.com').toLowerCase();
  const [ex] = await master.query('SELECT id FROM platform_users WHERE email=?', [email]);
  if (ex.length) return console.log(`  platform admin exists  -> ${email}`);
  await master.query('INSERT INTO platform_users (name,email,password) VALUES (?,?,?)',
    [process.env.PLATFORM_NAME || 'MK Platform Admin', email, await bcrypt.hash(process.env.PLATFORM_PASSWORD || 'Password123$', 10)]);
  console.log(`  platform admin created -> ${email} / ${process.env.PLATFORM_PASSWORD || 'Password123$'}`);
}

function copySeedImage(kind, file, company, outName) {
  const src = path.join(__dirname, '../../seed-images', kind, file);
  if (!fs.existsSync(src)) return null;
  const dir = path.join(UPLOAD_ROOT, company.code, kind);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, path.join(dir, outName));
  return `/uploads/${company.code}/${kind}/${outName}`;
}

async function seedCompany(def) {
  let [[company]] = await master.query('SELECT * FROM companies WHERE code=?', [def.code]);
  if (!company) {
    company = await provisionCompany({
      name: def.name, code: def.code, db_name: def.db_name, design: def.design, brand_color: def.brand_color, features: ALL_FEATURES,
      admin: { name: `${def.name} Admin`, email: `admin@${def.domain}.com`, phone: '9000000000', password: 'password123$' },
    });
    console.log(`  company created: ${def.name}  (code: ${def.code}, database: ${def.db_name}, design: ${def.design})`);
  } else console.log(`  company exists: ${def.name}`);

  const db = tenantPool(company.db_name);
  // ---- users
  for (const u of SAMPLE_USERS) {
    const email = u.email.replace('{co}', def.domain);
    const [ex] = await db.query('SELECT id FROM users WHERE email=?', [email]);
    if (ex.length) continue;
    await db.query('INSERT INTO users (name,email,phone,password,role,permissions) VALUES (?,?,?,?,?,?)',
      [u.name, email, u.phone, await bcrypt.hash(u.password, 10), u.role, u.role === 'staff' ? JSON.stringify(PRESETS[u.preset]) : null]);
  }
  const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM products');
  if (n > 0) return console.log('    catalogue already present - skipped');

  // ---- categories / brands / products
  for (const c of CATS) {
    const img = copySeedImage('categories', `${slug(c)}.png`, company, `seed-${slug(c)}.png`);
    await db.query('INSERT INTO categories (name,image) VALUES (?,?)', [c, img]);
  }
  for (const b of BRANDS) await db.query('INSERT INTO brands (name) VALUES (?)', [b]);
  const [cats] = await db.query('SELECT id,name FROM categories');
  const [brands] = await db.query('SELECT id,name FROM brands');
  const OPEN = 'DATE_SUB(NOW(), INTERVAL 100 DAY)';
  for (const [code, name, brand, cat, pack, mrp, disc, stock] of PRODUCTS.slice(0, def.limit)) {
    const [r] = await db.query('INSERT INTO products (code,name,brand_id,category_id,pack,mrp,discount_percent,stock) VALUES (?,?,?,?,?,?,?,?)',
      [code, name, brands.find((b) => b.name === brand).id, cats.find((c) => c.name === cat).id, pack, mrp, disc, stock]);
    const img = copySeedImage('products', `${code}.png`, company, `seed-${code}.png`);
    if (img) await db.query('INSERT INTO product_images (product_id,path,sort_order) VALUES (?,?,0)', [r.insertId, img]);
    if (stock > 0) await db.query(`INSERT INTO stock_movements (product_id,type,qty,balance,reason,created_at) VALUES (?,'IN',?,?,'Opening stock',${OPEN})`, [r.insertId, stock, stock]);
  }

  // ---- sample orders (back-dated) so daily / weekly / monthly / yearly reports have data
  let seed = def.code.charCodeAt(0) * 97;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const [customers] = await db.query("SELECT id,name,phone FROM users WHERE role='user'");
  const [prods] = await db.query('SELECT id,code,name,pack,mrp,discount_percent,price,stock FROM products WHERE stock>0');
  for (let i = 0; i < def.orders; i++) {
    const daysAgo = Math.floor(rnd() * 80);
    const when = `DATE_ADD(DATE_SUB(CURDATE(), INTERVAL ${daysAgo} DAY), INTERVAL ${9 + Math.floor(rnd() * 11)} HOUR)`;
    const cust = customers[Math.floor(rnd() * customers.length)];
    const pick = [...prods].sort(() => rnd() - 0.5).slice(0, 1 + Math.floor(rnd() * 4));
    const lines = pick.map((p) => ({ p, qty: 1 + Math.floor(rnd() * 6) })).filter((l) => l.p.stock >= l.qty);
    if (!lines.length) continue;
    const roll = rnd();
    const status = daysAgo < 3 && roll < 0.4 ? 'unpaid' : roll < 0.62 ? 'delivered' : roll < 0.86 ? 'paid' : roll < 0.95 ? 'pending_verification' : 'cancelled';
    const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
    const [o] = await db.query(`INSERT INTO orders (order_no,user_id,total,name,phone,address,status,created_at) VALUES (?,?,?,?,?,?,?,${when})`,
      [`TMP-${i}`, cust.id, total, cust.name, cust.phone, 'Coimbatore', status]);
    const no = `O-${1000 + o.insertId}`;
    await db.query('UPDATE orders SET order_no=? WHERE id=?', [no, o.insertId]);
    for (const { p, qty } of lines) {
      await db.query('INSERT INTO order_items (order_id,product_id,code,name,pack,mrp,discount_percent,price,qty,amount) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [o.insertId, p.id, p.code, p.name, p.pack, p.mrp, p.discount_percent, p.price, qty, p.price * qty]);
      p.stock -= qty;
      await db.query('UPDATE products SET stock=? WHERE id=?', [p.stock, p.id]);
      await db.query(`INSERT INTO stock_movements (product_id,type,qty,balance,reason,created_at) VALUES (?,'ORDER',?,?,?,${when})`, [p.id, -qty, p.stock, no]);
      if (status === 'cancelled') {
        p.stock += qty;
        await db.query('UPDATE products SET stock=? WHERE id=?', [p.stock, p.id]);
        await db.query(`INSERT INTO stock_movements (product_id,type,qty,balance,reason,created_at) VALUES (?,'CANCEL',?,?,?,${when})`, [p.id, qty, p.stock, `Cancelled ${no}`]);
      }
    }
  }
  const pe = ['upi_id', 'upi_name'];
  await db.query("UPDATE settings SET v=? WHERE k='upi_id'", [`${def.domain}@upi`]);
  console.log(`    sample catalogue (${def.limit} products), users and ${def.orders} orders added`);
}

async function seedAll() {
  console.log('Seeding...');
  await seedPlatform();
  for (const def of COMPANIES) await seedCompany(def);
}

module.exports = { seedAll, COMPANIES };

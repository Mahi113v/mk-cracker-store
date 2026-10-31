const router = require('express').Router();
const { ah, httpErr } = require('../middleware/auth');
const { feature } = require('../middleware/tenant');
const { memoryUpload } = require('../middleware/upload');
const { BASE_SELECT, attachImages, getSettings } = require('../lib/helpers');
const { buildExcel, buildPdf, parseQuantities } = require('../lib/pricefile');

router.get('/company', (req, res) => {
  const { name, code, design, brand_color, features } = req.company;
  res.json({ name, code, design, brand_color, features });
});

router.get('/settings', ah(async (req, res) => {
  const s = await getSettings(req.db);
  res.json({ store_name: s.store_name, phone: s.phone, announcement: s.announcement, banner_image: s.banner_image });
}));

router.get('/categories', ah(async (req, res) => {
  const [rows] = await req.db.query(
    `SELECT c.id,c.name,c.image,(SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.is_active=1) AS products_count
     FROM categories c ORDER BY c.name`);
  res.json(rows);
}));

router.get('/brands', ah(async (req, res) => {
  const [rows] = await req.db.query('SELECT id,name FROM brands ORDER BY name');
  res.json(rows);
}));

const activeProducts = async (req) => {
  const [rows] = await req.db.query(`${BASE_SELECT} WHERE p.is_active=1 ORDER BY c.name, p.code`);
  return rows;
};

router.get('/products', ah(async (req, res) => {
  const { search, category, brand } = req.query;
  const where = ['p.is_active=1'], args = [];
  if (search) { where.push('(p.name LIKE ? OR p.code LIKE ?)'); args.push(`%${search}%`, `%${search}%`); }
  if (category) { where.push('p.category_id=?'); args.push(category); }
  if (brand) { where.push('p.brand_id=?'); args.push(brand); }
  const [rows] = await req.db.query(`${BASE_SELECT} WHERE ${where.join(' AND ')} ORDER BY c.name, p.code`, args);
  res.json(await attachImages(req.db, rows));
}));

router.get('/track/:orderNo', ah(async (req, res) => {
  const [[o]] = await req.db.query('SELECT order_no,status,total,created_at FROM orders WHERE order_no=?',
    [String(req.params.orderNo).toUpperCase().trim()]);
  if (!o) throw httpErr(404, 'Order not found. Check the order number (example: O-1001)');
  res.json(o);
}));

// Price list download: ?format=xlsx | pdf
router.get('/pricelist', feature('pricelist'), ah(async (req, res) => {
  const products = await activeProducts(req);
  const fmt = req.query.format === 'pdf' ? 'pdf' : 'xlsx';
  const buf = fmt === 'pdf' ? await buildPdf(req.company, products) : await buildExcel(req.company, products);
  res.setHeader('Content-Type', fmt === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${req.company.code}-price-list.${fmt}"`);
  res.send(buf);
}));

// Upload filled Excel / PDF -> returns [{code, qty}] to fill the cart
router.post('/import-qty', feature('import'), memoryUpload(8).single('file'), ah(async (req, res) => {
  if (!req.file) throw httpErr(400, 'Please choose an Excel or PDF file');
  const products = await activeProducts(req);
  res.json(await parseQuantities(req.file, products));
}));

module.exports = router;

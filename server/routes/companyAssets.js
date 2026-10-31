// server/routes/companyAssets.js
// PUT /api/platform/companies/:id/assets   (multipart/form-data)
//   files:   image, logo, icon            -> saved in /uploads/companies, PATH stored in companies table
//   fields:  remove_image / remove_logo / remove_icon = "1"  -> clears that image
const express = require('express');
const multer = require('multer');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const router = express.Router({ mergeParams: true });

const UPLOAD_DIR = path.join(__dirname, '../../uploads/companies'); // same /uploads folder server.js serves
const URL_PREFIX = '/uploads/companies/';
const FIELDS = ['image', 'logo', 'icon'];
const EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
};
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// small pool on the master database (companies table lives here)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.MASTER_DB || 'mk_master',
  waitForConnections: true,
  connectionLimit: 2,
});

const bad = (message) => Object.assign(new Error(message), { status: 400 });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    // random name + extension taken from the checked mimetype (never from the user's file name)
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    if (!FIELDS.includes(file.fieldname)) return cb(bad('Unexpected file field'));
    if (!EXT[file.mimetype]) return cb(bad('Only PNG, JPG, WEBP, GIF or ICO images are allowed'));
    return cb(null, true);
  },
}).fields(FIELDS.map((name) => ({ name, maxCount: 1 })));

const discardUploaded = (req) =>
  Object.values(req.files || {}).flat().forEach((f) => fs.unlink(f.path, () => {}));

const removeOld = (p) => {
  if (!p || !String(p).startsWith(URL_PREFIX)) return;
  fs.unlink(path.join(UPLOAD_DIR, path.basename(p)), () => {});
};

router.put(
  '/',
  (req, res, next) => upload(req, res, (err) => { if (err) { discardUploaded(req); return next(err); } return next(); }),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) { discardUploaded(req); return res.status(400).json({ error: 'Invalid company id' }); }

      const [rows] = await pool.query('SELECT image, logo, icon FROM companies WHERE id = ?', [id]);
      if (!rows.length) { discardUploaded(req); return res.status(404).json({ error: 'Company not found' }); }
      const current = rows[0];

      const updates = {};
      const oldFiles = [];
      FIELDS.forEach((k) => {
        const file = req.files && req.files[k] && req.files[k][0];
        if (file) {
          updates[k] = URL_PREFIX + file.filename;
          oldFiles.push(current[k]);
        } else if (req.body && req.body[`remove_${k}`] === '1') {
          updates[k] = null;
          oldFiles.push(current[k]);
        }
      });

      if (Object.keys(updates).length) {
        await pool.query('UPDATE companies SET ? WHERE id = ?', [updates, id]);
        oldFiles.forEach(removeOld); // delete replaced / removed files only after the DB update worked
      }

      return res.json({ ...{ image: current.image, logo: current.logo, icon: current.icon }, ...updates });
    } catch (e) {
      discardUploaded(req);
      return next(e);
    }
  }
);

module.exports = router;



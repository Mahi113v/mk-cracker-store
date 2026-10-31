const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const BACKEND_ROOT = path.join(__dirname, '../..');
const UPLOAD_ROOT = path.join(BACKEND_ROOT, 'uploads');

// Files are kept per company:  uploads/<companyCode>/<folder>/<file>
const uploader = (folder) =>
  multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.join(UPLOAD_ROOT, req.company.code, folder);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) =>
        cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) =>
      /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)
        ? cb(null, true)
        : cb(Object.assign(new Error('Only JPG, PNG, WEBP or GIF images are allowed'), { status: 400 })),
  });

const memoryUpload = (maxMb = 8) => multer({ storage: multer.memoryStorage(), limits: { fileSize: maxMb * 1024 * 1024 } });

const urlPath = (req, folder, file) => `/uploads/${req.company.code}/${folder}/${file.filename}`;
const removeFile = (p) => {
  if (!p || !p.startsWith('/uploads/')) return;
  fs.unlink(path.join(BACKEND_ROOT, p), () => {});
};

module.exports = { uploader, memoryUpload, urlPath, removeFile, UPLOAD_ROOT };

// Small helper: image upload (multer) into a fixed folder. Used for the platform logo / icon.
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const EXT = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif',
  'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico',
};

function imageFields({ dir, fields, maxMb = 3 }) {
  fs.mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXT[file.mimetype]}`),
    }),
    limits: { fileSize: maxMb * 1024 * 1024, files: fields.length },
    fileFilter: (req, file, cb) => {
      if (!fields.includes(file.fieldname)) return cb(Object.assign(new Error('Unexpected file field'), { status: 400 }));
      if (!EXT[file.mimetype]) return cb(Object.assign(new Error('Only PNG, JPG, WEBP, GIF or ICO images are allowed'), { status: 400 }));
      return cb(null, true);
    },
  }).fields(fields.map((name) => ({ name, maxCount: 1 })));
}

const discard = (req) => Object.values(req.files || {}).flat().forEach((f) => fs.unlink(f.path, () => {}));

module.exports = { imageFields, discard };

const path = require('path');
const fs = require('fs');
require('./config/db'); // loads .env
const express = require('express');
const cors = require('cors');
const { tenant } = require('./middleware/tenant');

const app = express();

// Railway runs the app behind a proxy (needed for correct req.ip / https detection)
app.set('trust proxy', 1);

// CORS: CLIENT_URL can hold one or more origins separated by commas.
// Same-origin requests (React served by this server) are not affected.
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:8000')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  })
);
app.use(express.json());

// Uploaded files. The folder is created if missing (it is not in git).
// NOTE: on Railway this disk is wiped on every redeploy unless a Volume is mounted here.
const uploadsDir = path.join(__dirname, '../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Platform admin (no company needed)
app.use('/api/platform', require('./routes/platform'));

// Everything below belongs to ONE company: header  X-Company: <code>  selects its own database
app.use('/api', tenant);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));

// Unknown API routes return JSON instead of the React page
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app (after: npm run build) so everything runs on one port
const dist = path.join(__dirname, '../dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    const isPage =
      req.method === 'GET' &&
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/uploads') &&
      !path.extname(req.path); // missing .js/.css/.png files should 404, not return index.html
    return isPage ? res.sendFile(path.join(dist, 'index.html')) : next();
  });
} else {
  console.warn('dist/ folder not found. Run "npm run build" before starting the server.');
}

app.use((err, req, res, next) => {
  [...(Array.isArray(req.files) ? req.files : []), req.file]
    .filter((f) => f && f.path)
    .forEach((f) => fs.unlink(f.path, () => {}));
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
  const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Server error: ' + message : message });
});

process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));

// Railway provides PORT. Listen on 0.0.0.0 so the public domain can reach the app.
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`API running on port ${PORT}`));
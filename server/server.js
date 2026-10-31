const path = require('path');
const fs = require('fs');
require('./config/db'); // loads .env
const express = require('express');
const cors = require('cors');
const { tenant } = require('./middleware/tenant');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:8000' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Platform admin (no company needed)
app.use('/api/platform', require('./routes/platform'));

// Everything below belongs to ONE company: header  X-Company: <code>  selects its own database
app.use('/api', tenant);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));

// Serve the built React app (after: npm run build) so everything runs on one port
const dist = path.join(__dirname, '../dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) =>
    req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads') ? res.sendFile(path.join(dist, 'index.html')) : next());
}

app.use((err, req, res, next) => {
  [...(Array.isArray(req.files) ? req.files : []), req.file].filter((f) => f && f.path).forEach((f) => fs.unlink(f.path, () => {}));
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
  const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Server error: ' + message : message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

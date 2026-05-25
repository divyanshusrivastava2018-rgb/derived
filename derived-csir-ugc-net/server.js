// ═══════════════════════════════════════════════════════
//  Derived.co.in — CSIR UGC NET Backend API
//  Serves index.html + REST API on one port
// ═══════════════════════════════════════════════════════

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const apiRouter = require('./lib/apiRouter');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const ROOT = __dirname;

const defaultOrigins = ['https://www.derived.co.in', 'http://localhost:3000', `http://localhost:${PORT}`];
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(/[\s,]+/)
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = corsOrigins.length ? corsOrigins : defaultOrigins;

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://js.hcaptcha.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://hcaptcha.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://hcaptcha.com', 'https://*.hcaptcha.com'],
        frameSrc: ["'self'", 'https://hcaptcha.com', 'https://*.hcaptcha.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    }
  })
);
app.use(express.json({ limit: '64kb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);
app.use('/api', apiRouter);

/* index.html links ../public/css — resolve as /public/css when served from this app */
app.use('/public', express.static(path.join(ROOT, '..', 'public')));

app.use(express.static(ROOT, { index: false }));

app.get('/', (_req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  if (req.method === 'GET' && !req.path.includes('.')) {
    return res.sendFile(path.join(ROOT, 'index.html'));
  }
  next();
});

app.listen(PORT, () => {
  console.log(`\nDerived CSIR UGC NET → http://localhost:${PORT}`);
  console.log(`  Site:  http://localhost:${PORT}/`);
  console.log(`  API:   http://localhost:${PORT}/api/health\n`);
});

module.exports = app;

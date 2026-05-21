// ═══════════════════════════════════════════════════════
//  Derived.co.in — CSIR UGC NET Backend API
//  Standalone service (pair with static site on :3000)
// ═══════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const apiRouter = require('./routes/api');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const defaultOrigins = ['https://www.derived.co.in', 'http://localhost:3000'];
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(/[\s,]+/)
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = corsOrigins.length ? corsOrigins : defaultOrigins;

app.use(helmet());
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

app.get('/', (_req, res) => {
  res.json({
    service: 'derived-backend',
    docs: {
      health: 'GET /api/health',
      stats: 'GET /api/goal/stats',
      subjects: 'GET /api/subjects',
      educators: 'GET /api/educators',
      plans: 'GET /api/plans',
      testimonials: 'GET /api/testimonials',
      faqs: 'GET /api/faqs',
      leads: 'POST /api/leads',
      subscribe: 'POST /api/subscribe',
      doubts: 'POST /api/doubts'
    }
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`\nDerived API running on http://localhost:${PORT}`);
  console.log('  GET  /api/health');
  console.log('  GET  /api/goal/stats');
  console.log('  GET  /api/subjects');
  console.log('  GET  /api/educators');
  console.log('  GET  /api/plans');
  console.log('  GET  /api/testimonials');
  console.log('  GET  /api/faqs');
  console.log('  POST /api/leads');
  console.log('  POST /api/subscribe');
  console.log('  POST /api/doubts\n');
});

module.exports = app;

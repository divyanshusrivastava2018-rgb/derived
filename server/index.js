require('./load-env').loadEnv();
const path = require('path');
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const coursesRouter = require('./routes/courses');
const youtubeRouter = require('./routes/youtube');
const mcqRouter = require('./routes/mcq');
const whyRouter = require('./routes/why');
const adminRouter = require('./routes/admin');
const adminImportRouter = require('./routes/adminImport');
const blogRouter = require('./routes/blog');
const siteRouter = require('./routes/site');
const memberRouter = require('./routes/member');
const newsRouter = require('./routes/news');
const materialsRouter = require('./routes/materials');
const csirRouter = require('./routes/csir');
const homeRouter = require('./routes/home');
const adminLeadsRouter = require('./routes/adminLeads');
const uploadsRouter = require('./routes/uploads');
const rssRouter = require('./routes/rss');
const sitemapRouter = require('./routes/sitemap');
const store = require('./lib/store');
const siteStore = require('./lib/siteStore');
const { DEV_DEFAULT_SECRET, getAdminPassword } = require('./lib/adminAuth');
const memberCookie = require('./lib/memberCookie');

const WEAK_PASSWORDS = new Set([
  'change-me-to-a-long-random-secret',
  'change-me-member-signing-secret',
  'researchium-dev-secret',
  DEV_DEFAULT_SECRET
]);

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

store.readAll();
siteStore.readSite();

function assertProductionAdminConfigured() {
  if (process.env.NODE_ENV !== 'production') return;
  const user = String(process.env.RESEARCHIUM_ADMIN_USERNAME || process.env.ADMIN_USERNAME || '').trim();
  const pass = String(process.env.RESEARCHIUM_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();
  if (!user || !pass) {
    console.error(
      '[Researchium] Production requires RESEARCHIUM_ADMIN_USERNAME and RESEARCHIUM_ADMIN_PASSWORD (non-empty).'
    );
    process.exit(1);
  }
  if (WEAK_PASSWORDS.has(pass)) {
    console.error('[Researchium] Production admin password is too weak or is a known default.');
    process.exit(1);
  }
  const memberSecret = memberCookie.getMemberSecret();
  if (!memberSecret || WEAK_PASSWORDS.has(memberSecret)) {
    console.error(
      '[Researchium] Production requires RESEARCHIUM_MEMBER_SECRET (strong, unique) for signed entitlements.'
    );
    process.exit(1);
  }
}

assertProductionAdminConfigured();

const app = express();

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

function buildCorsOptions() {
  const raw = (process.env.CORS_ORIGIN || process.env.SITE_URL || '').trim();
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      return { origin: false, credentials: false };
    }
    return { origin: true };
  }
  const allowed = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  return {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowed.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: false
  };
}

app.use(cors(buildCorsOptions()));
app.use(
  compression({
    threshold: 1024,
    level: 6
  })
);

const scriptSrcExtra = [
  "'self'",
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
  'https://region1.google-analytics.com'
];
const connectSrcExtra = [
  "'self'",
  'https://www.google-analytics.com',
  'https://region1.google-analytics.com',
  'https://analytics.google.com',
  'https://www.googletagmanager.com'
];

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: scriptSrcExtra,
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: connectSrcExtra,
        frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(express.json({ limit: '2mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

app.use('/uploads', uploadsRouter);
app.use('/api/member', memberRouter);
app.use('/api/news', newsRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin', adminLeadsRouter);
app.use('/api/admin', adminImportRouter);
app.use('/api/home', homeRouter);
app.use('/api/blog', blogRouter);
app.use('/api/site', siteRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/youtube', youtubeRouter);
app.use('/api/mcq', mcqRouter);
app.use('/api/why', whyRouter);
app.use('/api', csirRouter);
app.use('/rss.xml', rssRouter);
app.use('/sitemap.xml', sitemapRouter);
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'researchium', uptimeSec: Math.round(process.uptime()) });
});
const STATIC_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const STATIC_CACHEABLE = /\.(?:css|js|woff2?|png|jpe?g|webp|gif|svg|ico|json)$/i;

app.use(
  express.static(PUBLIC_DIR, {
    etag: true,
    lastModified: true,
    maxAge: process.env.NODE_ENV === 'production' ? STATIC_CACHE_MS : 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.jsonld')) {
        res.setHeader('Content-Type', 'application/ld+json; charset=UTF-8');
      }
      if (STATIC_CACHEABLE.test(filePath)) {
        res.setHeader('Cache-Control', `public, max-age=${Math.floor(STATIC_CACHE_MS / 1000)}, immutable`);
      } else if (/\.html$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  })
);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});
app.use((_req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  const msg =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Server error';
  res.status(500).json({ error: msg });
});

const server = app.listen(PORT, () => {
  console.log(`Researchium server http://localhost:${PORT}`);
  if (!getAdminPassword()) {
    console.warn(
      '[Researchium] Admin login disabled until RESEARCHIUM_ADMIN_PASSWORD is set in .env'
    );
  }
  if (!memberCookie.getMemberSecret()) {
    console.warn(
      '[Researchium] Member demo unlock disabled until RESEARCHIUM_MEMBER_SECRET is set in .env'
    );
  }
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      `[Researchium] Port ${PORT} is already in use. Run "npm run start:clean" or free the port before starting.`
    );
    process.exit(1);
  }
  throw err;
});

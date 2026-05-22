const express = require('express');
const adminSessions = require('../lib/adminSessions');
const {
  authenticateAdminCredentials,
  extractAdminToken,
  adminCookieOptions,
  clearAdminCookieOptions
} = require('../lib/adminAuth');

const router = express.Router();
const jsonParser = express.json({ limit: '32kb' });
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const MAX_TRACKED_KEYS = 5000;

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function rateLimitKey(req, loginHint) {
  const ip = clientKey(req);
  const hint =
    loginHint && typeof loginHint === 'string'
      ? loginHint.trim().toLowerCase().slice(0, 128) || '_'
      : '_';
  return `${ip}\t${hint}`;
}

function checkRateLimit(req, loginHint) {
  const key = rateLimitKey(req, loginHint);
  const now = Date.now();
  const rec = loginAttempts.get(key) || { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  if (now > rec.resetAt) {
    rec.count = 0;
    rec.resetAt = now + LOGIN_WINDOW_MS;
  }
  rec.count += 1;
  loginAttempts.set(key, rec);
  if (loginAttempts.size > MAX_TRACKED_KEYS) {
    const oldest = loginAttempts.keys().next().value;
    if (oldest) loginAttempts.delete(oldest);
  }
  if (rec.count > LOGIN_MAX_ATTEMPTS) {
    return Math.ceil((rec.resetAt - now) / 1000);
  }
  return 0;
}

function clearRateLimit(req, loginHint) {
  loginAttempts.delete(rateLimitKey(req, loginHint));
}

function sweepAttempts() {
  const now = Date.now();
  for (const [k, v] of loginAttempts) {
    if (!v || now > v.resetAt) loginAttempts.delete(k);
  }
}
const sweepTimer = setInterval(sweepAttempts, 5 * 60 * 1000);
if (sweepTimer.unref) sweepTimer.unref();

router.post('/login', jsonParser, (req, res) => {
  const body = req.body || {};
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password.trim() : '';

  const retrySec = checkRateLimit(req, username);
  if (retrySec > 0) {
    res.set('Retry-After', String(retrySec));
    return res.status(429).json({ ok: false, error: 'Too many login attempts. Try again later.' });
  }
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Username and password are required' });
  }
  if (!authenticateAdminCredentials(username, password)) {
    return res.status(401).json({ ok: false, error: 'Invalid login ID or password' });
  }
  clearRateLimit(req, username);
  const token = adminSessions.createSession();
  res.setHeader('Set-Cookie', adminCookieOptions(token));
  res.json({ ok: true, token, expiresIn: 86400 });
});

router.post('/logout', (req, res) => {
  const token = extractAdminToken(req);
  if (token) adminSessions.revokeSession(token);
  res.setHeader('Set-Cookie', clearAdminCookieOptions());
  res.json({ ok: true });
});

/** Lets /admin.html verify the session before showing the dashboard. */
router.get('/session', (req, res) => {
  const token = extractAdminToken(req);
  if (!token) {
    return res.status(401).json({ ok: false });
  }
  if (adminSessions.isValidSession(token)) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false });
});

module.exports = router;

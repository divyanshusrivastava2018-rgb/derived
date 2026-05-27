const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const streamStudioJwt = require('../lib/streamStudioJwt');

const router = express.Router();
const jsonParser = express.json({ limit: '16kb' });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
});

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) return false;
  try {
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function getConfiguredCredentials() {
  return {
    email: String(process.env.STREAM_STUDIO_EMAIL || '').trim().toLowerCase(),
    password: String(process.env.STREAM_STUDIO_PASSWORD || '')
  };
}

function credentialsConfigured() {
  const { email, password } = getConfiguredCredentials();
  return Boolean(email && password);
}

router.post('/login', loginLimiter, jsonParser, (req, res) => {
  if (!credentialsConfigured() || !streamStudioJwt.getSigningSecret()) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const body = req.body || {};
  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const expected = getConfiguredCredentials();
  if (
    !timingSafeEqualString(email, expected.email) ||
    !timingSafeEqualString(password, expected.password)
  ) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = streamStudioJwt.signHostToken();
  if (!token) {
    return res.status(503).json({ error: 'Stream studio auth is not configured on the server.' });
  }

  res.json({ success: true, token });
});

router.get('/verify', (req, res) => {
  const token = streamStudioJwt.parseBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = streamStudioJwt.verifyHostToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.json({ valid: true, role: payload.role });
});

module.exports = router;

const express = require('express');
const rateLimit = require('express-rate-limit');
const memberCookie = require('../lib/memberCookie');
const memberInterestStore = require('../lib/memberInterestStore');

const router = express.Router();
const jsonParser = express.json({ limit: '16kb' });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const demoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' }
});

const interestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' }
});

router.get('/status', (req, res) => {
  res.json({ paid: memberCookie.isPaidMember(req) });
});

router.post('/demo-unlock', demoLimiter, (req, res) => {
  if (!memberCookie.demoUnlockAllowed()) {
    return res.status(403).json({ error: 'Demo unlock is disabled in production.' });
  }
  if (!memberCookie.getMemberSecret()) {
    return res.status(503).json({
      error: 'Set RESEARCHIUM_MEMBER_SECRET on the server.'
    });
  }
  res.setHeader('Set-Cookie', memberCookie.memberCookieOptions());
  res.json({ ok: true, paid: true });
});

router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', memberCookie.clearMemberCookieOptions());
  res.json({ ok: true });
});

router.post('/interest', interestLimiter, jsonParser, (req, res) => {
  const email = String((req.body || {}).email || '')
    .trim()
    .toLowerCase();
  const source = String((req.body || {}).source || 'signin').trim().slice(0, 64);
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  const result = memberInterestStore.addInterest({ email, source });
  if (result.duplicate) {
    return res.status(200).json({ ok: true, message: 'Already on our list.' });
  }
  res.status(201).json({ ok: true, message: 'Thanks — we will keep you updated.' });
});

module.exports = router;

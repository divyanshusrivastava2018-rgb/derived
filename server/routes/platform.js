const express = require('express');
const rateLimit = require('express-rate-limit');
const { buildOverview, getBenefitBySlug } = require('../lib/platformFeatures');
const progressStore = require('../lib/progressStore');
const learnerTicket = require('../lib/learnerTicket');

const router = express.Router();
const jsonParser = express.json({ limit: '16kb' });

const progressLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many progress updates. Try again later.' }
});

const sessionMintLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' }
});

function resolveLearnerId(body, query) {
  const token =
    (body && body.learnerToken) ||
    (query && (query.learnerToken || query.token)) ||
    '';
  if (token) {
    return learnerTicket.verifyLearnerToken(String(token).trim());
  }
  if (process.env.NODE_ENV !== 'production') {
    const raw = (body && body.learnerId) || (query && (query.learnerId || query.id));
    return progressStore.normalizeLearnerId(raw);
  }
  return null;
}

router.get('/overview', (_req, res) => {
  try {
    res.json(buildOverview());
  } catch (err) {
    console.error('[platform/overview]', err);
    res.status(500).json({ error: 'Could not load platform overview.' });
  }
});

router.get('/features/:slug', (req, res) => {
  const feature = getBenefitBySlug(req.params.slug);
  if (!feature) return res.status(404).json({ error: 'Feature not found' });
  res.json(feature);
});

/** Mint signed learner token (store in localStorage). */
router.get('/progress/session', sessionMintLimiter, (_req, res) => {
  const learnerToken = learnerTicket.mintLearnerToken();
  if (!learnerToken) {
    return res.status(503).json({
      error: 'Progress tracking requires RESEARCHIUM_MEMBER_SECRET on the server.'
    });
  }
  res.json({ ok: true, learnerToken });
});

router.post('/progress', progressLimiter, jsonParser, (req, res) => {
  const body = req.body || {};
  const learnerId = resolveLearnerId(body, null);
  if (!learnerId) {
    return res.status(401).json({ error: 'Valid learnerToken is required.' });
  }
  const result = progressStore.recordEvent(learnerId, {
    type: body.type,
    label: body.label,
    score: body.score,
    total: body.total,
    meta: body.meta
  });
  if (!result.ok) return res.status(400).json({ error: result.error || 'Invalid request' });
  res.status(201).json({ ok: true, event: result.event });
});

router.get('/progress', progressLimiter, (req, res) => {
  const learnerId = resolveLearnerId(null, req.query);
  if (!learnerId) {
    return res.status(401).json({ error: 'Valid learnerToken is required.' });
  }
  res.json(progressStore.getSummary(learnerId));
});

module.exports = router;

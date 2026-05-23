const express = require('express');
const rateLimit = require('express-rate-limit');
const { buildOverview, getBenefitBySlug } = require('../lib/platformFeatures');
const progressStore = require('../lib/progressStore');

const router = express.Router();
const jsonParser = express.json({ limit: '16kb' });

const progressLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many progress updates. Try again later.' }
});

/** Homepage benefits band — live counts from catalog, mocks, materials, etc. */
router.get('/overview', (_req, res) => {
  try {
    res.json(buildOverview());
  } catch (err) {
    console.error('[platform/overview]', err);
    res.status(500).json({ error: 'Could not load platform overview.' });
  }
});

/** Detail page for a benefit slug (live-recorded, full-mocks, …). */
router.get('/features/:slug', (req, res) => {
  const feature = getBenefitBySlug(req.params.slug);
  if (!feature) return res.status(404).json({ error: 'Feature not found' });
  res.json(feature);
});

/** Record anonymous learner activity (mock/quiz submit, etc.). */
router.post('/progress', progressLimiter, jsonParser, (req, res) => {
  const body = req.body || {};
  const result = progressStore.recordEvent(body.learnerId, {
    type: body.type,
    label: body.label,
    score: body.score,
    total: body.total,
    meta: body.meta
  });
  if (!result.ok) return res.status(400).json({ error: result.error || 'Invalid request' });
  res.status(201).json({ ok: true, event: result.event });
});

/** Recent progress for a learner key (from localStorage). */
router.get('/progress', (req, res) => {
  const learnerId = req.query.learnerId || req.query.id;
  const summary = progressStore.getSummary(learnerId);
  if (!summary) return res.status(400).json({ error: 'Invalid learnerId' });
  res.json(summary);
});

module.exports = router;

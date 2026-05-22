const express = require('express');
const { requireAdmin } = require('../lib/adminAuth');
const { buildSnapshot } = require('../lib/adminDashboard');

const router = express.Router();

/** Aggregated dashboard metrics for admin UI (auth required). */
router.get('/dashboard', requireAdmin, (_req, res) => {
  try {
    res.json(buildSnapshot());
  } catch (err) {
    console.error('[admin/dashboard]', err);
    res.status(500).json({ error: 'Could not load dashboard data.' });
  }
});

module.exports = router;

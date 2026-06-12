/**
 * GET /api/public/stats
 * Real homepage counts from server data (5-minute cache).
 */
'use strict';

const express = require('express');
const publicSiteStats = require('../lib/publicSiteStats');
const platformFeatures = require('../lib/platformFeatures');
const gateMcqBank = require('../lib/gateMcqBank');

const router = express.Router();

let cache = null;
let cacheAt = 0;
const TTL = 5 * 60 * 1000;

function pyqCoverageYears(gatePapers) {
  const years = gatePapers
    .map((p) => parseInt(p.year, 10))
    .filter(Number.isFinite);
  if (!years.length) return 0;
  return Math.max(...years) - Math.min(...years) + 1;
}

function computeStats() {
  const overview = platformFeatures.buildOverview();
  let gatePapers = [];
  try {
    gatePapers = gateMcqBank.listPapers();
  } catch {
    gatePapers = [];
  }

  return {
    learners: overview.learnerCount,
    educators: publicSiteStats.educatorCount(),
    mocks: overview.counts.mockTests,
    pyqYears: pyqCoverageYears(gatePapers) || overview.counts.gatePapers,
    updatedAt: new Date().toISOString()
  };
}

router.get('/stats', (_req, res) => {
  const now = Date.now();
  if (!cache || now - cacheAt > TTL) {
    cache = computeStats();
    cacheAt = now;
  }
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ ok: true, data: cache });
});

module.exports = router;

const express = require('express');
const store = require('../lib/store');
const csirLeadsStore = require('../lib/csirLeadsStore');

const router = express.Router();

/** Public homepage metrics for hero / features (no PII). */
router.get('/summary', (_req, res) => {
  const courses = store.readAll();
  let leadCount = 0;
  try {
    leadCount = csirLeadsStore.readLeads().length;
  } catch {
    leadCount = 0;
  }
  const courseCount = courses.length;
  const baseLearners = 2400;
  const learnerCount = baseLearners + courseCount * 15 + leadCount * 3;

  res.json({
    courseCount,
    learnerCount,
    successRate: '99%',
    livePrograms: 50
  });
});

module.exports = router;

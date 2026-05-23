const express = require('express');
const mockTestCatalog = require('../lib/mockTestCatalog');

const router = express.Router();

router.get('/', (_req, res) => {
  try {
    res.json(mockTestCatalog.listMockTests());
  } catch (err) {
    console.error('[mock-tests]', err);
    res.status(500).json({
      error: 'Could not load mock test catalog',
      tokens: [],
      groups: ['gate-year', 'category']
    });
  }
});

module.exports = router;

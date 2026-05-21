const express = require('express');
const mockTestCatalog = require('../lib/mockTestCatalog');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json(mockTestCatalog.listMockTests());
});

module.exports = router;

const express = require('express');
const { requireAdmin } = require('../lib/adminAuth');
const csirLeadsStore = require('../lib/csirLeadsStore');
const memberInterestStore = require('../lib/memberInterestStore');

const router = express.Router();

router.get('/csir-leads', requireAdmin, (_req, res) => {
  res.json(csirLeadsStore.readLeads());
});

router.get('/member-interest', requireAdmin, (_req, res) => {
  res.json(memberInterestStore.readAll());
});

module.exports = router;

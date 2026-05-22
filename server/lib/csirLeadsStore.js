const fs = require('fs');
const path = require('path');
const { writeJsonPrivate, readJsonPrivate } = require('./secureDataFile');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'csir-leads.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}

function readLeads() {
  ensureDataDir();
  if (!fs.existsSync(LEADS_FILE)) {
    writeLeads([]);
    return [];
  }
  const data = readJsonPrivate(LEADS_FILE, []);
  return Array.isArray(data) ? data : [];
}

function writeLeads(leads) {
  ensureDataDir();
  writeJsonPrivate(LEADS_FILE, leads);
}

module.exports = { readLeads, writeLeads, LEADS_FILE };

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'csir-leads.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readLeads() {
  ensureDataDir();
  if (!fs.existsSync(LEADS_FILE)) {
    writeLeads([]);
    return [];
  }
  try {
    const raw = fs.readFileSync(LEADS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeLeads(leads) {
  ensureDataDir();
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
}

module.exports = { readLeads, writeLeads, LEADS_FILE };

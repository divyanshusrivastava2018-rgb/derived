const fs = require('fs');
const path = require('path');
const { writeJsonPrivate, readJsonPrivate } = require('./secureDataFile');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'member-interest.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}

function readAll() {
  ensureDataDir();
  if (!fs.existsSync(FILE)) {
    writeAll([]);
    return [];
  }
  const data = readJsonPrivate(FILE, []);
  return Array.isArray(data) ? data : [];
}

function writeAll(rows) {
  ensureDataDir();
  writeJsonPrivate(FILE, rows);
}

function addInterest({ email, source }) {
  const rows = readAll();
  const normalized = String(email || '')
    .trim()
    .toLowerCase();
  if (rows.some((r) => r.email === normalized)) {
    return { created: false, duplicate: true };
  }
  const row = {
    id: rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1,
    email: normalized,
    source: String(source || 'signin').slice(0, 64),
    createdAt: new Date().toISOString()
  };
  rows.push(row);
  writeAll(rows);
  return { created: true, row };
}

module.exports = { readAll, writeAll, addInterest, FILE };

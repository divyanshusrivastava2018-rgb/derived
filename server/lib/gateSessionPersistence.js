/**
 * Optional file-backed GATE sessions (survives single-process restarts).
 * Set GATE_SESSION_STORE=file for one Node instance; use Redis for multi-instance.
 */
const fs = require('fs');
const path = require('path');
const { readJsonPrivate, writeJsonPrivate } = require('./secureDataFile');

const FILE = path.join(__dirname, '..', 'data', 'gate-sessions.json');

function useFileStore() {
  return String(process.env.GATE_SESSION_STORE || '').trim().toLowerCase() === 'file';
}

function readDb() {
  if (!fs.existsSync(FILE)) {
    return { sessions: {}, reviews: {} };
  }
  const data = readJsonPrivate(FILE, { sessions: {}, reviews: {} });
  if (!data || typeof data !== 'object') return { sessions: {}, reviews: {} };
  if (!data.sessions || typeof data.sessions !== 'object') data.sessions = {};
  if (!data.reviews || typeof data.reviews !== 'object') data.reviews = {};
  return data;
}

function writeDb(data) {
  writeJsonPrivate(FILE, data);
}

function getSession(id) {
  if (!useFileStore()) return null;
  const db = readDb();
  return db.sessions[id] || null;
}

function setSession(id, record) {
  if (!useFileStore()) return;
  const db = readDb();
  db.sessions[id] = record;
  writeDb(db);
}

function deleteSession(id) {
  if (!useFileStore()) return;
  const db = readDb();
  delete db.sessions[id];
  writeDb(db);
}

function getReview(id) {
  if (!useFileStore()) return null;
  const db = readDb();
  return db.reviews[id] || null;
}

function setReview(id, record) {
  if (!useFileStore()) return;
  const db = readDb();
  db.reviews[id] = record;
  writeDb(db);
}

function deleteReview(id) {
  if (!useFileStore()) return;
  const db = readDb();
  delete db.reviews[id];
  writeDb(db);
}

function cleanupExpired(now) {
  if (!useFileStore()) return;
  const db = readDb();
  let changed = false;
  for (const [id, s] of Object.entries(db.sessions)) {
    if (!s || now > s.expiresAt) {
      delete db.sessions[id];
      changed = true;
    }
  }
  for (const [id, r] of Object.entries(db.reviews)) {
    if (!r || now > r.expiresAt) {
      delete db.reviews[id];
      changed = true;
    }
  }
  if (changed) writeDb(db);
}

module.exports = {
  useFileStore,
  getSession,
  setSession,
  deleteSession,
  getReview,
  setReview,
  deleteReview,
  cleanupExpired
};

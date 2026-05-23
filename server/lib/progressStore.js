const fs = require('fs');
const path = require('path');
const { writeJsonPrivate, readJsonPrivate } = require('./secureDataFile');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'learner-progress.json');
const MAX_EVENTS = 500;
const MAX_LEARNERS = 5000;

const ALLOWED_TYPES = new Set([
  'mock_submit',
  'gate_submit',
  'quiz_submit',
  'material_open',
  'course_open'
]);

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}

function readAll() {
  ensureDataDir();
  if (!fs.existsSync(FILE)) {
    writeAll({ learners: {} });
    return { learners: {} };
  }
  const data = readJsonPrivate(FILE, { learners: {} });
  if (!data || typeof data !== 'object') return { learners: {} };
  if (!data.learners || typeof data.learners !== 'object') data.learners = {};
  return data;
}

function writeAll(data) {
  ensureDataDir();
  writeJsonPrivate(FILE, data);
}

function normalizeLearnerId(id) {
  const s = String(id || '').trim();
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(s)) return null;
  return s;
}

function recordEvent(learnerId, payload) {
  const lid = normalizeLearnerId(learnerId);
  if (!lid) return { ok: false, error: 'Invalid learnerId' };

  const type = String(payload.type || '').trim();
  if (!ALLOWED_TYPES.has(type)) return { ok: false, error: 'Invalid event type' };

  const label = String(payload.label || '').trim().slice(0, 200);
  if (!label) return { ok: false, error: 'label is required' };

  const event = {
    type,
    label,
    score: payload.score != null ? Number(payload.score) : null,
    total: payload.total != null ? Number(payload.total) : null,
    meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : null,
    at: new Date().toISOString()
  };

  const db = readAll();
  const learners = db.learners;
  if (!learners[lid]) {
    if (Object.keys(learners).length >= MAX_LEARNERS) {
      const oldest = Object.keys(learners).sort(
        (a, b) => new Date(learners[a].updatedAt || 0) - new Date(learners[b].updatedAt || 0)
      )[0];
      if (oldest) delete learners[oldest];
    }
    learners[lid] = { events: [], updatedAt: event.at };
  }

  const rec = learners[lid];
  rec.events = Array.isArray(rec.events) ? rec.events : [];
  rec.events.unshift(event);
  if (rec.events.length > MAX_EVENTS) rec.events.length = MAX_EVENTS;
  rec.updatedAt = event.at;
  writeAll(db);

  return { ok: true, event };
}

function getSummary(learnerId) {
  const lid = normalizeLearnerId(learnerId);
  if (!lid) return null;
  const db = readAll();
  const rec = db.learners[lid];
  if (!rec || !Array.isArray(rec.events)) {
    return { learnerId: lid, totalEvents: 0, recent: [], byType: {} };
  }

  const byType = {};
  rec.events.forEach((e) => {
    byType[e.type] = (byType[e.type] || 0) + 1;
  });

  return {
    learnerId: lid,
    totalEvents: rec.events.length,
    updatedAt: rec.updatedAt,
    byType,
    recent: rec.events.slice(0, 12)
  };
}

module.exports = {
  FILE,
  ALLOWED_TYPES,
  normalizeLearnerId,
  recordEvent,
  getSummary
};

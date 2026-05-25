/**
 * GATE exam sessions and post-submit review tokens (in-memory + optional file store).
 * Use GATE_SESSION_STORE=file on a single Node host, or Redis for multiple instances.
 */
const { nanoid } = require('nanoid');
const persistence = require('./gateSessionPersistence');

const SESSION_TTL_MS = 3 * 60 * 60 * 1000;
const REVIEW_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_SOLVES_PER_REVIEW = Math.min(
  120,
  Math.max(1, parseInt(process.env.GATE_MAX_SOLVES_PER_REVIEW || '30', 10) || 30)
);
const VALID_DIFFICULTIES = new Set(['standard', 'detailed', 'brief']);

const ACTIVE_SESSIONS = new Map();
const REVIEW_ACCESS = new Map();

function allowStatelessSubmit() {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  if (process.env.GATE_ALLOW_STATELESS_SUBMIT === '1') {
    return true;
  }
  return process.env.NODE_ENV !== 'production';
}

function paperForScoring(fullPaper) {
  return {
    year: fullPaper.year,
    slug: fullPaper.slug,
    title: fullPaper.title,
    subject: fullPaper.subject,
    subjectLabel: fullPaper.subjectLabel,
    sections: fullPaper.sections,
    answerKey: fullPaper.answerKey
  };
}

function questionIdsOnPaper(scoringPaper) {
  const ids = new Set();
  (scoringPaper.sections || []).forEach((sec) => {
    (sec.questions || []).forEach((q) => {
      if (q && q.id != null) ids.add(String(q.id));
    });
  });
  return ids;
}

/** Only allow known question ids; option indices -1 (skip) or 0..9. */
function validateResponses(raw, scoringPaper) {
  const allowed = questionIdsOnPaper(scoringPaper);
  const out = {};
  if (!raw || typeof raw !== 'object') return out;

  for (const [key, value] of Object.entries(raw)) {
    const qid = String(key).trim();
    if (!allowed.has(qid)) continue;
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    const idx = Math.trunc(n);
    if (idx < -1 || idx > 9) continue;
    out[qid] = idx;
  }
  return out;
}

function sanitizeDifficulty(value) {
  const d = String(value || 'standard').trim().toLowerCase();
  return VALID_DIFFICULTIES.has(d) ? d : 'standard';
}

function loadSession(id) {
  const mem = ACTIVE_SESSIONS.get(id);
  if (mem) return mem;
  const fileRec = persistence.getSession(id);
  if (!fileRec) return null;
  ACTIVE_SESSIONS.set(id, fileRec);
  return fileRec;
}

function saveSession(id, record) {
  ACTIVE_SESSIONS.set(id, record);
  persistence.setSession(id, record);
}

function deleteSessionEverywhere(id) {
  ACTIVE_SESSIONS.delete(id);
  persistence.deleteSession(id);
}

function loadReview(id) {
  const mem = REVIEW_ACCESS.get(id);
  if (mem) return mem;
  const fileRec = persistence.getReview(id);
  if (!fileRec) return null;
  REVIEW_ACCESS.set(id, fileRec);
  return fileRec;
}

function saveReview(id, record) {
  REVIEW_ACCESS.set(id, record);
  persistence.setReview(id, record);
}

function deleteReviewEverywhere(id) {
  REVIEW_ACCESS.delete(id);
  persistence.deleteReview(id);
}

function createSession(fullPaper) {
  const sessionId = nanoid(24);
  const record = {
    slug: fullPaper.slug,
    scoring: paperForScoring(fullPaper),
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  };
  saveSession(sessionId, record);
  return sessionId;
}

function consumeSession(sessionId, slug) {
  const id = String(sessionId || '').trim();
  if (!id) return null;
  const session = loadSession(id);
  if (!session || Date.now() > session.expiresAt) {
    deleteSessionEverywhere(id);
    return null;
  }
  if (session.slug !== slug) return null;
  deleteSessionEverywhere(id);
  return session.scoring;
}

function issueReviewToken(slug) {
  const token = nanoid(32);
  const record = {
    slug: String(slug),
    expiresAt: Date.now() + REVIEW_TTL_MS,
    solveCount: 0
  };
  saveReview(token, record);
  return token;
}

function validateReviewToken(token, slug) {
  const id = String(token || '').trim();
  if (!id) return false;
  const rec = loadReview(id);
  if (!rec || Date.now() > rec.expiresAt) {
    deleteReviewEverywhere(id);
    return false;
  }
  if (rec.slug !== String(slug)) return false;
  return true;
}

function consumeSolveSlot(token, slug) {
  const id = String(token || '').trim();
  const rec = loadReview(id);
  if (!rec || rec.slug !== String(slug) || Date.now() > rec.expiresAt) {
    deleteReviewEverywhere(id);
    return false;
  }
  if (rec.solveCount >= MAX_SOLVES_PER_REVIEW) return false;
  rec.solveCount += 1;
  saveReview(id, rec);
  return true;
}

function cleanup() {
  const now = Date.now();
  for (const [id, s] of ACTIVE_SESSIONS) {
    if (!s || now > s.expiresAt) ACTIVE_SESSIONS.delete(id);
  }
  for (const [id, r] of REVIEW_ACCESS) {
    if (!r || now > r.expiresAt) REVIEW_ACCESS.delete(id);
  }
  persistence.cleanupExpired(now);
}

const cleanupTimer = setInterval(cleanup, 10 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

module.exports = {
  allowStatelessSubmit,
  validateResponses,
  sanitizeDifficulty,
  createSession,
  consumeSession,
  issueReviewToken,
  validateReviewToken,
  consumeSolveSlot,
  cleanup,
  MAX_SOLVES_PER_REVIEW,
  /** @internal smoke tests */
  _resetForTests() {
    ACTIVE_SESSIONS.clear();
    REVIEW_ACCESS.clear();
  }
};

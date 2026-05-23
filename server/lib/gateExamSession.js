/**
 * GATE exam sessions and post-submit review tokens (in-memory).
 * Use Redis when running multiple Node instances behind a load balancer.
 */
const { nanoid } = require('nanoid');

const SESSION_TTL_MS = 3 * 60 * 60 * 1000;
const REVIEW_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_SOLVES_PER_REVIEW = 60;
const VALID_DIFFICULTIES = new Set(['standard', 'detailed', 'brief']);

const ACTIVE_SESSIONS = new Map();
const REVIEW_ACCESS = new Map();

function allowStatelessSubmit() {
  if (process.env.GATE_ALLOW_STATELESS_SUBMIT === '1') return true;
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

function createSession(fullPaper) {
  const sessionId = nanoid(24);
  ACTIVE_SESSIONS.set(sessionId, {
    slug: fullPaper.slug,
    scoring: paperForScoring(fullPaper),
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return sessionId;
}

function consumeSession(sessionId, slug) {
  const id = String(sessionId || '').trim();
  if (!id) return null;
  const session = ACTIVE_SESSIONS.get(id);
  if (!session || Date.now() > session.expiresAt) {
    ACTIVE_SESSIONS.delete(id);
    return null;
  }
  if (session.slug !== slug) return null;
  ACTIVE_SESSIONS.delete(id);
  return session.scoring;
}

function issueReviewToken(slug) {
  const token = nanoid(32);
  REVIEW_ACCESS.set(token, {
    slug: String(slug),
    expiresAt: Date.now() + REVIEW_TTL_MS,
    solveCount: 0
  });
  return token;
}

function validateReviewToken(token, slug) {
  const id = String(token || '').trim();
  if (!id) return false;
  const rec = REVIEW_ACCESS.get(id);
  if (!rec || Date.now() > rec.expiresAt) {
    REVIEW_ACCESS.delete(id);
    return false;
  }
  if (rec.slug !== String(slug)) return false;
  return true;
}

function consumeSolveSlot(token, slug) {
  const id = String(token || '').trim();
  const rec = REVIEW_ACCESS.get(id);
  if (!rec || rec.slug !== String(slug) || Date.now() > rec.expiresAt) {
    REVIEW_ACCESS.delete(id);
    return false;
  }
  if (rec.solveCount >= MAX_SOLVES_PER_REVIEW) return false;
  rec.solveCount += 1;
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
  /** @internal smoke tests */
  _resetForTests() {
    ACTIVE_SESSIONS.clear();
    REVIEW_ACCESS.clear();
  }
};

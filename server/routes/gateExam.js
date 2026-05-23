/**
 * GATE MCQ exam API — list papers, start session, submit (answers server-only).
 * Mounted at /api/mcq/gate (see server/routes/mcq.js).
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { nanoid } = require('nanoid');
const gateMcqBank = require('../lib/gateMcqBank');

const router = express.Router();
const jsonParser = express.json({ limit: '256kb' });

const startLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many exam starts. Try again later.' }
});

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Try again later.' }
});

/** In-memory sessions — use Redis/DB if you run multiple Node instances. */
const ACTIVE_SESSIONS = new Map();
const SESSION_TTL_MS = 3 * 60 * 60 * 1000;

function cleanupSessions() {
  const now = Date.now();
  for (const [id, s] of ACTIVE_SESSIONS) {
    if (!s || now > s.expiresAt) ACTIVE_SESSIONS.delete(id);
  }
}

setInterval(cleanupSessions, 10 * 60 * 1000).unref?.();

function stripAnswers(paper) {
  return {
    year: paper.year,
    slug: paper.slug,
    title: paper.title,
    subject: paper.subject,
    subjectLabel: paper.subjectLabel,
    durationMinutes: paper.durationMinutes,
    sections: paper.sections.map((sec) => ({
      key: sec.key,
      label: sec.label,
      marks1Count: sec.marks1Count,
      marks2Count: sec.marks2Count,
      questions: sec.questions.map((q) => ({
        id: q.id,
        number: q.number,
        sectionKey: q.sectionKey,
        sectionLabel: q.sectionLabel,
        type: q.type,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        text: q.text,
        options: q.options
      }))
    }))
  };
}

/** Always JSON errors (never HTML) for the browser error helper. */
function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

router.get('/healthz', (_req, res) => {
  res.json({ ok: true, service: 'gate-mcq', ts: Date.now() });
});

router.get('/papers', (_req, res) => {
  res.json({ papers: gateMcqBank.listPapers() });
});

router.get('/paper/:slug', (req, res) => {
  const slug = String(req.params.slug || '').trim();
  const paper = gateMcqBank.getPaper(slug);
  if (!paper) return jsonError(res, 404, 'Paper not found.');
  res.json(stripAnswers(paper));
});

router.post('/paper/:slug/start', startLimiter, jsonParser, (req, res) => {
  const slug = String(req.params.slug || '').trim();
  const paper = gateMcqBank.getPaper(slug);
  if (!paper) return jsonError(res, 404, 'Paper not found.');

  const sessionId = nanoid(20);
  ACTIVE_SESSIONS.set(sessionId, {
    slug: paper.slug,
    paper,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS
  });

  res.json({
    ok: true,
    sessionId,
    paper: stripAnswers(paper)
  });
});

router.post('/paper/:slug/submit', submitLimiter, jsonParser, (req, res) => {
  const slug = String(req.params.slug || '').trim();
  const body = req.body || {};
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const responses = body.responses && typeof body.responses === 'object' ? body.responses : {};

  let paper = null;
  const session = sessionId ? ACTIVE_SESSIONS.get(sessionId) : null;

  if (session) {
    if (session.slug !== slug) {
      return jsonError(
        res,
        400,
        'Session does not match this paper. Please start the exam again.'
      );
    }
    paper = session.paper;
    ACTIVE_SESSIONS.delete(sessionId);
  } else {
    paper = gateMcqBank.getPaper(slug);
    if (!paper) {
      return jsonError(
        res,
        404,
        'Exam session not found and paper "' +
          slug +
          '" does not exist. Please refresh and start the mock exam again.'
      );
    }
  }

  const result = gateMcqBank.scorePaper(paper, responses);
  res.json({ ok: true, ...result, year: paper.year, title: paper.title });
});

module.exports = router;

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

const ACTIVE_SESSIONS = new Map();
const SESSION_TTL_MS = 3 * 60 * 60 * 1000;

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

function cleanupSessions() {
  const now = Date.now();
  for (const [id, s] of ACTIVE_SESSIONS) {
    if (!s || now > s.expiresAt) ACTIVE_SESSIONS.delete(id);
  }
}

setInterval(cleanupSessions, 10 * 60 * 1000).unref?.();

router.get('/papers', (_req, res) => {
  res.json({ papers: gateMcqBank.listPapers() });
});

router.get('/paper/:slug', (req, res) => {
  const paper = gateMcqBank.getPaper(req.params.slug);
  if (!paper) return res.status(404).json({ error: 'Paper not found' });
  res.json(stripAnswers(paper));
});

router.post('/paper/:slug/start', startLimiter, jsonParser, (req, res) => {
  const paper = gateMcqBank.getPaper(req.params.slug);
  if (!paper) return res.status(404).json({ error: 'Paper not found' });
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
  const body = req.body || {};
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  const responses = body.responses && typeof body.responses === 'object' ? body.responses : {};

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required. Start the paper first.' });
  }
  const session = ACTIVE_SESSIONS.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session expired. Start again.' });
  if (session.slug !== req.params.slug) {
    return res.status(400).json({ error: 'Session does not match this paper.' });
  }
  const paper = session.paper;
  ACTIVE_SESSIONS.delete(sessionId);

  const result = gateMcqBank.scorePaper(paper, responses);
  res.json({ ok: true, ...result, year: paper.year, title: paper.title });
});

module.exports = router;

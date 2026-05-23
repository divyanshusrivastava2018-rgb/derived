/**
 * GATE MCQ exam API — list papers, start session, submit (answers server-only).
 * Mounted at /api/mcq/gate (see server/routes/mcq.js).
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const gateMcqBank = require('../lib/gateMcqBank');
const { buildSolutionDetailAsync } = require('../lib/gateSolutionBuilder');
const gateQuestionSolver = require('../lib/gateQuestionSolver');
const gateExamSession = require('../lib/gateExamSession');

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

const solveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many solution requests. Try again later.' }
});

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

function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

function productionMode() {
  return process.env.NODE_ENV === 'production';
}

router.get('/healthz', (_req, res) => {
  const body = { ok: true, service: 'gate-mcq', ts: Date.now() };
  if (!productionMode()) {
    body.aiSolver = gateQuestionSolver.isConfigured();
  }
  res.json(body);
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

  const sessionId = gateExamSession.createSession(paper);

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
  const rawResponses = body.responses && typeof body.responses === 'object' ? body.responses : {};

  let scoringPaper = gateExamSession.consumeSession(sessionId, slug);

  if (!scoringPaper) {
    if (!gateExamSession.allowStatelessSubmit()) {
      return jsonError(
        res,
        403,
        'A valid exam session is required. Start the examination again before submitting.'
      );
    }
    const paper = gateMcqBank.getPaper(slug);
    if (!paper) {
      return jsonError(res, 404, 'Paper not found. Refresh and start the mock exam again.');
    }
    scoringPaper = {
      year: paper.year,
      slug: paper.slug,
      title: paper.title,
      subject: paper.subject,
      subjectLabel: paper.subjectLabel,
      sections: paper.sections,
      answerKey: paper.answerKey
    };
  }

  const responses = gateExamSession.validateResponses(rawResponses, scoringPaper);
  const result = gateMcqBank.scorePaper(scoringPaper, responses);
  const reviewToken = gateExamSession.issueReviewToken(slug);

  const payload = {
    ok: true,
    ...result,
    year: scoringPaper.year,
    title: scoringPaper.title,
    reviewToken
  };
  if (!productionMode()) {
    payload.aiSolver = gateQuestionSolver.isConfigured();
  }
  res.json(payload);
});

router.post('/paper/:slug/solve-question', solveLimiter, jsonParser, async (req, res) => {
  const slug = String(req.params.slug || '').trim();
  const body = req.body || {};
  const questionId = String(body.questionId || '').trim();
  const reviewToken = typeof body.reviewToken === 'string' ? body.reviewToken.trim() : '';
  const difficulty = gateExamSession.sanitizeDifficulty(body.difficulty);

  if (!questionId) return jsonError(res, 400, 'questionId is required.');
  if (!reviewToken) {
    return jsonError(res, 403, 'Submit the examination first to unlock step-by-step solutions.');
  }
  if (!gateExamSession.validateReviewToken(reviewToken, slug)) {
    return jsonError(res, 403, 'Review access expired or invalid. Submit the exam again.');
  }
  if (!gateExamSession.consumeSolveSlot(reviewToken, slug)) {
    return jsonError(res, 429, 'Solution limit reached for this attempt.');
  }

  const paper = gateMcqBank.getPaper(slug);
  if (!paper) return jsonError(res, 404, 'Paper not found.');

  let question = null;
  let correctIndex = -1;
  for (const sec of paper.sections) {
    for (const q of sec.questions) {
      if (q.id === questionId) {
        question = q;
        correctIndex = paper.answerKey[q.id];
        break;
      }
    }
    if (question) break;
  }

  if (!question) return jsonError(res, 404, 'Question not found on this paper.');

  try {
    const detail = await buildSolutionDetailAsync(question, correctIndex, {
      subject: paper.subjectLabel || paper.title,
      difficulty
    });
    const out = { ok: true, questionId, ...detail };
    if (!productionMode()) {
      out.aiConfigured = gateQuestionSolver.isConfigured();
    }
    res.json(out);
  } catch (err) {
    console.error('[gateExam] solve-question', questionId, err.message);
    return jsonError(res, 500, 'Could not generate solution. Try again shortly.');
  }
});

module.exports = router;

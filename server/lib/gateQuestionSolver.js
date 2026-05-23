/**
 * GATE step-by-step question solver (server-only).
 * Uses ANTHROPIC_API_KEY or OPENAI_API_KEY — never exposed to the browser.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(__dirname, '..', 'data', 'gate-solution-cache');
const CACHE_VERSION = 1;

const DETAIL_MAP = {
  standard: 'Provide clear step-by-step reasoning with medium depth.',
  detailed: 'Provide very detailed steps, explaining every theorem and formula used.',
  brief: 'Give a concise solution focusing on the key insight and answer.'
};

function optionLetter(i) {
  return i >= 0 && i < 26 ? String.fromCharCode(65 + i) : String(i + 1);
}

function anthropicKey() {
  return (process.env.ANTHROPIC_API_KEY || '').trim();
}

function openaiKey() {
  return (process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '').trim();
}

function isConfigured() {
  return Boolean(anthropicKey() || openaiKey());
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cachePath(questionId) {
  const safe = String(questionId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(CACHE_DIR, `${safe}.json`);
}

function getCached(questionId) {
  try {
    const p = cachePath(questionId);
    if (!fs.existsSync(p)) return null;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (data && data.v === CACHE_VERSION && data.payload) return data.payload;
  } catch {
    /* ignore */
  }
  return null;
}

function setCached(questionId, payload) {
  try {
    ensureCacheDir();
    fs.writeFileSync(
      cachePath(questionId),
      JSON.stringify({ v: CACHE_VERSION, at: Date.now(), payload }, null, 0),
      'utf8'
    );
  } catch (err) {
    console.warn('[gateQuestionSolver] cache write failed:', err.message);
  }
}

/** Parse model output (UNDERSTANDING / SOLUTION / CORRECT ANSWER / KEY CONCEPT). */
function parseSolverResponse(text) {
  const raw = String(text || '').trim();
  const understanding = extractSection(raw, 'UNDERSTANDING');
  const solution = extractSection(raw, 'SOLUTION');
  const correctAnswer = extractSection(raw, 'CORRECT ANSWER');
  const keyConcept = extractSection(raw, 'KEY CONCEPT');

  return {
    raw,
    understanding,
    solution,
    correctAnswer: correctAnswer.split('\n')[0].trim(),
    keyConcept: keyConcept.split('\n')[0].trim()
  };
}

function extractSection(text, name) {
  const re = new RegExp(`${name}\\s*:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z\\s]+:|$)`, 'i');
  const m = text.match(re);
  return m ? m[1].trim() : '';
}

function buildSystemPrompt(subject, difficulty) {
  const depth = DETAIL_MAP[difficulty] || DETAIL_MAP.standard;
  return (
    `You are an expert GATE exam solver specializing in ${subject || 'GATE Mathematics'}.\n` +
    `${depth}\n\n` +
    'Structure your response EXACTLY as:\n\n' +
    'UNDERSTANDING:\n' +
    '[What the question is asking and what concepts are involved]\n\n' +
    'SOLUTION:\n' +
    '[Numbered steps solving the problem rigorously]\n\n' +
    'CORRECT ANSWER:\n' +
    '[State which option number (1-4) and full option text is correct]\n\n' +
    'KEY CONCEPT:\n' +
    '[One sentence naming the core concept tested]\n\n' +
    'Use plain text. Be mathematically rigorous. No markdown symbols like ** or ##.'
  );
}

function buildUserMessage(q, subject) {
  const opts = (q.options || []).map((t, i) => `${i + 1}. ${t}`).join('\n');
  return (
    `Subject: ${subject || 'GATE'}\n\n` +
    `Question: ${q.text || ''}\n` +
    (opts ? `\nOptions:\n${opts}\n` : '\n') +
    '\nSolve this step by step.'
  );
}

async function callAnthropic(system, user) {
  const key = anthropicKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: (process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514').trim(),
        max_tokens: 1200,
        system,
        messages: [{ role: 'user', content: user }]
      }),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || `Anthropic error ${res.status}`);
    return (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(system, user) {
  const key = openaiKey();
  const base = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      }),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || `OpenAI error ${res.status}`);
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty model response');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function callSolverApi(system, user) {
  if (anthropicKey()) return callAnthropic(system, user);
  if (openaiKey()) return callOpenAI(system, user);
  throw new Error('No AI API key configured');
}

/**
 * Build review fields consumed by gate-exam-solution.js (existing frontend).
 */
function formatForReview(q, correctIndex, parsed) {
  const opts = q.options || [];
  const ci = correctIndex >= 0 ? correctIndex : 0;
  const correctLetter = optionLetter(ci);
  const correctText = opts[ci] != null ? String(opts[ci]) : '';

  const explanationParts = [];
  if (parsed.understanding) {
    explanationParts.push('Understanding:\n' + parsed.understanding);
  }
  if (parsed.solution) {
    explanationParts.push('Solution:\n' + parsed.solution);
  }
  if (!explanationParts.length && parsed.raw) {
    explanationParts.push(parsed.raw);
  }

  const optionExplanations = opts.map((text, i) => {
    const letter = optionLetter(i);
    const plain = String(text);
    if (i === ci) {
      return `${letter}. ${plain} — Correct. ${parsed.correctAnswer || 'Matches the keyed answer for this mock.'}`;
    }
    return `${letter}. ${plain} — Incorrect. Eliminate after applying the solution steps; correct is ${correctLetter} (${correctText}).`;
  });

  return {
    explanation: explanationParts.join('\n\n'),
    optionExplanations,
    understanding: parsed.understanding || '',
    solutionText: parsed.solution || '',
    keyConcept: parsed.keyConcept || '',
    correctAnswerLine: parsed.correctAnswer || `(${ci + 1}) ${correctText}`,
    solutionSource: 'ai'
  };
}

/**
 * @param {object} q — { id, text, options, sectionLabel, type }
 * @param {number} correctIndex
 * @param {{ subject?: string, difficulty?: string }} [opts]
 */
async function solveQuestion(q, correctIndex, opts = {}) {
  if (!q || q.id == null) throw new Error('Invalid question');

  const cached = getCached(q.id);
  if (cached) return { ...cached, solutionSource: 'cache' };

  const subject =
    opts.subject || q.sectionLabel || q.subjectLabel || 'GATE Mathematics';
  const difficulty = opts.difficulty || 'standard';

  const system = buildSystemPrompt(subject, difficulty);
  const user = buildUserMessage(q, subject);
  const rawText = await callSolverApi(system, user);
  const parsed = parseSolverResponse(rawText);
  const payload = formatForReview(q, correctIndex, parsed);

  setCached(q.id, payload);
  return payload;
}

function cacheKeyHash(parts) {
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16);
}

module.exports = {
  isConfigured,
  parseSolverResponse,
  formatForReview,
  solveQuestion,
  getCached,
  setCached,
  cacheKeyHash
};

const fs = require('fs');
const path = require('path');
const gateQuestionSolver = require('./gateQuestionSolver');

const SOLUTIONS_FILE = path.join(__dirname, '..', 'data', 'gate-mcq-solutions.json');

let solutionsCache = null;
let solutionsMtime = 0;

function loadSolutionsMap() {
  if (!fs.existsSync(SOLUTIONS_FILE)) return {};
  const stat = fs.statSync(SOLUTIONS_FILE);
  if (solutionsCache && stat.mtimeMs === solutionsMtime) return solutionsCache;
  const raw = JSON.parse(fs.readFileSync(SOLUTIONS_FILE, 'utf8'));
  solutionsCache = raw && raw.solutions && typeof raw.solutions === 'object' ? raw.solutions : {};
  solutionsMtime = stat.mtimeMs;
  return solutionsCache;
}

function optionLetter(i) {
  return i >= 0 && i < 26 ? String.fromCharCode(65 + i) : String(i + 1);
}

function stripLatex(s) {
  return String(s || '')
    .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildFallbackSolution(q, correctIndex) {
  const opts = q.options || [];
  const ci = correctIndex >= 0 ? correctIndex : 0;
  const correctLetter = optionLetter(ci);
  const correctText = opts[ci] != null ? stripLatex(opts[ci]) : '—';

  const optionExplanations = opts.map((text, i) => {
    const letter = optionLetter(i);
    const plain = stripLatex(text);
    if (i === ci) {
      return `${letter}. ${plain} — Correct option. This matches the official answer key for this question.`;
    }
    return `${letter}. ${plain} — Incorrect. This choice does not match the result required by the question; the keyed answer is ${correctLetter} (${correctText}).`;
  });

  const explanation =
    `The correct option is ${correctLetter}: (${ci + 1}) ${correctText}. ` +
    'Work from the question statement, derive the result, then compare each option. ' +
    `Only option ${correctLetter} is consistent with the solution.`;

  return {
    explanation,
    optionExplanations,
    understanding: '',
    solutionText: '',
    keyConcept: '',
    correctAnswerLine: `(${ci + 1}) ${correctText}`,
    solutionSource: 'fallback'
  };
}

/**
 * Sync detail for submit — uses AI cache if already solved, else JSON seed, else fallback.
 */
function buildSolutionDetail(q, correctIndex) {
  const cached = q && q.id != null ? gateQuestionSolver.getCached(q.id) : null;
  if (cached) return { ...cached };

  const map = loadSolutionsMap();
  const authored = q && q.id != null ? map[q.id] : null;
  if (authored && authored.explanation) {
    const optionExplanations =
      Array.isArray(authored.options) && authored.options.length
        ? authored.options
        : buildFallbackSolution(q, correctIndex).optionExplanations;
    return {
      explanation: String(authored.explanation),
      optionExplanations: optionExplanations.map(String),
      understanding: authored.understanding ? String(authored.understanding) : '',
      solutionText: authored.solutionText ? String(authored.solutionText) : '',
      keyConcept: authored.keyConcept ? String(authored.keyConcept) : '',
      correctAnswerLine: authored.correctAnswerLine || '',
      solutionSource: 'authored'
    };
  }
  return buildFallbackSolution(q, correctIndex);
}

/**
 * AI solve (async) — used by /solve-question route.
 */
async function buildSolutionDetailAsync(q, correctIndex, opts = {}) {
  const cached = q && q.id != null ? gateQuestionSolver.getCached(q.id) : null;
  if (cached) return { ...cached, solutionSource: 'cache' };

  if (gateQuestionSolver.isConfigured()) {
    try {
      return await gateQuestionSolver.solveQuestion(q, correctIndex, opts);
    } catch (err) {
      console.error('[gateSolutionBuilder] AI solve failed:', q.id, err.message);
    }
  }

  return buildSolutionDetail(q, correctIndex);
}

module.exports = {
  buildSolutionDetail,
  buildSolutionDetailAsync,
  loadSolutionsMap,
  buildFallbackSolution
};

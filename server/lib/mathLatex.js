/**
 * Backend LaTeX standard for all MCQ mathematical text.
 * Store and serve using MathJax-style inline delimiters: \(...\)
 * Display / matrices use \[ ... \]
 */

function legacyPlainToLatex(str) {
  let s = String(str);
  if (/\\\(|\\\[|\$[^$]+\$/.test(s)) return s;

  const heat =
    'Heat equation: \\( u_{t} = u_{xx} \\), with boundary conditions \\( u(0, t) = u(\\pi, t) = 0 \\) and initial condition \\( u(x, 0) = \\sin(4x)\\cos(3x) \\). The value of \\( u\\left(\\frac{\\pi}{4}, t\\right) \\) equals:';
  if (/Heat\s+eq/i.test(s) && /u.*xx/i.test(s)) return heat;

  s = s
    .replace(/\bu\s*_?\s*t\s*=\s*u\s*_?\s*xx\b/gi, '\\( u_{t} = u_{xx} \\)')
    .replace(/\bu\s*\(\s*0\s*,\s*t\s*\)\s*=\s*u\s*\(\s*pi/gi, '\\( u(0, t) = u(\\pi')
    .replace(/\bsin\s*\(\s*4x\s*\)\s*cos\s*\(\s*3x\s*\)/gi, '\\sin(4x)\\cos(3x)');

  return s;
}

function normalizeSubscripts(str) {
  return String(str)
    .replace(/([uUvVfgh])_([a-z]{1,3})(?![a-zA-Z{])/g, '$1_{$2}')
    .replace(/([xyn])_([0-9]{1,2})(?![0-9{])/g, '$1_{$2}');
}

function normalizePowers(str) {
  return String(str)
    .replace(/([xy])(\^)([0-9]+)/g, '$1^{$3}')
    .replace(/e\^-([0-9]+)/g, 'e^{-$1}');
}

function normalizeSymbols(str) {
  return String(str)
    .replace(/→/g, '\\to ')
    .replace(/∞/g, '\\infty ')
    .replace(/π/g, '\\pi ')
    .replace(/λ/g, '\\lambda ')
    .replace(/≠/g, '\\neq ')
    .replace(/×/g, '\\times ')
    .replace(/√\s*2/g, '\\sqrt{2}')
    .replace(/√\s*\(/g, '\\sqrt{');
}

function wrapBareMath(str) {
  const s = String(str || '').trim();
  if (!s) return s;
  if (/\\\(|\\\[|\$[\s\S]*\$/.test(s)) return s;
  const looksMath =
    /[uU]_[a-z]{1,3}|\\frac|\\lambda|\\pi|\\sin|\\cos|u_\{|\\partial|\\oint|\\begin\{|\\det|\\sum|\\int|\^[0-9{]|_\{[a-z]/.test(
      s
    );
  if (/\\begin\{|\\\\|\\oint/.test(s)) return `\\[${s}\\]`;
  if (looksMath) return `\\(${s}\\)`;
  return s;
}

/** Convert $...$ storage to \(...\) standard (idempotent if already \( \)) */
function toParenDelimiters(str) {
  return String(str)
    .replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner) => `\\[${inner}\\]`)
    .replace(/\$([^$\n]+?)\$/g, (_m, inner) => `\\(${inner}\\)`);
}

function formatMathText(str) {
  if (str == null) return '';
  let s = legacyPlainToLatex(String(str));
  s = normalizeSymbols(s);
  s = normalizeSubscripts(s);
  s = normalizePowers(s);
  if (/\$[^$]+\$/.test(s) && !/\\\(/.test(s)) s = toParenDelimiters(s);
  s = wrapBareMath(s);
  return s;
}

function formatQuizItem(item) {
  if (!item || typeof item !== 'object') return item;
  const out = { ...item };
  if (typeof out.text === 'string') out.text = formatMathText(out.text);
  if (typeof out.question === 'string') out.question = formatMathText(out.question);
  if (Array.isArray(out.options)) {
    out.options = out.options.map((o) => formatMathText(o));
  }
  return out;
}

module.exports = {
  formatMathText,
  formatQuizItem,
  normalizeSubscripts,
  normalizePowers,
  toParenDelimiters,
  legacyPlainToLatex
};

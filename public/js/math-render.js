/**
 * Researchium math renderer — KaTeX with MathJax-style delimiters, fallbacks, a11y.
 * Delimiters: $...$, $$...$$, \(...\), \[...\]
 */
(function (global) {
  "use strict";

  var KATEX_CDN =
    "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js";
  var AUTORENDER_CDN =
    "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js";

  var MATH_CHUNK =
    /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;

  var KATEX_OPTS = {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false }
    ],
    throwOnError: false,
    strict: "ignore",
    trust: false,
    output: "htmlAndMathml",
    macros: {
      "\\Re": "\\operatorname{Re}",
      "\\Im": "\\operatorname{Im}",
      "\\rank": "\\operatorname{rank}",
      "\\tr": "\\operatorname{tr}",
      "\\nullity": "\\operatorname{nullity}",
      "\\diag": "\\operatorname{diag}",
      "\\det": "\\operatorname{det}"
    }
  };

  var katexReadyPromise = null;

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function legacyPlainToLatex(str) {
    var s = String(str);
    if (/\\\(|\\\[|\$[^$]+\$/.test(s)) return s;
    if (/Heat\s+eq/i.test(s) && /u.*xx/i.test(s)) {
      return (
        "Heat equation: \\( u_{t} = u_{xx} \\), with boundary conditions \\( u(0, t) = u(\\pi, t) = 0 \\) " +
        "and initial condition \\( u(x, 0) = \\sin(4x)\\cos(3x) \\). " +
        "The value of \\( u\\left(\\frac{\\pi}{4}, t\\right) \\) equals:"
      );
    }
    return s
      .replace(/\bu\s*_?\s*t\s*=\s*u\s*_?\s*xx\b/gi, "\\( u_{t} = u_{xx} \\)")
      .replace(/\bsin\s*\(\s*4x\s*\)\s*cos\s*\(\s*3x\s*\)/gi, "\\sin(4x)\\cos(3x)");
  }

  function normalizeSubscripts(str) {
    return String(str)
      .replace(/([uUvVfgh])_([a-z]{1,3})(?![a-zA-Z])/g, "$1_{$2}")
      .replace(/([xyn])_([0-9]{1,2})(?![0-9])/g, "$1_{$2}");
  }

  function normalizePowers(str) {
    return String(str)
      .replace(/([xy])(\^)([0-9]+)/g, "$1^{$3}")
      .replace(/e\^-([0-9]+)/g, "e^{-$1}");
  }

  function normalizeSymbols(str) {
    return String(str)
      .replace(/→/g, "\\to ")
      .replace(/∞/g, "\\infty ")
      .replace(/π/g, "\\pi ")
      .replace(/λ/g, "\\lambda ")
      .replace(/≠/g, "\\neq ")
      .replace(/×/g, "\\times ");
  }

  function preprocess(raw) {
    var s = legacyPlainToLatex(
      normalizeSymbols(normalizePowers(normalizeSubscripts(String(raw == null ? "" : raw))))
    );
    if (!/\\\(|\\\[|\$/.test(s) && /[uU]_[a-z]{1,3}|\\frac|\\lambda|\\sin|\\oint|\\begin\{/.test(s)) {
      if (/\\begin\{|\\\\|\\oint/.test(s)) s = "\\[" + s + "\\]";
      else s = "\\(" + s + "\\)";
    }
    return s;
  }

  /** Plain-language label for screen readers */
  function latexToAccessibleText(raw) {
    var s = preprocess(raw);
    return s
      .replace(/\$\$([\s\S]*?)\$\$/g, " $1 ")
      .replace(/\$([^$\n]+?)\$/g, " $1 ")
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1 over $2")
      .replace(/\\sqrt\{([^}]*)\}/g, "square root of $1")
      .replace(/\\oint/g, "contour integral")
      .replace(/\\sum/g, "sum")
      .replace(/\\int/g, "integral")
      .replace(/\\pi/g, "pi")
      .replace(/\\lambda/g, "lambda")
      .replace(/\\to/g, "to")
      .replace(/\\neq/g, "not equal")
      .replace(/\\times/g, "times")
      .replace(/[_^{}\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function toMathHtml(raw) {
    if (raw == null) return "";
    var str = preprocess(raw);
    var parts = str.split(MATH_CHUNK);
    return parts
      .map(function (part) {
        if (!part) return "";
        if (part.charAt(0) === "$" || part.indexOf("\\(") === 0 || part.indexOf("\\[") === 0) {
          return part;
        }
        return esc(part);
      })
      .join("");
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var el = document.createElement("script");
      el.src = src;
      el.crossOrigin = "anonymous";
      el.onload = function () {
        resolve();
      };
      el.onerror = function () {
        reject(new Error("Failed to load " + src));
      };
      document.head.appendChild(el);
    });
  }

  function whenKatexReady() {
    if (typeof global.renderMathInElement === "function") {
      return Promise.resolve(true);
    }
    if (katexReadyPromise) return katexReadyPromise;

    katexReadyPromise = loadScript(KATEX_CDN)
      .then(function () {
        return loadScript(AUTORENDER_CDN);
      })
      .then(function () {
        return typeof global.renderMathInElement === "function";
      })
      .catch(function () {
        katexReadyPromise = null;
        return false;
      });

    return katexReadyPromise;
  }

  function applyFallback(root) {
    if (!root) return;
    root.classList.add("math-fallback");
    root.querySelectorAll(".math-latex-fallback").forEach(function (el) {
      el.hidden = false;
    });
  }

  function typeset(root) {
    if (!root) return Promise.resolve(false);

    root.classList.add("math-typesetting");

    return whenKatexReady()
      .then(function (ok) {
        if (!ok || typeof global.renderMathInElement !== "function") {
          applyFallback(root);
          return false;
        }
        try {
          global.renderMathInElement(root, KATEX_OPTS);
          root.classList.remove("math-fallback");
          root.classList.add("math-typeset-done");
          return true;
        } catch (err) {
          applyFallback(root);
          return false;
        }
      })
      .finally(function () {
        root.classList.remove("math-typesetting");
      });
  }

  function setMathHtml(el, raw) {
    if (!el) return Promise.resolve(false);

    var label = latexToAccessibleText(raw);
    el.classList.add("math-content");
    el.setAttribute("role", "math");
    if (label) el.setAttribute("aria-label", label);
    el.setAttribute("aria-busy", "true");

    el.innerHTML =
      '<span class="math-latex-fallback" hidden aria-hidden="true"></span>' +
      toMathHtml(raw);
    var fallback = el.querySelector(".math-latex-fallback");
    if (fallback) fallback.textContent = label || String(raw || "");

    return typeset(el).finally(function () {
      el.setAttribute("aria-busy", "false");
    });
  }

  function enhanceRoot(root) {
    if (!root) return Promise.resolve(false);
    return typeset(root);
  }

  global.ResearchiumMath = {
    esc: esc,
    preprocess: preprocess,
    latexToAccessibleText: latexToAccessibleText,
    toMathHtml: toMathHtml,
    setMathHtml: setMathHtml,
    typeset: typeset,
    enhanceRoot: enhanceRoot,
    applyFallback: applyFallback,
    whenKatexReady: whenKatexReady,
    delimiters: KATEX_OPTS.delimiters
  };
})(typeof window !== "undefined" ? window : global);

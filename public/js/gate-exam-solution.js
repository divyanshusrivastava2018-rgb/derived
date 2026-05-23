/**
 * GATE post-submit solution list — section tabs, status filters, question cards.
 * Adapts POST /submit payload (review[], numeric options) for the panel renderer.
 */
(function () {
  "use strict";

  var LETTERS = ["A", "B", "C", "D"];

  var CSS =
    "#gateSolution *{box-sizing:border-box;margin:0;padding:0}" +
    "#gateSolution{font-family:inherit;color:inherit;padding:1rem 0 1.5rem}" +
    ".gs-score-header{margin-bottom:1.25rem}" +
    ".gs-score-header p.gs-subtitle{font-size:13px;color:#6b7280;margin-bottom:.75rem}" +
    ".gs-score-main{display:flex;align-items:baseline;gap:8px;margin-bottom:.6rem}" +
    ".gs-score-big{font-size:28px;font-weight:600;color:#111}" +
    ".gs-score-denom{font-size:15px;color:#6b7280}" +
    ".gs-score-pct{font-size:14px;color:#6b7280}" +
    ".gs-progress{height:4px;background:#f3f4f6;border-radius:2px;overflow:hidden;margin-bottom:1rem}" +
    ".gs-progress-fill{height:100%;background:#059669;border-radius:2px;transition:width .5s ease}" +
    ".gs-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-bottom:1.25rem}" +
    ".gs-stat{background:#f9fafb;border-radius:8px;padding:.65rem .85rem}" +
    ".gs-stat-label{font-size:11px;color:#6b7280;margin-bottom:2px}" +
    ".gs-stat-val{font-size:20px;font-weight:600}" +
    ".gs-stat-val.green{color:#059669}.gs-stat-val.red{color:#dc2626}" +
    ".gs-stat-val.amber{color:#d97706}.gs-stat-val.blue{color:#2563eb}" +
    ".gs-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1rem}" +
    ".gs-tab{font-size:12px;padding:5px 12px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;color:#6b7280;cursor:pointer}" +
    ".gs-tab.active{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;font-weight:500}" +
    ".gs-filters{display:flex;gap:6px;margin-bottom:1rem;flex-wrap:wrap}" +
    ".gs-filter{font-size:12px;padding:4px 12px;border-radius:20px;border:1px solid #e5e7eb;background:transparent;color:#6b7280;cursor:pointer}" +
    ".gs-filter.active{border-color:#374151;color:#111;background:#f3f4f6}" +
    ".gs-qcard{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:1rem 1.1rem;margin-bottom:.75rem;border-left:3px solid transparent}" +
    ".gs-qcard.correct{border-left-color:#059669}.gs-qcard.wrong{border-left-color:#dc2626}" +
    ".gs-qcard.unattempted{border-left-color:#9ca3af}" +
    ".gs-qmeta{display:flex;align-items:center;gap:8px;margin-bottom:.55rem;flex-wrap:wrap}" +
    ".gs-qnum{font-size:12px;font-weight:500;color:#6b7280}" +
    ".gs-badge{font-size:11px;padding:2px 8px;border-radius:6px;font-weight:500}" +
    ".gs-badge.correct{background:#d1fae5;color:#065f46}" +
    ".gs-badge.wrong{background:#fee2e2;color:#991b1b}" +
    ".gs-badge.unattempted{background:#f3f4f6;color:#4b5563}" +
    ".gs-badge.marks{background:#f3f4f6;color:#4b5563}" +
    ".gs-qtext{font-size:14px;line-height:1.6;margin-bottom:.75rem;color:#111}" +
    ".gs-opts{display:flex;flex-direction:column;gap:6px;margin-bottom:.75rem}" +
    ".gs-opt{display:flex;align-items:flex-start;gap:10px;padding:7px 10px;border-radius:8px;border:1px solid #e5e7eb;font-size:13px;line-height:1.5;color:#374151}" +
    ".gs-opt-key{font-weight:500;min-width:18px;color:#6b7280}" +
    ".gs-opt.is-correct{background:#d1fae5;border-color:#6ee7b7}" +
    ".gs-opt.is-wrong-pick{background:#fee2e2;border-color:#fca5a5}" +
    ".gs-opt-icon{margin-left:auto;font-size:14px}" +
    ".gs-explanation{background:#f9fafb;border-radius:8px;padding:.75rem 1rem;font-size:13px;line-height:1.6;color:#4b5563;border-left:3px solid #93c5fd;margin-top:.5rem}" +
    ".gs-understanding{margin-top:.75rem;padding:.65rem .85rem;background:#f0f4ff;border-radius:8px;font-size:13px;line-height:1.6;border-left:3px solid #6366f1}" +
    ".gs-solution-steps{margin-top:.75rem}" +
    ".gs-solution-steps__body{margin:.4rem 0 0;padding:.75rem .85rem;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;font-family:inherit;font-size:12px;line-height:1.65;white-space:pre-wrap}" +
    ".gs-concept-box{margin-top:.75rem;padding:.65rem .85rem;background:#eff6ff;border-radius:8px;font-size:13px;line-height:1.55;border-left:3px solid #3b82f6}" +
    ".gs-explanation--main{margin-top:.75rem}" +
    ".gs-solution-head{margin-top:.75rem;font-size:13px;line-height:1.55}" +
    ".gs-correct-pick{color:#065f46;margin:0 0 .4rem}" +
    ".gs-your-pick{margin:0 0 .5rem;color:#374151}" +
    ".gs-your-pick--ok{color:#065f46}.gs-your-pick--bad{color:#991b1b}" +
    ".gs-option-details{margin-top:.85rem;padding-top:.75rem;border-top:1px dashed #e5e7eb}" +
    ".gs-option-details__title{margin:0 0 .5rem;font-size:13px}" +
    ".gs-option-details__list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}" +
    ".gs-opt-detail{font-size:12px;line-height:1.5;padding:8px 10px;border-radius:8px;border:1px solid #e5e7eb;background:#fff}" +
    ".gs-opt-detail--correct{background:#ecfdf5;border-color:#6ee7b7}" +
    ".gs-opt-detail--wrong-pick{background:#fef2f2;border-color:#fca5a5}" +
    ".gs-opt-detail__key{font-weight:700;color:#374151;margin-right:4px}" +
    ".gs-opt-tag{font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;margin-left:6px;white-space:nowrap}" +
    ".gs-opt-tag--ok{background:#d1fae5;color:#065f46}.gs-opt-tag--bad{background:#fee2e2;color:#991b1b}" +
    ".gs-solution-detail{margin-top:.5rem}" +
    ".gs-empty{text-align:center;padding:2rem 1rem;color:#6b7280;font-size:14px}";

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeId(raw) {
    return String(raw == null ? "" : raw).replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function statusOf(q) {
    if (!q.chosenOption) return "unattempted";
    return q.chosenOption === q.correctOption ? "correct" : "wrong";
  }

  function indexToLetter(i) {
    return i >= 0 && i < LETTERS.length ? LETTERS[i] : null;
  }

  /**
   * Map Researchium submit JSON → panel shape (A–D options, skip missing explanations).
   * @param {object} apiResult
   * @param {Record<string, object>} [metaById] — exam questions for type / negativeMarks
   */
  function normalizeFromSubmit(apiResult, metaById) {
    var api = apiResult || {};
    var sections = (api.sections || []).map(function (s) {
      return { key: s.key, label: s.label || s.key };
    });

    var questions = (api.review || []).map(function (row) {
      var meta = metaById && row.id != null ? metaById[row.id] : null;
      var opts = (row.options || []).map(function (text, i) {
        return { key: LETTERS[i] || String(i + 1), text: String(text) };
      });
      var chosen =
        row.selected != null && row.selected >= 0 ? indexToLetter(row.selected) : null;
      var correct =
        row.correctIndex != null && row.correctIndex >= 0
          ? indexToLetter(row.correctIndex)
          : null;

      return {
        id: row.id,
        number: row.number,
        sectionKey: row.sectionKey,
        sectionLabel: row.sectionLabel,
        type: (meta && meta.type) || "MCQ",
        marks: row.marks != null ? row.marks : (meta && meta.marks) || 1,
        negativeMarks:
          meta && meta.negativeMarks != null
            ? meta.negativeMarks
            : row.negativeMarks != null
              ? row.negativeMarks
              : 0,
        text: row.text,
        options: opts,
        correctOption: correct || row.correctOption || "",
        chosenOption: chosen,
        explanation: row.explanation ? String(row.explanation) : "",
        optionExplanations: Array.isArray(row.optionExplanations)
          ? row.optionExplanations.map(String)
          : [],
        understanding: row.understanding ? String(row.understanding) : "",
        solutionText: row.solutionText ? String(row.solutionText) : "",
        keyConcept: row.keyConcept ? String(row.keyConcept) : "",
        correctAnswerLine: row.correctAnswerLine ? String(row.correctAnswerLine) : "",
        solutionSource: row.solutionSource || ""
      };
    });

    return {
      title: api.title || "",
      year: api.year != null ? String(api.year) : "",
      score: Number(api.score) || 0,
      total: Number(api.maxMarks) || 0,
      correct: api.correct || 0,
      wrong: api.wrong || 0,
      unattempted: api.unattempted || 0,
      sections: sections,
      questions: questions
    };
  }

  function scoreHTML(r) {
    var denom = r.total > 0 ? r.total : 1;
    var pct = Math.round((r.score / denom) * 100);
    return (
      '<div class="gs-score-header">' +
      '<p class="gs-subtitle">' +
      esc(r.title) +
      (r.year ? " · " + esc(r.year) : "") +
      "</p>" +
      '<div class="gs-score-main">' +
      '<span class="gs-score-big">' +
      r.score.toFixed(2) +
      "</span>" +
      '<span class="gs-score-denom">/ ' +
      r.total +
      "</span>" +
      '<span class="gs-score-pct">(' +
      pct +
      "%)</span>" +
      "</div>" +
      '<div class="gs-progress"><div class="gs-progress-fill" style="width:' +
      pct +
      '%"></div></div>' +
      "</div>" +
      '<div class="gs-stat-grid">' +
      '<div class="gs-stat"><div class="gs-stat-label">Correct</div><div class="gs-stat-val green">' +
      r.correct +
      "</div></div>" +
      '<div class="gs-stat"><div class="gs-stat-label">Wrong</div><div class="gs-stat-val red">' +
      r.wrong +
      "</div></div>" +
      '<div class="gs-stat"><div class="gs-stat-label">Unattempted</div><div class="gs-stat-val amber">' +
      r.unattempted +
      "</div></div>" +
      '<div class="gs-stat"><div class="gs-stat-label">Questions</div><div class="gs-stat-val blue">' +
      (r.correct + r.wrong + r.unattempted) +
      "</div></div>" +
      "</div>"
    );
  }

  function tabsHTML(sections, activeSection) {
    var all =
      '<button type="button" class="gs-tab' +
      (activeSection === "all" ? " active" : "") +
      '" data-section="all">All sections</button>';
    var rest = (sections || [])
      .map(function (s) {
        return (
          '<button type="button" class="gs-tab' +
          (activeSection === s.key ? " active" : "") +
          '" data-section="' +
          esc(s.key) +
          '">' +
          esc(s.label) +
          "</button>"
        );
      })
      .join("");
    return '<div class="gs-tabs">' + all + rest + "</div>";
  }

  function filtersHTML(activeFilter) {
    var items = [
      { key: "all", label: "All" },
      { key: "correct", label: "Correct" },
      { key: "wrong", label: "Wrong" },
      { key: "unattempted", label: "Unattempted" }
    ];
    return (
      '<div class="gs-filters">' +
      items
        .map(function (f) {
          return (
            '<button type="button" class="gs-filter' +
            (activeFilter === f.key ? " active" : "") +
            '" data-filter="' +
            f.key +
            '">' +
            f.label +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function optionTextByKey(options, key) {
    if (!key || !options) return "";
    for (var i = 0; i < options.length; i++) {
      if (options[i].key === key) return options[i].text;
    }
    return "";
  }

  function buildSolutionBlocksHTML(q) {
    var correctKey = q.correctOption || "";
    var chosenKey = q.chosenOption || "";
    var notes = q.optionExplanations || [];
    var correctText = optionTextByKey(q.options, correctKey);

    var head =
      '<div class="gs-solution-head">' +
      (correctKey
        ? '<p class="gs-correct-pick"><strong>Correct option:</strong> <span class="math-content">' +
          esc(correctKey) +
          ". " +
          esc(correctText) +
          "</span></p>"
        : "") +
      (chosenKey
        ? '<p class="gs-your-pick' +
          (chosenKey === correctKey ? " gs-your-pick--ok" : " gs-your-pick--bad") +
          '"><strong>Your answer:</strong> <span class="math-content">' +
          esc(chosenKey) +
          ". " +
          esc(optionTextByKey(q.options, chosenKey)) +
          "</span></p>"
        : '<p class="gs-your-pick"><strong>Your answer:</strong> Not attempted</p>') +
      "</div>";

    var understanding =
      q.understanding && String(q.understanding).trim()
        ? '<div class="gs-understanding"><strong>Understanding:</strong> <span class="math-content">' +
          esc(q.understanding) +
          "</span></div>"
        : "";

    var steps =
      q.solutionText && String(q.solutionText).trim()
        ? '<div class="gs-solution-steps"><strong>Step-by-step solution:</strong><pre class="gs-solution-steps__body math-content">' +
          esc(q.solutionText) +
          "</pre></div>"
        : "";

    var main =
      !steps && q.explanation && String(q.explanation).trim()
        ? '<div class="gs-explanation gs-explanation--main"><strong>Solution:</strong> <span class="math-content">' +
          esc(q.explanation) +
          "</span></div>"
        : "";

    var concept =
      q.keyConcept && String(q.keyConcept).trim()
        ? '<div class="gs-concept-box"><strong>Key concept:</strong> <span class="math-content">' +
          esc(q.keyConcept) +
          "</span></div>"
        : "";

    var list =
      '<div class="gs-option-details"><p class="gs-option-details__title"><strong>Option-wise explanation</strong></p><ul class="gs-option-details__list">' +
      (q.options || [])
        .map(function (o, i) {
          var isCorrect = o.key === correctKey;
          var isPick = o.key === chosenKey && !isCorrect;
          var cls = isCorrect
            ? " gs-opt-detail--correct"
            : isPick
              ? " gs-opt-detail--wrong-pick"
              : "";
          var tag = isCorrect
            ? '<span class="gs-opt-tag gs-opt-tag--ok">Correct</span>'
            : isPick
              ? '<span class="gs-opt-tag gs-opt-tag--bad">Your pick</span>'
              : "";
          var note = notes[i] != null && String(notes[i]).trim() ? notes[i] : o.text;
          return (
            '<li class="gs-opt-detail' +
            cls +
            '"><span class="gs-opt-detail__key">' +
            esc(o.key) +
            '.</span> <span class="math-content gs-opt-detail__text">' +
            esc(note) +
            "</span> " +
            tag +
            "</li>"
          );
        })
        .join("") +
      "</ul></div>";

    return head + understanding + steps + main + concept + list;
  }

  function questionHTML(q) {
    var status = statusOf(q);
    var badgeText =
      status === "correct" ? "Correct" : status === "wrong" ? "Wrong" : "Unattempted";
    var marksNote =
      status === "correct"
        ? "+" + q.marks + " marks"
        : status === "wrong"
          ? "−" + q.negativeMarks + " marks"
          : "0 marks";

    var opts = (q.options || [])
      .map(function (o) {
        var isCorrect = o.key === q.correctOption;
        var isWrongPick = o.key === q.chosenOption && !isCorrect;
        var cls = isCorrect ? " is-correct" : isWrongPick ? " is-wrong-pick" : "";
        var icon = isCorrect
          ? '<span class="gs-opt-icon" style="color:#059669">✓</span>'
          : isWrongPick
            ? '<span class="gs-opt-icon" style="color:#dc2626">✗</span>'
            : "";
        return (
          '<div class="gs-opt' +
          cls +
          '"><span class="gs-opt-key">' +
          esc(o.key) +
          '.</span><span class="math-content">' +
          esc(o.text) +
          "</span>" +
          icon +
          "</div>"
        );
      })
      .join("");

    var detail = buildSolutionBlocksHTML(q);

    var qidAttr = safeId(q.id != null ? q.id : q.number);

    return (
      '<div class="gs-qcard ' +
      status +
      '" id="gs-q-' +
      qidAttr +
      '" data-qid="' +
      esc(qidAttr) +
      '">' +
      '<div class="gs-qmeta">' +
      '<span class="gs-qnum">Q' +
      q.number +
      "</span>" +
      '<span class="gs-badge ' +
      status +
      '">' +
      badgeText +
      "</span>" +
      '<span class="gs-badge marks">' +
      marksNote +
      "</span>" +
      '<span style="font-size:11px;color:#6b7280;margin-left:auto">' +
      esc(q.sectionLabel) +
      " · " +
      esc(q.type) +
      "</span>" +
      "</div>" +
      '<p class="gs-qtext math-content">' +
      esc(q.text) +
      "</p>" +
      '<div class="gs-opts">' +
      opts +
      "</div>" +
      '<div class="gs-solution-detail">' +
      detail +
      "</div>" +
      "</div>"
    );
  }

  function ensureGsStyles() {
    if (document.getElementById("gs-style")) return;
    var s = document.createElement("style");
    s.id = "gs-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function GateSolutionPanel(result, container, options) {
    this.result = result;
    this.el = container;
    this.opts = options || {};
    this.section = "all";
    this.filter = "all";

    ensureGsStyles();

    if (!this.el.id) this.el.id = "gateSolution";
    this._bind();
    this.render();
  }

  GateSolutionPanel.prototype.render = function () {
    var self = this;
    var r = self.result;
    var qs = (r.questions || []).filter(function (q) {
      var secOk = self.section === "all" || q.sectionKey === self.section;
      var statOk = self.filter === "all" || statusOf(q) === self.filter;
      return secOk && statOk;
    });

    var qsHtml = qs.length
      ? qs.map(questionHTML).join("")
      : '<div class="gs-empty">No questions match this filter.</div>';

    self.el.innerHTML =
      (self.opts.skipScore ? "" : scoreHTML(r)) +
      tabsHTML(r.sections || [], self.section) +
      filtersHTML(self.filter) +
      qsHtml;

    self._bind();
    self._enhanceMath();
  };

  GateSolutionPanel.prototype._enhanceMath = function () {
    var math = window.ResearchiumMath;
    if (!math || !math.enhanceRoot) return;
    math.enhanceRoot(this.el).catch(function () {
      if (math.applyFallback) math.applyFallback(this.el);
    }.bind(this));
  };

  GateSolutionPanel.prototype._bind = function () {
    var self = this;
    self.el.querySelectorAll(".gs-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        self.section = btn.getAttribute("data-section") || "all";
        self.render();
      });
    });
    self.el.querySelectorAll(".gs-filter").forEach(function (btn) {
      btn.addEventListener("click", function () {
        self.filter = btn.getAttribute("data-filter") || "all";
        self.render();
      });
    });
  };

  window.GateExamSolution = {
    normalizeFromSubmit: normalizeFromSubmit,
    buildSolutionBlocksHTML: buildSolutionBlocksHTML,
    formatInlinePanel: function (row, q) {
      if (!row) return "";
      ensureGsStyles();
      var letters = LETTERS;
      var opts = (row.options || q.options || []).map(function (text, i) {
        return { key: letters[i] || String(i + 1), text: String(text) };
      });
      var chosen =
        row.selected != null && row.selected >= 0 ? indexToLetter(row.selected) : null;
      var correct =
        row.correctIndex != null && row.correctIndex >= 0
          ? indexToLetter(row.correctIndex)
          : row.correctOption || "";
      return buildSolutionBlocksHTML({
        correctOption: correct,
        chosenOption: chosen,
        explanation: row.explanation || "",
        optionExplanations: row.optionExplanations || [],
        understanding: row.understanding || "",
        solutionText: row.solutionText || "",
        keyConcept: row.keyConcept || "",
        correctAnswerLine: row.correctAnswerLine || "",
        options: opts
      });
    },
    /**
     * @param {object} result — submit API body or pre-normalized panel shape
     * @param {string} [containerId]
     * @param {{ skipScore?: boolean, metaById?: object }} [options]
     */
    render: function (result, containerId, options) {
      var opts = options || {};
      var el =
        document.getElementById(containerId || "solutionPanelBody") ||
        document.getElementById("solutionPanel");
      if (!el) {
        console.error("[GateExamSolution] container not found:", containerId);
        return;
      }
      var normalized =
        result && Array.isArray(result.questions)
          ? result
          : normalizeFromSubmit(result, opts.metaById);
      if (!normalized.questions || !normalized.questions.length) {
        console.warn("[GateExamSolution] no review data to render");
        return;
      }
      var aside = document.getElementById("solutionPanel");
      if (aside) {
        aside.classList.remove("gate-hidden");
        aside.setAttribute("aria-hidden", "false");
      }
      new GateSolutionPanel(normalized, el, opts);
      return normalized;
    },

    scrollToQuestion: function (questionId) {
      if (questionId == null) return;
      var id = safeId(questionId);
      var card = document.getElementById("gs-q-" + id);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };
})();

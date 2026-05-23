(function () {
  "use strict";

  var STORAGE_KEY = "researchium_mock_analysis";
  var PAGE_SIZE = 10;
  var state = { filter: "all", page: 1 };
  var payload = null;

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function pct(a, b) {
    return b ? Math.round((a / b) * 100) : 0;
  }

  function pillClass(acc) {
    if (acc >= 70) return "rm-analysis__pill--high";
    if (acc >= 50) return "rm-analysis__pill--mid";
    return "rm-analysis__pill--low";
  }

  function loadPayload() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.summary || !Array.isArray(data.review)) return null;
      return data;
    } catch {
      return null;
    }
  }

  function filteredReview() {
    if (!payload || !payload.review) return [];
    if (state.filter === "all") return payload.review;
    return payload.review.filter(function (q) {
      return q.status === state.filter;
    });
  }

  function bindTabs(root) {
    root.querySelectorAll(".rm-analysis__tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tab = btn.getAttribute("data-tab");
        root.querySelectorAll(".rm-analysis__tab").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
        root.querySelectorAll(".rm-analysis__pane").forEach(function (p) {
          p.classList.toggle("active", p.id === "pane-" + tab);
        });
      });
    });
  }

  function bindFilters(root) {
    root.querySelectorAll(".rm-analysis__filter").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.filter = btn.getAttribute("data-filter") || "all";
        state.page = 1;
        root.querySelectorAll(".rm-analysis__filter").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
        renderQuestions(root);
      });
    });
  }

  function renderShell(root) {
    var s = payload.summary;
    var acc = pct(s.correct, s.attempted || s.correct + s.wrong);
    var accColor =
      acc >= 70 ? "#10b981" : acc >= 50 ? "#f59e0b" : "#ef4444";
    var dateStr = payload.completedAt
      ? new Date(payload.completedAt).toLocaleString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })
      : "";

    root.innerHTML =
      '<div class="rm-analysis__hero">' +
      '<div><h1 id="analysisTitle">' +
      esc(payload.title) +
      "</h1>" +
      '<p class="rm-analysis__hero-meta">' +
      esc(dateStr) +
      " · " +
      esc(payload.type === "gate" ? "GATE mock" : "Practice quiz") +
      "</p></div>" +
      '<div class="rm-analysis__badge"><strong>' +
      esc(String(s.percentage)) +
      '%</strong><span class="rm-analysis__hero-meta">Overall</span></div></div>' +
      '<div class="rm-analysis__tabs" role="tablist">' +
      '<button type="button" class="rm-analysis__tab active" data-tab="summary">Summary</button>' +
      '<button type="button" class="rm-analysis__tab" data-tab="analytics">Analytics</button>' +
      '<button type="button" class="rm-analysis__tab" data-tab="questions">Questions</button>' +
      "</div>" +
      '<div class="rm-analysis__pane active" id="pane-summary">' +
      '<div class="rm-analysis__score-grid">' +
      scoreCard("Marks", s.score + " / " + s.maxMarks, "", "primary") +
      scoreCard("Correct", s.correct, "answered right", "green") +
      scoreCard("Incorrect", s.wrong, "answered wrong", "red") +
      scoreCard("Skipped", s.unattempted, "not attempted", "amber") +
      scoreCard("Attempted", s.attempted, "of " + s.total + " questions", "") +
      scoreCard("Accuracy", acc + "%", "of attempted", "primary") +
      "</div>" +
      '<div class="rm-analysis__panel"><h2>Overall accuracy</h2>' +
      '<div class="rm-analysis__acc-row">' +
      '<span style="font-size:13px;color:var(--ac-muted)">Accuracy</span>' +
      '<div class="rm-analysis__acc-track"><div class="rm-analysis__acc-fill" style="width:' +
      acc +
      "%;background:" +
      accColor +
      '"></div></div>' +
      '<strong>' +
      acc +
      "%</strong></div></div>" +
      sectionBarsHtml() +
      "</div>" +
      '<div class="rm-analysis__pane" id="pane-analytics">' +
      sectionTableHtml() +
      "</div>" +
      '<div class="rm-analysis__pane" id="pane-questions">' +
      '<div class="rm-analysis__filters">' +
      '<button type="button" class="rm-analysis__filter active" data-filter="all">All</button>' +
      '<button type="button" class="rm-analysis__filter" data-filter="correct">Correct</button>' +
      '<button type="button" class="rm-analysis__filter" data-filter="incorrect">Incorrect</button>' +
      '<button type="button" class="rm-analysis__filter" data-filter="skipped">Skipped</button>' +
      "</div>" +
      '<div id="questionsList"></div>' +
      '<div id="questionsPager"></div>' +
      "</div>" +
      '<div class="rm-analysis__actions">' +
      '<a href="/mcq-test.html#mock-test-series" class="btn-gold">Back to Mock Tests</a>' +
      (payload.backUrl
        ? '<a href="' + esc(payload.backUrl) + '" class="btn-ghost">Retake / exam</a>'
        : "") +
      "</div>";

    bindTabs(root);
    bindFilters(root);
    renderQuestions(root);
    typesetRoot(root);
  }

  function scoreCard(label, value, sub, mod) {
    return (
      '<div class="rm-analysis__card rm-analysis__card--' +
      (mod || "") +
      '"><div class="rm-analysis__card-label">' +
      esc(label) +
      '</div><div class="rm-analysis__card-value">' +
      esc(String(value)) +
      '</div><div class="rm-analysis__card-sub">' +
      esc(sub) +
      "</div></div>"
    );
  }

  function sectionBarsHtml() {
    var sections = payload.sections || [];
    if (!sections.length) return "";
    var maxAcc = Math.max.apply(
      null,
      sections.map(function (s) {
        return s.accuracy || 0;
      }).concat([1])
    );
    var rows = sections
      .map(function (s) {
        var w = pct(s.accuracy || 0, maxAcc);
        return (
          '<div class="rm-analysis__bar-row"><span class="rm-analysis__bar-label">' +
          esc(s.label) +
          '</span><div class="rm-analysis__bar-track"><div class="rm-analysis__bar-fill" style="width:' +
          w +
          '%"></div></div><span style="width:40px;text-align:right;color:var(--ac-muted);font-size:12px">' +
          esc(String(s.accuracy)) +
          "%</span></div>"
        );
      })
      .join("");
    return (
      '<div class="rm-analysis__panel"><h2>Section-wise accuracy</h2>' + rows + "</div>"
    );
  }

  function sectionTableHtml() {
    var sections = payload.sections || [];
    if (!sections.length) {
      return '<div class="rm-analysis__panel"><p class="rm-analysis__notice">No section breakdown for this attempt.</p></div>';
    }
    var rows = sections
      .map(function (s) {
        var acc = s.accuracy != null ? s.accuracy : pct(s.correct, s.total);
        return (
          "<tr><td><strong>" +
          esc(s.label) +
          "</strong></td><td>" +
          s.total +
          '</td><td style="color:#059669;font-weight:600">' +
          s.correct +
          '</td><td style="color:#dc2626;font-weight:600">' +
          s.wrong +
          '</td><td style="color:#d97706;font-weight:600">' +
          s.skipped +
          '</td><td><span class="rm-analysis__pill ' +
          pillClass(acc) +
          '">' +
          acc +
          "%</span></td></tr>"
        );
      })
      .join("");
    return (
      '<div class="rm-analysis__panel"><h2>Section breakdown</h2>' +
      '<table class="rm-analysis__table"><thead><tr><th>Section</th><th>Total</th><th>Correct</th><th>Wrong</th><th>Skipped</th><th>Accuracy</th></tr></thead><tbody>' +
      rows +
      "</tbody></table></div>"
    );
  }

  function renderQuestions(root) {
    var list = filteredReview();
    var total = list.length;
    var start = (state.page - 1) * PAGE_SIZE;
    var pageItems = list.slice(start, start + PAGE_SIZE);
    var listEl = root.querySelector("#questionsList");
    var pagerEl = root.querySelector("#questionsPager");
    if (!listEl) return;

    if (!pageItems.length) {
      listEl.innerHTML =
        '<p class="rm-analysis__empty">No questions in this filter.</p>';
      if (pagerEl) pagerEl.innerHTML = "";
      return;
    }

    var math = window.ResearchiumMath;
    var toHtml = math
      ? function (t) {
          return math.toMathHtml(t);
        }
      : esc;

    listEl.innerHTML = pageItems
      .map(function (q) {
        var opts = (q.options || [])
          .map(function (op, i) {
            var cls = "";
            if (i === q.correctIndex) cls = "rm-analysis__opt--correct";
            else if (i === q.selected && q.status === "incorrect")
              cls = "rm-analysis__opt--wrong";
            var marker =
              i === q.correctIndex
                ? "✓"
                : i === q.selected
                  ? "✗"
                  : String.fromCharCode(65 + i);
            return (
              '<li class="rm-analysis__opt ' +
              cls +
              '"><span>' +
              marker +
              "</span> <span>" +
              toHtml(op) +
              "</span></li>"
            );
          })
          .join("");
        return (
          '<article class="rm-analysis__qcard">' +
          '<div class="rm-analysis__qhead"><span class="rm-analysis__dot rm-analysis__dot--' +
          esc(q.status) +
          '"></span><span>Q' +
          esc(String(q.number)) +
          '</span><span class="rm-analysis__qtopic">' +
          esc(q.sectionLabel || "") +
          (q.marks != null ? " · " + q.marks + " marks" : "") +
          '</span></div><div class="rm-analysis__qbody"><div class="rm-analysis__qtext math-content">' +
          toHtml(q.text || q.question || "") +
          '</div><ul class="rm-analysis__opts">' +
          opts +
          "</ul></div></article>"
        );
      })
      .join("");

    var pages = Math.ceil(total / PAGE_SIZE);
    if (pagerEl) {
      if (pages <= 1) {
        pagerEl.innerHTML = "";
      } else {
        var html = "";
        for (var p = 1; p <= pages; p += 1) {
          html +=
            '<button type="button" class="rm-analysis__filter' +
            (p === state.page ? " active" : "") +
            '" data-page="' +
            p +
            '">' +
            p +
            "</button> ";
        }
        pagerEl.innerHTML = html;
        pagerEl.querySelectorAll("[data-page]").forEach(function (btn) {
          btn.addEventListener("click", function () {
            state.page = parseInt(btn.getAttribute("data-page"), 10) || 1;
            renderQuestions(root);
            typesetRoot(listEl);
          });
        });
      }
    }
    typesetRoot(listEl);
  }

  function typesetRoot(el) {
    var math = window.ResearchiumMath;
    if (!math || !el) return;
    math.enhanceRoot(el).catch(function () {
      if (math.applyFallback) math.applyFallback(el);
    });
  }

  function showMissing() {
    var root = document.getElementById("analysisRoot");
    if (!root) return;
    root.innerHTML =
      '<div class="rm-analysis__empty"><p>No analysis data found. Complete a mock test first.</p>' +
      '<p style="margin-top:16px"><a href="/mcq-test.html#mock-test-series" class="btn-gold">Go to Mock Test Series</a></p></div>';
  }

  function init() {
    payload = loadPayload();
    if (!payload) {
      showMissing();
      return;
    }
    var root = document.getElementById("analysisRoot");
    if (!root) return;
    renderShell(root);
  }

  function buildFromGateSubmit(apiJson, meta) {
    var j = apiJson || {};
    var m = meta || {};
    return {
      type: "gate",
      title: j.title || m.title || "GATE Mock",
      completedAt: new Date().toISOString(),
      backUrl: m.backUrl || "/mcq-test.html#mock-test-series",
      summary: {
        score: j.score,
        maxMarks: j.maxMarks,
        correct: j.correct,
        wrong: j.wrong,
        unattempted: j.unattempted,
        total: j.total,
        attempted: j.attempted != null ? j.attempted : j.correct + j.wrong,
        percentage: j.percentage
      },
      sections: j.sections || [],
      review: j.review || []
    };
  }

  function buildFromQuizSubmit(apiJson) {
    var j = apiJson || {};
    return {
      type: "quiz",
      title: (j.topic || "Practice") + " — Mock",
      completedAt: new Date().toISOString(),
      backUrl: "/mcq-test.html#mock-test-series",
      summary: {
        score: j.score,
        maxMarks: j.maxMarks != null ? j.maxMarks : j.total,
        correct: j.correct,
        wrong: j.wrong,
        unattempted: j.unattempted,
        total: j.total,
        attempted: j.attempted != null ? j.attempted : j.correct + j.wrong,
        percentage: j.percentage
      },
      sections: j.sections || [],
      review: j.review || []
    };
  }

  window.ResearchiumAnalysis = {
    STORAGE_KEY: STORAGE_KEY,
    save: function (data) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        /* quota */
      }
    },
    buildFromGateSubmit: buildFromGateSubmit,
    buildFromQuizSubmit: buildFromQuizSubmit
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

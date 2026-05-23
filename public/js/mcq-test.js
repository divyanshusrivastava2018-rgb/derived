(function () {
  "use strict";

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function fetchMockCatalog() {
    if (window.ResearchiumApi && window.ResearchiumApi.get) {
      return window.ResearchiumApi.get("/api/mcq/mock-tests");
    }
    return fetch("/api/mcq/mock-tests", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("api");
      return r.json();
    }).catch(function () {
      return fetch("/data/offline-mock-tests.json", { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("offline");
        return r.json();
      });
    });
  }

  var allTokens = [];
  var activeFilter = "all";

  function renderMockCard(t) {
    var attemptLabel = t.attemptType === "gate-exam" ? "Attempt Mock Test" : "Start Practice Quiz";
    return (
      '<article class="mock-card" data-group="' +
      esc(t.group) +
      '" data-id="' +
      esc(t.id) +
      '">' +
      '<img class="mock-card-thumb" src="' +
      esc(t.image) +
      '" alt="" width="48" height="32" loading="lazy" />' +
      '<h3 class="mock-card-title">' +
      esc(t.title) +
      "</h3>" +
      '<span class="mock-card-badge">' +
      esc(t.badge) +
      "</span>" +
      '<div class="mock-card-stats">' +
      '<div class="mock-stat"><span class="mock-stat-value">' +
      esc(String(t.totalQuestions)) +
      '</span><span class="mock-stat-label">Qs</span></div>' +
      '<div class="mock-stat"><span class="mock-stat-value">' +
      esc(String(t.totalMarks)) +
      '</span><span class="mock-stat-label">Marks</span></div>' +
      '<div class="mock-stat"><span class="mock-stat-value">' +
      esc(String(t.durationMinutes)) +
      '</span><span class="mock-stat-label">Mins</span></div>' +
      "</div>" +
      (t.pdfCount
        ? '<p class="mock-card-pdfs">' +
          esc(String(t.pdfCount)) +
          " study PDFs</p>"
        : "") +
      '<a class="mock-card-cta" href="' +
      esc(t.attemptUrl) +
      '" ' +
      (t.attemptType === "gate-exam"
        ? 'target="_blank" rel="noopener noreferrer"'
        : "") +
      " data-attempt-type=\"" +
      esc(t.attemptType) +
      "\" data-quiz-topic=\"" +
      esc(t.quizTopic || "") +
      "\">" +
      esc(attemptLabel) +
      "</a>" +
      '<a class="mock-card-study" href="' +
      esc(t.studyUrl) +
      '">View PDFs</a>' +
      "</article>"
    );
  }

  function renderFilters() {
    var tabs = document.getElementById("mockFilterTabs");
    if (!tabs) return;
    var groups = [
      { key: "all", label: "All mocks" },
      { key: "gate-year", label: "GATE (year-wise)" },
      { key: "category", label: "PDF categories" }
    ];
    tabs.innerHTML = groups
      .map(function (g) {
        return (
          '<button type="button" class="mock-year-tab' +
          (activeFilter === g.key ? " active" : "") +
          '" data-filter="' +
          esc(g.key) +
          '">' +
          esc(g.label) +
          "</button>"
        );
      })
      .join("");
    tabs.querySelectorAll(".mock-year-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeFilter = btn.getAttribute("data-filter") || "all";
        renderFilters();
        renderCards();
      });
    });
  }

  function renderCards() {
    var grid = document.getElementById("mockCardsGrid");
    var errEl = document.getElementById("mockLoadError");
    if (!grid) return;
    var list = allTokens.filter(function (t) {
      return activeFilter === "all" || t.group === activeFilter;
    });
    if (!list.length) {
      grid.innerHTML = '<p class="mock-cards-empty">No mock tests in this filter.</p>';
      return;
    }
    var gate = list.filter(function (t) {
      return t.group === "gate-year";
    });
    var cat = list.filter(function (t) {
      return t.group === "category";
    });
    var html = "";
    if (gate.length && activeFilter !== "category") {
      html +=
        '<h2 class="mock-group-title">GATE Mathematics — Year-wise full mocks</h2><div class="mock-cards-row">' +
        gate.map(renderMockCard).join("") +
        "</div>";
    }
    if (cat.length && activeFilter !== "gate-year") {
      html +=
        '<h2 class="mock-group-title">Study material categories — Practice mocks</h2><div class="mock-cards-row">' +
        cat.map(renderMockCard).join("") +
        "</div>";
    }
    grid.innerHTML = html;

    grid.querySelectorAll(".mock-card-cta[data-attempt-type='category-quiz']").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        openCategoryQuiz(a.getAttribute("data-quiz-topic") || "", true);
      });
    });

    if (errEl) errEl.style.display = "none";
  }

  function loadMockTests() {
    var grid = document.getElementById("mockCardsGrid");
    var errEl = document.getElementById("mockLoadError");
    if (!grid) return;

    fetchMockCatalog()
      .then(function (data) {
        allTokens = Array.isArray(data.tokens) ? data.tokens : [];
        if (!allTokens.length) throw new Error("empty");
        renderFilters();
        renderCards();
        scrollToMockSeries();
      })
      .catch(function () {
        grid.innerHTML = '<p class="mock-cards-empty">Could not load mock tests.</p>';
        if (errEl) {
          errEl.style.display = "block";
          errEl.textContent =
            "Could not load mock tests. Please refresh the page or try again later.";
        }
      });
  }

  /* —— Category quiz panel —— */
  var quizPanel = document.getElementById("categoryQuizPanel");
  var formEl = document.getElementById("mcqForm");
  var resultEl = document.getElementById("mcqResult");
  var genBtn = document.getElementById("btnGenerateMcq");
  var submitBtn = document.getElementById("btnSubmitMcq");
  var currentTopic = "";
  var currentQuestions = [];
  var currentTestId = "";

  function openCategoryQuiz(topic, autoStart) {
    if (!quizPanel || !topic) return;
    currentTopic = topic;
    var titleEl = document.getElementById("quizPanelTitle");
    if (titleEl) titleEl.textContent = topic + " — Practice Mock";
    quizPanel.style.display = "block";
    if (formEl) formEl.innerHTML = "";
    if (resultEl) resultEl.textContent = "";
    if (submitBtn) submitBtn.disabled = true;
    quizPanel.scrollIntoView({ behavior: "smooth" });
    var shouldAuto =
      autoStart === true ||
      new URLSearchParams(window.location.search).get("auto") === "1";
    if (shouldAuto) generateQuiz();
  }

  function renderQuestions(questions) {
    if (!formEl) return;
    if (!questions.length) {
      formEl.innerHTML = "<p>No questions available.</p>";
      return;
    }
    var math = window.ResearchiumMath;
    var toHtml = math
      ? function (s) {
          return math.toMathHtml(s);
        }
      : esc;
    formEl.innerHTML = questions
      .map(function (q, idx) {
        var options = (q.options || [])
          .map(function (op, oi) {
            var id = "q" + idx + "_o" + oi;
            return (
              '<label class="mcq-option" for="' +
              id +
              '"><input type="radio" id="' +
              id +
              '" name="q' +
              idx +
              '" value="' +
              oi +
              '"/> <span class="mcq-opt-text">' +
              toHtml(op) +
              "</span></label>"
            );
          })
          .join("");
        return (
          '<div class="mcq-card"><p class="mcq-q math-content"><strong>Q' +
          (idx + 1) +
          ".</strong> " +
          toHtml(q.question) +
          "</p>" +
          options +
          "</div>"
        );
      })
      .join("");
    if (math) {
      math.enhanceRoot(formEl).catch(function () {
        if (math.applyFallback) math.applyFallback(formEl);
      });
    }
  }

  function generateQuiz() {
    if (!currentTopic || !formEl) return;
    if (resultEl) resultEl.textContent = "";
    formEl.innerHTML = '<p class="loading-banner">Loading questions…</p>';
    var req = window.ResearchiumApi && window.ResearchiumApi.post
      ? window.ResearchiumApi.post("/api/mcq/generate", {
          topic: currentTopic,
          count: 10
        })
      : fetch("/api/mcq/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: currentTopic, count: 10 })
        }).then(function (r) {
          return r.json().then(function (j) {
            if (!r.ok) throw new Error(j.error || "fail");
            return j;
          });
        });

    req
      .then(function (j) {
        currentTestId = j.testId || "";
        currentQuestions = Array.isArray(j.questions) ? j.questions : [];
        renderQuestions(currentQuestions);
        if (submitBtn) submitBtn.disabled = currentQuestions.length === 0;
      })
      .catch(function () {
        formEl.innerHTML = "<p>Could not load quiz. Is the server running?</p>";
        if (submitBtn) submitBtn.disabled = true;
      });
  }

  function submitQuiz() {
    if (!currentQuestions.length || !currentTestId) return;
    var answers = currentQuestions.map(function (_q, idx) {
      var selected = formEl.querySelector('input[name="q' + idx + '"]:checked');
      return selected ? Number(selected.value) : -1;
    });
    var req = window.ResearchiumApi && window.ResearchiumApi.post
      ? window.ResearchiumApi.post("/api/mcq/submit", {
          testId: currentTestId,
          answers: answers
        })
      : fetch("/api/mcq/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ testId: currentTestId, answers: answers })
        }).then(function (r) {
          return r.json();
        });

    req
      .then(function (j) {
        if (resultEl) {
          resultEl.innerHTML =
            "Score: " +
            esc(String(j.score)) +
            " / " +
            esc(String(j.total)) +
            " (" +
            esc(String(j.percentage)) +
            "%)";
          if (j.review && j.review.length) {
            try {
              sessionStorage.setItem(
                "researchium_mock_analysis",
                JSON.stringify({
                  type: "quiz",
                  title: (j.topic || currentTopic || "Practice") + " — Mock",
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
                  review: j.review
                })
              );
            } catch (storageErr) {
              /* ignore */
            }
            resultEl.innerHTML +=
              ' · <a href="/mock-analysis.html">View detailed analysis</a>';
          }
        }
        if (window.ResearchiumProgress && window.ResearchiumProgress.record) {
          window.ResearchiumProgress.record({
            type: "quiz_submit",
            label: currentTopic || "Practice quiz",
            score: j.score,
            total: j.total
          });
        }
      })
      .catch(function () {
        if (resultEl) resultEl.textContent = "Submit failed. Try again.";
      });
  }

  if (genBtn) genBtn.addEventListener("click", generateQuiz);
  if (submitBtn) submitBtn.addEventListener("click", submitQuiz);
  document.getElementById("btnCloseQuiz")?.addEventListener("click", function () {
    if (quizPanel) quizPanel.style.display = "none";
  });

  function scrollToMockSeries() {
    if (window.location.hash !== "#mock-test-series") return;
    var el = document.getElementById("mock-test-series");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  loadMockTests();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scrollToMockSeries);
  } else {
    setTimeout(scrollToMockSeries, 100);
  }

  var params = new URLSearchParams(window.location.search);
  var catSlug = params.get("category");
  if (catSlug) {
    fetch("/api/mcq/category/" + encodeURIComponent(catSlug))
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (j.quizTopic) openCategoryQuiz(j.quizTopic, true);
      })
      .catch(function () {});
  }
})();

/**
 * GATE solutions page — full question solutions (separate from gate-exam.html).
 */
(function () {
  "use strict";

  var STORAGE_KEY = "researchium_mock_analysis";
  var payload = null;
  var reviewToken = "";
  var paperSlug = "";
  var gateAiSolver = false;

  var aiQueue = [];
  var aiActive = 0;
  var AI_MAX = 2;

  function $(id) {
    return document.getElementById(id);
  }

  function apiUrl(path) {
    if (window.ResearchiumApi && window.ResearchiumApi.url) {
      return window.ResearchiumApi.url(path);
    }
    return path.charAt(0) === "/" ? path : "/" + path;
  }

  function loadPayload() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.type !== "gate" || !Array.isArray(data.review) || !data.summary) {
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  function submitShape(data) {
    var s = data.summary || {};
    return {
      title: data.title || "GATE Mock",
      year: data.paperSlug || data.year || "",
      score: s.score,
      maxMarks: s.maxMarks,
      correct: s.correct,
      wrong: s.wrong,
      unattempted: s.unattempted,
      total: s.total,
      attempted: s.attempted,
      percentage: s.percentage,
      sections: data.sections || [],
      review: data.review || []
    };
  }

  function mergeRow(qid, data) {
    if (!payload || !data) return;
    payload.review.forEach(function (row) {
      if (row && row.id === qid) {
        Object.assign(row, {
          explanation: data.explanation || row.explanation,
          optionExplanations: data.optionExplanations || row.optionExplanations,
          understanding: data.understanding || "",
          solutionText: data.solutionText || "",
          keyConcept: data.keyConcept || "",
          correctAnswerLine: data.correctAnswerLine || "",
          solutionSource: data.solutionSource || row.solutionSource
        });
      }
    });
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota */
    }
    renderPanel();
  }

  function needsAi(row) {
    if (!gateAiSolver || !row) return false;
    if (row.solutionSource === "ai" || row.solutionSource === "cache") return false;
    if (row.solutionText && String(row.solutionText).trim()) return false;
    return true;
  }

  function fetchAi(row) {
    if (!needsAi(row) || row._aiLoading || row._aiQueued) return;
    row._aiQueued = true;
    aiQueue.push(row);
    drainAi();
  }

  function drainAi() {
    while (aiActive < AI_MAX && aiQueue.length) {
      var row = aiQueue.shift();
      aiActive += 1;
      runAi(row, function () {
        aiActive -= 1;
        drainAi();
      });
    }
  }

  function runAi(row, done) {
    if (!needsAi(row)) {
      if (done) done();
      return;
    }
    row._aiLoading = true;
    fetch(apiUrl("/api/mcq/gate/paper/" + encodeURIComponent(paperSlug) + "/solve-question"), {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: row.id,
        reviewToken: reviewToken,
        difficulty: "standard"
      })
    })
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error((j && j.error) || "Failed");
          return j;
        });
      })
      .then(function (data) {
        if (data && data.ok) mergeRow(row.id, data);
      })
      .catch(function () {
        /* keep static fallback */
      })
      .finally(function () {
        row._aiLoading = false;
        row._aiQueued = false;
        if (done) done();
      });
  }

  function prefetchAi() {
    if (!gateAiSolver || !payload) return;
    (payload.review || []).forEach(function (row) {
      if (needsAi(row)) fetchAi(row);
    });
  }

  function renderPanel() {
    if (!payload || !window.GateExamSolution) return;
    window.GateExamSolution.render(submitShape(payload), "solutionsBody", { skipScore: false });
    var math = window.ResearchiumMath;
    var root = $("solutionsBody");
    if (math && root) {
      math.enhanceRoot(root).catch(function () {
        if (math.applyFallback) math.applyFallback(root);
      });
    }
  }

  function showEmpty() {
    $("solutionsEmpty").classList.remove("gate-hidden");
    $("solutionsContent").classList.add("gate-hidden");
  }

  function showContent() {
    $("solutionsEmpty").classList.add("gate-hidden");
    $("solutionsContent").classList.remove("gate-hidden");
  }

  function init() {
    payload = loadPayload();
    if (!payload) {
      showEmpty();
      return;
    }

    reviewToken = payload.reviewToken || "";
    paperSlug = String(payload.paperSlug || payload.year || "").trim();
    gateAiSolver = !!payload.aiSolver;

    var s = payload.summary || {};
    $("solPageTitle").textContent = payload.title || "GATE examination solutions";
    $("solPageSub").textContent =
      "Score " +
      s.score +
      " / " +
      s.maxMarks +
      " (" +
      (s.percentage != null ? s.percentage : "—") +
      "%) · Correct " +
      s.correct +
      " · Wrong " +
      s.wrong +
      " · Skipped " +
      s.unattempted;

    var back = payload.backUrl || "/mcq-test.html#mock-test-series";
    var reviewLink = $("solLinkReview");
    if (reviewLink) {
      var sep = back.indexOf("?") >= 0 ? "&" : "?";
      reviewLink.href = back + sep + "review=1";
    }

    showContent();
    renderPanel();
    prefetchAi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

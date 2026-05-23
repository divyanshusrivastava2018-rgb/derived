/**
 * GATE CBT mock — uses ResearchiumErrors (researchium-errors.js) + ResearchiumApi (researchium-core.js).
 */
(function () {
  "use strict";

  var Err = window.ResearchiumErrors || {};

  var params = new URLSearchParams(window.location.search);
  var year = params.get("year") || params.get("paper") || "2024";
  var candidate = params.get("name") || "Candidate";

  var paper = null;
  var sessionId = "";
  var gatePracticeOnly = false;
  var reviewMode = false;
  var reviewById = {};
  var submitResult = null;
  var allQuestions = [];
  var currentIndex = 0;
  var currentSectionKey = "";
  var timerSeconds = 0;
  var timerHandle = null;

  var VIEWS = [
    "view-login",
    "view-instructions",
    "view-paper-instructions",
    "view-exam",
    "view-result"
  ];

  /** @type {Record<string, { visited: boolean, answer: number|null, marked: boolean }>} */
  var state = {};

  function $(id) {
    return document.getElementById(id);
  }

  function escText(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function formatErrMessage(err) {
    if (Err.formatErrMessage) return Err.formatErrMessage(err);
    return err && err.message ? String(err.message) : "Something went wrong. Please try again.";
  }

  function errorToMessage(err, fallback) {
    var msg = Err.formatErrMessage ? Err.formatErrMessage(err) : formatErrMessage(err);
    if (msg && msg.indexOf("unknown error") === -1) return msg;
    return fallback || "Something went wrong. Please try again.";
  }

  function apiUrl(path) {
    if (window.ResearchiumApi && window.ResearchiumApi.url) {
      return window.ResearchiumApi.url(path);
    }
    return path.charAt(0) === "/" ? path : "/" + path;
  }

  function parseApiBody(r, text) {
    var body = text == null ? "" : String(text).trim();
    if (!body) {
      throw new Error("Empty response from server. Start the app with npm start.");
    }
    if (body.charAt(0) === "<") {
      throw new Error(
        "API is not reachable (got HTML). Run the Node server and proxy /api to it, or use the same host as the API."
      );
    }
    try {
      return JSON.parse(body);
    } catch (parseErr) {
      throw new Error("Could not read server data (invalid JSON, status " + r.status + ").");
    }
  }

  function gateFetch(path, opts) {
    var options = Object.assign(
      {
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      },
      opts || {}
    );
    if (options.body && typeof options.body === "object") {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    return fetch(apiUrl(path), options).then(function (r) {
      return r.text().then(function (text) {
        var json = parseApiBody(r, text);
        if (!r.ok) {
          var fail = Err.httpFailPayload
            ? Err.httpFailPayload(r.status, json)
            : { status: r.status, error: json && json.error, message: json && json.message };
          throw fail;
        }
        return json;
      });
    }).catch(function (networkErr) {
      if (networkErr && networkErr.status) throw networkErr;
      throw new Error(Err.errorToMessage ? Err.errorToMessage(networkErr) : "Network error");
    });
  }

  function gateStartPath() {
    return "/api/mcq/gate/paper/" + encodeURIComponent(year) + "/start";
  }

  function gateSubmitPath() {
    return "/api/mcq/gate/paper/" + encodeURIComponent(year) + "/submit";
  }

  function gatePaperPath() {
    return "/api/mcq/gate/paper/" + encodeURIComponent(year);
  }

  function loadOfflinePaper() {
    return fetch("/data/offline-gate-exams.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("offline");
        return r.json();
      })
      .then(function (data) {
        var key = String(year).trim();
        return (data && (data[key] || data[year])) || null;
      });
  }

  function applyLoadedPaper(p) {
    paper = p;
    if (!paper) throw new Error("Exam paper data is missing.");
    document.title = paper.title + " — Online Assessment";
    if ($("durText")) $("durText").textContent = String(paper.durationMinutes);
    timerSeconds = (paper.durationMinutes || 180) * 60;
    if ($("examTimer")) $("examTimer").textContent = "Time Left : " + formatTime(timerSeconds);
    allQuestions = flatQuestions();
    if (!allQuestions.length) {
      throw new Error(
        "This paper has no questions. On the server run: npm run prepare:gate && npm run sync:mock-offline"
      );
    }
    var errBox = $("gateLoadError");
    if (errBox) errBox.style.display = "none";
    initState();
    fillLoginPanel();
    renderPaperTable();
  }

  function ensureGateSession() {
    if (sessionId && !gatePracticeOnly) return Promise.resolve(sessionId);
    return gateFetch(gateStartPath(), { method: "POST", body: {} }).then(function (j) {
      sessionId = j.sessionId || "";
      gatePracticeOnly = false;
      if (!sessionId) throw new Error("Could not start exam session.");
      return sessionId;
    });
  }

  function apiFailMessage(fail) {
    if (!fail) return "";
    if (Err.formatErrMessage) return Err.formatErrMessage(fail);
    if (fail.error) return String(fail.error);
    return "Request failed";
  }

  function isSessionOrRoute404(fail) {
    if (!fail || fail.status !== 404) return false;
    var msg = apiFailMessage(fail).toLowerCase();
    return (
      msg.indexOf("session") >= 0 ||
      msg.indexOf("expired") >= 0 ||
      msg.indexOf("not found") >= 0 ||
      msg.indexOf("api") >= 0
    );
  }

  function postGateSubmit(responses, allowRetry) {
    return gateFetch(gateSubmitPath(), {
      method: "POST",
      body: { sessionId: sessionId || "", responses: responses }
    }).catch(function (fail) {
      if (!allowRetry) throw fail;
      if (!isSessionOrRoute404(fail) && (!fail || fail.status !== 404)) throw fail;
      sessionId = "";
      return ensureGateSession().then(function () {
        return gateFetch(gateSubmitPath(), {
          method: "POST",
          body: { sessionId: sessionId, responses: responses }
        });
      });
    });
  }

  function showView(id) {
    VIEWS.forEach(function (v) {
      var el = $(v);
      if (el) el.classList.toggle("gate-hidden", v !== id);
    });
  }

  function flatQuestions() {
    var list = [];
    if (!paper) return list;
    paper.sections.forEach(function (sec) {
      sec.questions.forEach(function (q) {
        list.push({
          id: q.id,
          number: q.number,
          sectionKey: sec.key,
          sectionLabel: sec.label,
          type: q.type,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          text: q.text,
          options: q.options
        });
      });
    });
    return list;
  }

  function initState() {
    state = {};
    allQuestions.forEach(function (q) {
      state[q.id] = { visited: false, answer: null, marked: false };
    });
  }

  function statusOf(qid) {
    if (reviewMode && reviewById[qid]) {
      var rs = reviewById[qid].status;
      if (rs === "correct") return "review-correct";
      if (rs === "incorrect") return "review-wrong";
      return "review-skipped";
    }
    var s = state[qid];
    if (!s) return "not-visited";
    if (!s.visited) return "not-visited";
    if (s.answer !== null && s.answer >= 0) return s.marked ? "answered-marked" : "answered";
    if (s.marked) return "marked";
    return "not-answered";
  }

  function optionText(q, index) {
    if (!q || !q.options || index < 0 || index >= q.options.length) return "—";
    return "(" + (index + 1) + ") " + String(q.options[index]);
  }

  function renderScoreStrip(result) {
    var strip = $("gateScoreStrip");
    if (!strip || !result) return;
    strip.classList.remove("gate-hidden");
    if ($("gateScoreTitle")) {
      $("gateScoreTitle").textContent = (paper && paper.title) || "GATE Mock — Submitted";
    }
    if ($("gateScoreSub")) {
      $("gateScoreSub").textContent =
        "Score " + result.score + " / " + result.maxMarks + " · " + candidate;
    }
    if ($("gateScorePct")) $("gateScorePct").textContent = String(result.percentage) + "%";
    var cards = $("gateScoreCards");
    if (cards) {
      var items = [
        { label: "Marks", value: result.score + "/" + result.maxMarks },
        { label: "Correct", value: result.correct },
        { label: "Wrong", value: result.wrong },
        { label: "Skipped", value: result.unattempted },
        { label: "Attempted", value: result.attempted != null ? result.attempted : result.correct + result.wrong },
        { label: "Total Qs", value: result.total }
      ];
      cards.innerHTML = items
        .map(function (it) {
          return (
            '<div class="gate-score-card"><span class="gate-score-card__val">' +
            escText(String(it.value)) +
            '</span><span class="gate-score-card__lbl">' +
            escText(it.label) +
            "</span></div>"
          );
        })
        .join("");
    }
    var link = $("gateLinkAnalysis");
    if (link) link.style.display = result.review && result.review.length ? "" : "none";
  }

  function enterReviewMode(result) {
    submitResult = result;
    reviewMode = true;
    reviewById = {};
    (result.review || []).forEach(function (row) {
      if (row && row.id != null) reviewById[row.id] = row;
    });

    allQuestions.forEach(function (q) {
      var row = reviewById[q.id];
      if (!row) return;
      if (!state[q.id]) state[q.id] = { visited: true, answer: null, marked: false };
      state[q.id].visited = true;
      state[q.id].marked = false;
      if (row.selected != null && row.selected >= 0) state[q.id].answer = row.selected;
      else state[q.id].answer = null;
    });

    if (timerHandle) clearInterval(timerHandle);
    var timerEl = $("examTimer");
    if (timerEl) timerEl.textContent = "Submitted — review mode";

    var examView = $("view-exam");
    if (examView) examView.classList.add("gate-review-mode");

    renderScoreStrip(result);
    showView("view-exam");
    goToQuestion(0);
  }

  function formatTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function countStats() {
    var visited = 0;
    var notAns = 0;
    var ans = 0;
    var marked = 0;
    allQuestions.forEach(function (q) {
      var st = statusOf(q.id);
      if (st !== "not-visited") visited += 1;
      if (st === "not-answered" || st === "marked") notAns += st === "not-answered" ? 1 : 0;
      if (st === "answered" || st === "answered-marked") ans += 1;
      if (st === "marked" || st === "answered-marked") marked += 1;
    });
    notAns = allQuestions.filter(function (q) {
      var st = statusOf(q.id);
      return st === "not-answered" || st === "marked";
    }).length;
    return { visited: visited, notAns: notAns, ans: ans, marked: marked };
  }

  function renderPaletteStats() {
    var s = countStats();
    if ($("statVisited")) $("statVisited").textContent = String(s.visited);
    if ($("statNotAns")) $("statNotAns").textContent = String(s.notAns);
    if ($("statAns")) $("statAns").textContent = String(s.ans);
    if ($("statMarked")) $("statMarked").textContent = String(s.marked);
  }

  function startTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(function () {
      timerSeconds -= 1;
      var el = $("examTimer");
      if (el) el.textContent = "Time Left : " + formatTime(Math.max(0, timerSeconds));
      if (timerSeconds <= 0) {
        clearInterval(timerHandle);
        submitExam(true);
      }
    }, 1000);
  }

  function fillLoginPanel() {
    if (!paper) return;
    if ($("loginSystemId")) $("loginSystemId").textContent = "RSH-" + paper.subject + "-" + paper.year;
    if ($("loginSubject")) $("loginSubject").textContent = paper.title;
    if ($("loginDuration")) $("loginDuration").textContent = paper.durationMinutes + " minutes";
    if ($("examPaperTitle")) $("examPaperTitle").textContent = paper.subjectLabel || paper.title;
  }

  function renderPaperTable() {
    var body = $("paperMarksBody");
    if (!body || !paper) return;
    body.innerHTML = paper.sections
      .map(function (sec) {
        return (
          "<tr><td>" +
          sec.label +
          "</td><td>" +
          sec.marks1Count +
          "</td><td>" +
          sec.marks2Count +
          "</td></tr>"
        );
      })
      .join("");
    var totalQ = allQuestions.length;
    var totalM = allQuestions.reduce(function (n, q) {
      return n + q.marks;
    }, 0);
    var pt = $("paperInstrText");
    if (pt)
      pt.innerHTML =
        "This examination has <strong>" +
        totalQ +
        "</strong> questions for <strong>" +
        totalM +
        "</strong> marks.";
  }

  function renderSectionTabs() {
    var tabs = $("sectionTabs");
    if (!tabs || !paper) return;
    tabs.innerHTML = paper.sections
      .map(function (sec) {
        var active = sec.key === currentSectionKey ? " active" : "";
        return (
          '<button type="button" class="gate-exam-tab' +
          active +
          '" data-sec="' +
          sec.key +
          '">' +
          sec.label +
          "</button>"
        );
      })
      .join("");
    tabs.querySelectorAll(".gate-exam-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentSectionKey = btn.getAttribute("data-sec");
        var first = allQuestions.findIndex(function (q) {
          return q.sectionKey === currentSectionKey;
        });
        if (first >= 0) goToQuestion(first);
        renderSectionTabs();
      });
    });
  }

  function renderPalette() {
    var grid = $("questionPalette");
    var label = $("paletteSectionLabel");
    if (!grid) return;
    var secQuestions = allQuestions.filter(function (q) {
      return q.sectionKey === currentSectionKey;
    });
    if (label) label.textContent = secQuestions[0] ? secQuestions[0].sectionLabel : "Section";

    grid.innerHTML = secQuestions
      .map(function (q) {
        var globalIdx = allQuestions.findIndex(function (x) {
          return x.id === q.id;
        });
        var st = statusOf(q.id);
        var cur = globalIdx === currentIndex ? " current" : "";
        return (
          '<button type="button" class="gate-q-btn ' +
          st +
          cur +
          '" data-idx="' +
          globalIdx +
          '">' +
          q.number +
          "</button>"
        );
      })
      .join("");

    grid.querySelectorAll(".gate-q-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        goToQuestion(parseInt(btn.getAttribute("data-idx"), 10));
      });
    });
    renderPaletteStats();
  }

  function renderSolutionPanel(q, row) {
    var panel = $("qSolution");
    if (!panel) return;
    if (!reviewMode || !row) {
      panel.classList.add("gate-hidden");
      panel.innerHTML = "";
      return;
    }

    var status = row.status || "skipped";
    panel.classList.remove("gate-hidden", "gate-solution--correct", "gate-solution--incorrect", "gate-solution--skipped");
    panel.classList.add(
      status === "correct"
        ? "gate-solution--correct"
        : status === "incorrect"
          ? "gate-solution--incorrect"
          : "gate-solution--skipped"
    );

    var statusLabel =
      status === "correct" ? "Correct" : status === "incorrect" ? "Incorrect" : "Not attempted";
    var yourIdx = row.selected;
    var correctIdx = row.correctIndex;
    var marksLine =
      row.marksAwarded > 0
        ? "+" + row.marksAwarded + " marks"
        : row.marksAwarded < 0
          ? row.marksAwarded + " marks (negative marking)"
          : status === "skipped"
            ? "0 marks (unattempted)"
            : "0 marks";

    var math = window.ResearchiumMath;
    var yourRaw =
      yourIdx != null && yourIdx >= 0 ? q.options[yourIdx] : null;
    var correctRaw =
      correctIdx != null && correctIdx >= 0 ? q.options[correctIdx] : null;

    function fmtOpt(raw, idx) {
      if (raw == null) return "Not attempted";
      var label = "(" + (idx + 1) + ") ";
      if (math) return label + math.toMathHtml(raw);
      return escText(label + String(raw));
    }

    panel.innerHTML =
      "<strong>Solution · " +
      escText(statusLabel) +
      " (" +
      escText(marksLine) +
      ")</strong>" +
      "<p><strong>Your answer:</strong> <span class=\"math-content\">" +
      (yourRaw != null ? fmtOpt(yourRaw, yourIdx) : "Not attempted") +
      "</span></p>" +
      "<p><strong>Correct answer:</strong> <span class=\"math-content\">" +
      (correctRaw != null ? fmtOpt(correctRaw, correctIdx) : "—") +
      "</span></p>";

    if (math) {
      math.enhanceRoot(panel).catch(function () {
        if (math.applyFallback) math.applyFallback(panel);
      });
    }
  }

  function renderQuestion() {
    var q = allQuestions[currentIndex];
    if (!q) return;
    if (!reviewMode) state[q.id].visited = true;
    currentSectionKey = q.sectionKey;

    $("qNumber").textContent = "Question No. " + q.number;
    var math = window.ResearchiumMath;
    var opts = $("qOptions");
    var sel = state[q.id].answer;
    var row = reviewById[q.id];

    $("qMarksLine").textContent = reviewMode
      ? "Review mode — correct option highlighted in green"
      : "Marks for correct answer: " + q.marks + " | Negative Marks: " + q.negativeMarks;

    if (opts) {
      opts.innerHTML = q.options
        .map(function (op, i) {
          var checked = sel === i ? " checked" : "";
          var opHtml = math ? math.toMathHtml(op) : escText(op);
          var a11y = math ? math.latexToAccessibleText(op) : op;
          var cls = "gate-opt-neutral";
          if (reviewMode && row && row.correctIndex === i) cls = "gate-opt-correct";
          else if (reviewMode && row && row.selected === i && row.status === "incorrect") cls = "gate-opt-wrong";
          var disabled = reviewMode ? " disabled" : "";
          return (
            '<label class="' +
            cls +
            '"><input type="radio" name="gateOpt" value="' +
            i +
            '"' +
            checked +
            disabled +
            ' aria-label="Option ' +
            (i + 1) +
            ": " +
            a11y +
            '" /> <span class="gate-opt-text" role="math">(' +
            (i + 1) +
            ") " +
            opHtml +
            "</span></label>"
          );
        })
        .join("");
    }

    function typesetOptions() {
      if (math && opts) return math.typeset(opts);
      return Promise.resolve();
    }

    function afterContent() {
      typesetOptions().then(function () {
        renderSolutionPanel(q, row);
      });
    }

    if (math && $("qText")) {
      math.setMathHtml($("qText"), q.text).then(afterContent);
    } else {
      if ($("qText")) $("qText").textContent = q.text;
      afterContent();
    }

    renderSectionTabs();
    renderPalette();
  }

  function goToQuestion(idx) {
    if (idx < 0 || idx >= allQuestions.length) return;
    currentIndex = idx;
    currentSectionKey = allQuestions[idx].sectionKey;
    renderQuestion();
  }

  function saveCurrentAnswer() {
    if (reviewMode) return;
    var q = allQuestions[currentIndex];
    if (!q) return;
    var picked = document.querySelector('input[name="gateOpt"]:checked');
    if (picked) {
      state[q.id].answer = parseInt(picked.value, 10);
      state[q.id].marked = false;
    }
  }

  function showGateAlert(message, title) {
    if (Err.showErrorModal) {
      Err.showErrorModal(message, title || "Notice");
      return;
    }
    window.alert(errorToMessage(message, "Something went wrong. Please try again."));
  }

  function confirmSubmitExam() {
    return new Promise(function (resolve) {
      var modal = $("gateSubmitModal");
      if (!modal) {
        resolve(
          window.confirm(
            "Submit examination? You cannot change your answers after submission."
          )
        );
        return;
      }
      var confirmBtn = $("btnSubmitConfirm");
      var cancelBtn = $("btnSubmitCancel");
      modal.classList.remove("gate-hidden");

      function finish(ok) {
        modal.classList.add("gate-hidden");
        if (confirmBtn) confirmBtn.removeEventListener("click", onConfirm);
        if (cancelBtn) cancelBtn.removeEventListener("click", onCancel);
        document.removeEventListener("keydown", onKey);
        resolve(ok);
      }

      function onConfirm() {
        finish(true);
      }
      function onCancel() {
        finish(false);
      }
      function onKey(e) {
        if (e.key === "Escape") onCancel();
      }

      if (confirmBtn) confirmBtn.addEventListener("click", onConfirm);
      if (cancelBtn) cancelBtn.addEventListener("click", onCancel);
      document.addEventListener("keydown", onKey);
      if (cancelBtn) cancelBtn.focus();
    });
  }

  function runSubmitExam() {
    saveCurrentAnswer();
    if (timerHandle) clearInterval(timerHandle);

    var responses = {};
    allQuestions.forEach(function (q) {
      var s = state[q.id];
      responses[q.id] = s && s.answer !== null ? s.answer : -1;
    });

    ensureGateSession()
      .then(function () {
        return postGateSubmit(responses, true);
      })
      .then(function (j) {
        if ($("resultTitle")) $("resultTitle").textContent = paper.title + " — Submitted";
        if ($("resultScore")) {
          $("resultScore").textContent = "Score: " + j.score + " / " + j.maxMarks + " (" + j.percentage + "%)";
        }
        if ($("resultDetail")) {
          $("resultDetail").textContent =
            "Correct: " + j.correct + " · Wrong: " + j.wrong + " · Unattempted: " + j.unattempted;
        }
        if (j.review && j.review.length) {
          try {
            var analysisPayload = {
              type: "gate",
              title: j.title || paper.title,
              completedAt: new Date().toISOString(),
              backUrl:
                "/gate-exam.html?year=" + encodeURIComponent(year) + "&name=" + encodeURIComponent(candidate),
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
              review: j.review
            };
            sessionStorage.setItem("researchium_mock_analysis", JSON.stringify(analysisPayload));
            var btnAnalysis = $("btnViewAnalysis");
            if (btnAnalysis) btnAnalysis.style.display = "";
          } catch (storageErr) {
            /* private mode / quota */
          }
          enterReviewMode(j);
        } else {
          showView("view-result");
        }
        if (window.ResearchiumProgress && window.ResearchiumProgress.record) {
          window.ResearchiumProgress.record({
            type: "gate_submit",
            label: (paper.title || "GATE mock") + " " + year,
            score: j.score,
            total: j.maxMarks
          });
        }
      })
      .catch(function (err) {
        var msg = Err.formatErrMessage ? Err.formatErrMessage(err) : errorToMessage(err, "");
        if (gatePracticeOnly && msg.toLowerCase().indexOf("api") >= 0) {
          msg =
            "Scoring needs the live API. Start the server (npm start) and open this site from the same host, not static files only.";
        }
        showGateAlert(msg || "Submission failed. Refresh the page and try again.", "Submission failed");
      });
  }

  function submitExam(auto) {
    if (auto) {
      runSubmitExam();
      return;
    }
    confirmSubmitExam().then(function (ok) {
      if (ok) runSubmitExam();
    });
  }

  function bindEvents() {
    $("btnSignIn").addEventListener("click", function () {
      showView("view-instructions");
    });

    $("linkVerifyPhoto").addEventListener("click", function (e) {
      e.preventDefault();
      showGateAlert(
        "This is a practice session. Contact your test administrator if your details are incorrect.",
        "Candidate details"
      );
    });

    $("btnToPaperInstr").addEventListener("click", function () {
      showView("view-paper-instructions");
    });
    $("btnToGeneralInstr").addEventListener("click", function () {
      showView("view-instructions");
    });
    $("declareReady").addEventListener("change", function () {
      $("btnBeginExam").disabled = !this.checked;
    });
    $("btnBeginExam").addEventListener("click", function () {
      if (!allQuestions.length) {
        showGateAlert(
          "This examination could not be loaded. Return to the mock test series and try again.",
          "Cannot start exam"
        );
        return;
      }
      showView("view-exam");
      startTimer();
      goToQuestion(0);
    });
    $("btnSaveNext").addEventListener("click", function () {
      saveCurrentAnswer();
      if (currentIndex < allQuestions.length - 1) goToQuestion(currentIndex + 1);
      else renderPalette();
    });
    $("btnPrevQ").addEventListener("click", function () {
      saveCurrentAnswer();
      if (currentIndex > 0) goToQuestion(currentIndex - 1);
    });
    $("btnMarkReview").addEventListener("click", function () {
      var q = allQuestions[currentIndex];
      if (q) {
        state[q.id].marked = true;
        state[q.id].answer = null;
      }
      if (currentIndex < allQuestions.length - 1) goToQuestion(currentIndex + 1);
      else renderPalette();
    });
    $("btnClear").addEventListener("click", function () {
      var q = allQuestions[currentIndex];
      if (q) {
        state[q.id].answer = null;
        state[q.id].marked = false;
      }
      renderQuestion();
    });
    $("btnSubmitExam").addEventListener("click", function () {
      if (reviewMode) return;
      submitExam(false);
    });
    $("btnCloseWindow").addEventListener("click", function () {
      window.location.assign("/mcq-test.html#mock-test-series");
    });
    $("btnCalculator").addEventListener("click", function () {
      $("gateCalcModal").classList.remove("gate-hidden");
    });
    $("btnCloseCalc").addEventListener("click", function () {
      $("gateCalcModal").classList.add("gate-hidden");
    });
  }

  function setCandidateNames() {
    [
      "loginCandidateName",
      "candidateName",
      "candidateName2",
      "candidateName3"
    ].forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = candidate;
    });
  }

  function showGateLoadError(message) {
    var msg = errorToMessage(
      message,
      "Could not load this examination. Start the server with npm start, or run npm run prepare:gate on deploy."
    );
    var login = $("view-login");
    var main = login && login.querySelector(".gate-login-main");
    var box = $("gateLoadError");
    if (!box) {
      box = document.createElement("div");
      box.id = "gateLoadError";
      box.className = "gate-load-error";
      if (main) {
        main.insertBefore(box, main.firstChild);
      } else if (login) {
        login.prepend(box);
      }
    }
    if (box) {
      box.innerHTML =
        "<p>" +
        escText(msg) +
        '</p><p style="margin-top:10px"><button type="button" class="gate-btn-nav" id="btnRetryGateLoad">Retry</button> ' +
        '<a href="/mcq-test.html#mock-test-series" class="gate-btn-nav" style="display:inline-block;margin-left:8px;text-decoration:none">Mock tests</a></p>';
      box.style.display = "block";
      var retry = document.getElementById("btnRetryGateLoad");
      if (retry) {
        retry.addEventListener("click", function () {
          box.style.display = "none";
          loadPaper().catch(function (err) {
            showGateLoadError(err);
          });
        });
      }
    }
    var begin = $("btnBeginExam");
    if (begin) begin.disabled = true;
  }

  function loadPaper() {
    gatePracticeOnly = false;
    return gateFetch(gateStartPath(), { method: "POST", body: {} })
      .then(function (j) {
        sessionId = j.sessionId || "";
        if (!sessionId) throw new Error("Exam session could not be created.");
        applyLoadedPaper(j.paper);
      })
      .catch(function (startErr) {
        return gateFetch(gatePaperPath(), { method: "GET" })
          .then(function (paperOnly) {
            gatePracticeOnly = true;
            sessionId = "";
            applyLoadedPaper(paperOnly);
            showGateLoadNotice(
              "Loaded in practice mode. Scoring needs the API — click Retry after starting the server."
            );
          })
          .catch(function () {
            return loadOfflinePaper().then(function (offlinePaper) {
              if (!offlinePaper) throw startErr;
              gatePracticeOnly = true;
              sessionId = "";
              applyLoadedPaper(offlinePaper);
              showGateLoadNotice(
                "Offline paper loaded. Start the Node server (npm start) before submitting for a score."
              );
            });
          });
      });
  }

  function showGateLoadNotice(message) {
    var box = $("gateLoadError");
    if (!box) return;
    box.innerHTML = "<p>" + escText(message) + "</p>";
    box.style.display = "block";
    box.style.background = "#e8f4fc";
    box.style.borderColor = "#2e6da4";
    box.style.color = "#1a4d7a";
  }

  setCandidateNames();
  bindEvents();
  showView("view-login");

  loadPaper().catch(function (err) {
    showGateLoadError(err);
  });
})();

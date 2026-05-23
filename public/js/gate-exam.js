(function () {
  var params = new URLSearchParams(window.location.search);
  var year = params.get("year") || params.get("paper") || "2024";
  var candidate = params.get("name") || "Candidate";

  var paper = null;
  var sessionId = "";
  var gatePracticeOnly = false;
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
          throw new Error((json && json.error) || "Request failed (" + r.status + ")");
        }
        return json;
      });
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
    var s = state[qid];
    if (!s) return "not-visited";
    if (!s.visited) return "not-visited";
    if (s.answer !== null && s.answer >= 0) return s.marked ? "answered-marked" : "answered";
    if (s.marked) return "marked";
    return "not-answered";
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

  function renderQuestion() {
    var q = allQuestions[currentIndex];
    if (!q) return;
    state[q.id].visited = true;
    currentSectionKey = q.sectionKey;

    $("qNumber").textContent = "Question No. " + q.number;
    var math = window.ResearchiumMath;
    var opts = $("qOptions");
    var sel = state[q.id].answer;

    $("qMarksLine").textContent =
      "Marks for correct answer: " +
      q.marks +
      " | Negative Marks: " +
      q.negativeMarks;

    if (opts) {
      opts.innerHTML = q.options
        .map(function (op, i) {
          var checked = sel === i ? " checked" : "";
          var opHtml = math ? math.toMathHtml(op) : op;
          var a11y = math ? math.latexToAccessibleText(op) : op;
          return (
            '<label><input type="radio" name="gateOpt" value="' +
            i +
            '"' +
            checked +
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

    if (math && $("qText")) {
      math.setMathHtml($("qText"), q.text).then(typesetOptions);
    } else {
      if ($("qText")) $("qText").textContent = q.text;
      typesetOptions();
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
    var q = allQuestions[currentIndex];
    if (!q) return;
    var picked = document.querySelector('input[name="gateOpt"]:checked');
    if (picked) {
      state[q.id].answer = parseInt(picked.value, 10);
      state[q.id].marked = false;
    }
  }

  function showGateAlert(message, title) {
    var modal = $("gateAlertModal");
    var textEl = $("gateAlertText");
    var titleEl = $("gateAlertTitle");
    var okBtn = $("btnAlertOk");
    if (!modal) {
      window.alert(message);
      return;
    }
    if (titleEl) titleEl.textContent = title || "Notice";
    if (textEl) textEl.textContent = message || "";
    modal.classList.remove("gate-hidden");
    function close() {
      modal.classList.add("gate-hidden");
      if (okBtn) okBtn.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape" || e.key === "Enter") close();
    }
    if (okBtn) {
      okBtn.addEventListener("click", close);
      okBtn.focus();
    }
    document.addEventListener("keydown", onKey);
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
        return gateFetch(gateSubmitPath(), {
          method: "POST",
          body: { sessionId: sessionId, responses: responses }
        });
      })
      .then(function (j) {
        showView("view-result");
        $("resultTitle").textContent = paper.title + " — Submitted";
        $("resultScore").textContent = "Score: " + j.score + " / " + j.maxMarks + " (" + j.percentage + "%)";
        $("resultDetail").textContent =
          "Correct: " + j.correct + " · Wrong: " + j.wrong + " · Unattempted: " + j.unattempted;
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
        showGateAlert(
          (err && err.message) ||
            "Could not submit. Ensure the Node server is running (npm start) and try again.",
          "Submission failed"
        );
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
      alert("This is a practice session. Contact your test administrator if your details are incorrect.");
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
        alert("This examination could not be loaded. Return to the mock test series and try again.");
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
    var msg =
      message ||
      "Could not load this examination. Start the server with npm start, or run npm run prepare:gate on deploy.";
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
            showGateLoadError(err && err.message ? err.message : null);
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
    showGateLoadError(err && err.message ? err.message : null);
  });
})();

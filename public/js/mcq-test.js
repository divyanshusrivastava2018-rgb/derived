(function () {
  var topicEl = document.getElementById("mcqTopic");
  if (
    !topicEl ||
    !document.getElementById("mcqCount") ||
    !document.getElementById("btnGenerateMcq") ||
    !document.getElementById("btnSubmitMcq") ||
    !document.getElementById("mcqForm") ||
    !document.getElementById("mcqResult")
  ) {
    return;
  }
  var countEl = document.getElementById("mcqCount");
  var genBtn = document.getElementById("btnGenerateMcq");
  var submitBtn = document.getElementById("btnSubmitMcq");
  var formEl = document.getElementById("mcqForm");
  var resultEl = document.getElementById("mcqResult");
  var currentQuestions = [];
  var currentTestId = "";

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = String(s == null ? "" : s);
    return d.innerHTML;
  }

  function loadTopics() {
    return fetch("/api/mcq/topics")
      .then(function (r) {
        if (!r.ok) throw new Error("topics");
        return r.json();
      })
      .then(function (j) {
        var topics = Array.isArray(j.topics) ? j.topics : [];
        if (!topics.length) topics = ["JEE / NEET"];
        topicEl.innerHTML = topics
          .map(function (t) {
            return '<option value="' + esc(t) + '">' + esc(t) + "</option>";
          })
          .join("");
      })
      .catch(function () {
        topicEl.innerHTML = '<option value="JEE / NEET">JEE / NEET</option>';
      });
  }

  function renderQuestions(questions) {
    if (!questions.length) {
      formEl.innerHTML = "<p>No questions generated.</p>";
      return;
    }
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
              '"/> ' +
              esc(op) +
              "</label>"
            );
          })
          .join("");
        return (
          '<div class="mcq-card"><p class="mcq-q"><strong>Q' +
          (idx + 1) +
          ".</strong> " +
          esc(q.question) +
          "</p>" +
          options +
          "</div>"
        );
      })
      .join("");
  }

  function generate() {
    resultEl.textContent = "";
    var payload = {
      topic: topicEl.value,
      count: Number(countEl.value) || 10
    };
    formEl.innerHTML = '<p class="loading-banner">Generating questions...</p>';
    fetch("/api/mcq/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        if (!r.ok) throw new Error("generate");
        return r.json();
      })
      .then(function (j) {
        currentTestId = j.testId || "";
        currentQuestions = Array.isArray(j.questions) ? j.questions : [];
        renderQuestions(currentQuestions);
        submitBtn.disabled = currentQuestions.length === 0;
      })
      .catch(function () {
        formEl.innerHTML = '<p class="yt-pl-error">Could not generate test. Try again.</p>';
        submitBtn.disabled = true;
      });
  }

  function submitTest() {
    if (!currentQuestions.length || !currentTestId) return;
    var answers = currentQuestions.map(function (_q, idx) {
      var selected = formEl.querySelector('input[name="q' + idx + '"]:checked');
      return selected ? Number(selected.value) : -1;
    });
    fetch("/api/mcq/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testId: currentTestId, answers: answers })
    })
      .then(function (r) {
        if (!r.ok) throw new Error("submit");
        return r.json();
      })
      .then(function (j) {
        resultEl.textContent =
          "Your score: " +
          j.score +
          " / " +
          j.total +
          " (" +
          j.percentage +
          "%)";
      })
      .catch(function () {
        resultEl.textContent = "Could not submit this test. Generate a new one and try again.";
      });
  }

  genBtn.addEventListener("click", generate);
  submitBtn.addEventListener("click", submitTest);
  loadTopics();
})();

(function () {
  "use strict";

  var ham = document.querySelector(".ham");
  var links = document.querySelector(".nav-links");
  var actions = document.querySelector(".nav-actions");
  if (ham && links) {
    ham.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      if (actions) actions.classList.toggle("is-open", open);
      ham.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function setStat(id, value) {
    var el = document.getElementById(id);
    if (el && value != null) el.textContent = String(value);
  }

  fetch("/api/goal/stats")
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (s) {
      if (!s) return;
      if (s.learners) {
        setStat("rmBandLearners", s.learners.replace(/\+$/, ""));
        setStat("rmProofLearners", s.learners.replace(/\+$/, ""));
      }
      if (s.educators != null) {
        var edu = String(s.educators).replace(/\+$/, "");
        setStat("rmBandEducators", edu);
      }
    })
    .catch(function () {});
})();

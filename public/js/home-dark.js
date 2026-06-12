(function () {
  "use strict";

  var toggle = document.querySelector(".nav-hamburger");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
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
        setStat("rmStatLearners", s.learners);
        setStat("rmBandLearners", s.learners);
      }
      if (s.educators != null) {
        var edu = String(s.educators) + "+";
        setStat("rmStatEducators", edu);
        setStat("rmBandEducators", edu);
      }
    })
    .catch(function () {});
})();

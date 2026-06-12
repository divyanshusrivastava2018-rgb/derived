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

})();

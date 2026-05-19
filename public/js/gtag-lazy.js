/** Load Google Analytics after first paint (idle / load). */
(function () {
  function loadGtag() {
    if (window.__researchiumGtagLoaded) return;
    window.__researchiumGtagLoaded = true;
    var ext = document.createElement("script");
    ext.async = true;
    ext.src = "https://www.googletagmanager.com/gtag/js?id=G-FZP26CRWV1";
    ext.onload = function () {
      var init = document.createElement("script");
      init.src = "/js/gtag-init.js";
      document.head.appendChild(init);
    };
    document.head.appendChild(ext);
  }

  if ("requestIdleCallback" in window) {
    requestIdleCallback(loadGtag, { timeout: 3500 });
  } else {
    window.addEventListener("load", loadGtag, { once: true });
  }
})();

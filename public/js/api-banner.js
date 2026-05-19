(function () {
  if (!window.ResearchiumApi) return;

  function showBanner() {
    if (document.getElementById("researchium-api-banner")) return;
    var el = document.createElement("div");
    el.id = "researchium-api-banner";
    el.className = "api-offline-banner";
    el.setAttribute("role", "status");
    var origin = window.location.origin || "";
    var isFile = window.location.protocol === "file:";
    var isLocal =
      origin.indexOf("localhost") !== -1 ||
      origin.indexOf("127.0.0.1") !== -1 ||
      origin.indexOf("[::1]") !== -1;
    var msg;
    if (isFile) {
      msg =
        "Open this site through the server: run <code>npm start</code> then visit <a href=\"http://localhost:3000\">http://localhost:3000</a>";
    } else if (isLocal) {
      msg =
        "API unavailable — run <code>npm start</code> in the project folder, then refresh <a href=\"http://localhost:3000\">http://localhost:3000</a>";
    } else {
      msg =
        "Live API is offline — showing cached content. Deploy the Node server (<code>npm start</code>) for full features.";
    }
    el.innerHTML = "<p>" + msg + "</p>";
    document.body.insertBefore(el, document.body.firstChild);
    if (document.body.classList.contains("eduthink-home")) {
      document.body.style.paddingTop = "calc(72px + 48px)";
    } else if (document.body.classList.contains("site-page")) {
      document.body.style.paddingTop = "calc(76px + 48px)";
    }
  }

  window.ResearchiumApi.checkHealth().then(function (ok) {
    if (!ok) showBanner();
  });
})();

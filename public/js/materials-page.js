(function () {
  var grid = document.querySelector(".materials-grid");
  if (!grid) return;

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  grid.innerHTML = '<p class="admin-muted">Loading study materials…</p>';

  var load =
    window.ResearchiumApi && window.ResearchiumApi.get
      ? window.ResearchiumApi.get("/api/materials")
      : fetch("/api/materials").then(function (r) {
          if (!r.ok) throw new Error("load");
          return r.json();
        });
  load
    .then(function (items) {
      if (!Array.isArray(items) || !items.length) {
        grid.innerHTML =
          '<p class="admin-muted">No materials listed yet. Staff can add PDFs from the admin dashboard.</p>';
        return;
      }
      grid.innerHTML = items
        .map(function (m) {
          var url = m.fileUrl || "#";
          return (
            '<div class="material-card">' +
            "<h3>" +
            esc(m.title) +
            "</h3>" +
            '<a href="' +
            esc(url) +
            '" target="_blank" rel="noopener noreferrer">Download PDF</a>' +
            "</div>"
          );
        })
        .join("");
    })
    .catch(function () {
      grid.innerHTML =
        '<p class="admin-muted">Could not load materials. Run <code>npm start</code> and open this page from <code>http://localhost:3000</code>.</p>';
    });
})();

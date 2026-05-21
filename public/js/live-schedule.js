(function () {
  var root = document.getElementById("live-schedule-list");
  if (!root) return;

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function safeHref(u) {
    u = String(u || "#").trim();
    if (u.startsWith("/")) return u;
    if (/^https?:\/\//i.test(u)) return u;
    return "#";
  }

  var loadSite =
    window.ResearchiumSiteData && window.ResearchiumSiteData.fetchSite
      ? window.ResearchiumSiteData.fetchSite()
      : fetch("/api/site").then(function (r) {
          if (!r.ok) throw new Error();
          return r.json();
        });

  loadSite.then(function (site) {
      var rows = site.liveSchedule || [];
      if (!rows.length) {
        root.innerHTML = '<p class="loading-banner">No sessions scheduled.</p>';
        return;
      }
      root.innerHTML = rows
        .map(function (row) {
          var href = safeHref(row.linkHref);
          var label = row.linkLabel != null ? String(row.linkLabel) : "Open";
          return (
            '<div class="schedule-row">' +
            '<div class="schedule-time">' +
            esc(row.time) +
            '</div><div><div class="schedule-title">' +
            esc(row.title) +
            '</div><div class="schedule-meta">' +
            esc(row.meta) +
            '</div></div><a href="' +
            esc(href) +
            '">' +
            esc(label) +
            "</a></div>"
          );
        })
        .join("");
    })
    .catch(function () {
      root.innerHTML = "";
    });
})();

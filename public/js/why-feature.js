(function () {
  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = String(s == null ? "" : s);
    return d.innerHTML;
  }

  var slug = qs("slug") || "catalog";
  var titleEl = document.getElementById("whyFeatureTitle");
  var summaryEl = document.getElementById("whyFeatureSummary");
  var detailsEl = document.getElementById("whyFeatureDetails");
  var primaryEl = document.getElementById("whyFeaturePrimary");

  fetch("/api/why/" + encodeURIComponent(slug))
    .then(function (r) {
      if (!r.ok) throw new Error("not found");
      return r.json();
    })
    .then(function (f) {
      if (titleEl) titleEl.textContent = f.title || "Feature details";
      if (summaryEl) summaryEl.textContent = f.summary || "";
      document.title = (f.title ? f.title + " · " : "") + "Why Researchium";

      var details = Array.isArray(f.details) ? f.details : [];
      if (!details.length) {
        detailsEl.innerHTML = "<p>No details available yet.</p>";
      } else {
        detailsEl.innerHTML =
          "<ul>" +
          details
            .map(function (item) {
              return "<li>" + esc(item) + "</li>";
            })
            .join("") +
          "</ul>";
      }

      if (primaryEl) {
        primaryEl.href = f.primaryHref || "/index.html";
        primaryEl.textContent = f.primaryLabel || "Open related page";
      }
    })
    .catch(function () {
      if (titleEl) titleEl.textContent = "Feature not found";
      if (summaryEl) summaryEl.textContent = "This detail page could not be loaded.";
      if (detailsEl) detailsEl.innerHTML = '<p>Return to <a href="/index.html#features">Why Researchium</a>.</p>';
    });
})();

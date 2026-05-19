(function () {
  var key = document.body.getAttribute("data-cms-page");
  if (!key) return;

  var page = document.body.getAttribute("data-page") || "";
  var SAFE_TAGS = {
    SPAN: true,
    STRONG: true,
    EM: true,
    B: true,
    I: true,
    BR: true,
    A: true
  };

  function sanitizeHtml(input) {
    var tpl = document.createElement("template");
    tpl.innerHTML = String(input || "");
    var nodes = [tpl.content];
    while (nodes.length) {
      var root = nodes.pop();
      var all = root.querySelectorAll ? root.querySelectorAll("*") : [];
      all.forEach(function (el) {
        if (!SAFE_TAGS[el.tagName]) {
          el.replaceWith(document.createTextNode(el.textContent || ""));
          return;
        }
        var attrs = Array.from(el.attributes || []);
        attrs.forEach(function (a) {
          var n = a.name.toLowerCase();
          var v = a.value || "";
          if (n.startsWith("on")) el.removeAttribute(a.name);
          if (n === "style") el.removeAttribute("style");
          if (el.tagName === "A" && n === "href") {
            var ok = v.startsWith("/") || /^https?:\/\//i.test(v);
            if (!ok || /^javascript:/i.test(v)) {
              el.removeAttribute("href");
            } else {
              el.setAttribute("rel", "noopener noreferrer");
            }
          } else if (el.tagName !== "A") {
            el.removeAttribute(a.name);
          }
        });
      });
    }
    return tpl.innerHTML;
  }

  var loadSite =
    window.ResearchiumSiteData && window.ResearchiumSiteData.fetchSite
      ? window.ResearchiumSiteData.fetchSite()
      : fetch("/api/site").then(function (r) {
          if (!r.ok) throw new Error();
          return r.json();
        });

  loadSite
    .then(function (site) {
      var p = site.pageCopy && site.pageCopy[key];
      if (!p) return;

      var hero =
        key === "home" ? document.querySelector(".home-hero") : document.querySelector(".page-hero");
      if (!hero) return;

      if (p.secTag != null && String(p.secTag).trim() !== "" && page !== "courses") {
        var tag = hero.querySelector(".sec-tag");
        if (tag) tag.innerHTML = sanitizeHtml(p.secTag);
      }
      if (p.titleHtml != null && String(p.titleHtml).trim() !== "") {
        var h = hero.querySelector("h1");
        if (h) h.innerHTML = sanitizeHtml(p.titleHtml);
      }
      if (p.leadHtml != null && String(p.leadHtml).trim() !== "") {
        var lead = hero.querySelector(key === "home" ? ".lead" : ".page-hero > p");
        if (!lead && key !== "home") lead = hero.querySelector("p");
        if (lead) lead.innerHTML = sanitizeHtml(p.leadHtml);
      }
    })
    .catch(function () {});
})();

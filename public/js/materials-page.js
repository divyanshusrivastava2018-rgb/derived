(function () {
  var root = document.getElementById("materials-root");
  if (!root) return;

  var gridView = document.getElementById("materials-grid-view");
  var detailView = document.getElementById("materials-detail-view");
  var deptGrid = document.getElementById("dept-grid");
  var pdfGrid = document.getElementById("materials-pdf-grid");
  var detailTitle = document.getElementById("materials-detail-title");
  var detailMeta = document.getElementById("materials-detail-meta");
  var detailThumb = document.getElementById("materials-detail-thumb");
  var btnBack = document.getElementById("materials-back");

  var categoryMeta = [];
  var slugToMeta = {};
  var allItems = [];
  var activeCategoryName = "";

  var GATE_CATEGORY = "GATE Papers & Solutions";

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function extractGateYear(title) {
    var s = String(title || "");
    var m = s.match(/gate[\s_.-]*(20\d{2}|19\d{2})/i);
    if (m) return m[1];
    m = s.match(/gate[\s_.-]*?(\d{2})(?:[_\s.-]|\.pdf|$)/i);
    if (m) {
      var n = parseInt(m[1], 10);
      return n <= 30 ? "20" + m[1] : "19" + m[1];
    }
    m = s.match(/\bma(20\d{2})\b/i);
    if (m) return m[1];
    m = s.match(/\bma(\d{2})s/i);
    if (m) return "20" + m[1];
    m = s.match(/\b(20\d{2})\b/);
    if (m) return m[1];
    return null;
  }

  /** Short, readable label — GATE category shows year only (e.g. GATE 2024) */
  function formatPdfTitle(title, categoryName) {
    if (categoryName === GATE_CATEGORY) {
      var year = extractGateYear(title);
      return year ? "GATE " + year : "GATE";
    }

    var s = String(title || "").trim();
    if (!s) return "PDF";

    s = s
      .replace(/\.pdf$/i, "")
      .replace(/\s*\(\s*PDFDrive\s*\)\s*/gi, "")
      .replace(/\s*\(z-lib\.org\)\s*/gi, "")
      .replace(/[_\s-][a-f0-9]{20,}\b/gi, "")
      .replace(/_[a-f0-9]{16,}/gi, "")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    s = s.replace(/\s+(with|and|or|the|a|an|of|for)\s*$/i, "");

    var max = 48;
    if (s.length > max) {
      s = s.slice(0, max).replace(/\s+\S*$/, "").trim() + "…";
    }
    return s || "PDF";
  }

  function sortGateItems(items) {
    return items.slice().sort(function (a, b) {
      var ya = parseInt(extractGateYear(a.title) || "0", 10);
      var yb = parseInt(extractGateYear(b.title) || "0", 10);
      if (yb !== ya) return yb - ya;
      return String(a.title).localeCompare(String(b.title));
    });
  }

  function getQuerySlug() {
    var params = new URLSearchParams(window.location.search);
    return (params.get("category") || "").trim().toLowerCase();
  }

  function setQuerySlug(slug) {
    var url = new URL(window.location.href);
    if (slug) url.searchParams.set("category", slug);
    else url.searchParams.delete("category");
    history.pushState({ category: slug || null }, "", url.pathname + url.search);
  }

  function groupByCategory(items) {
    var groups = {};
    items.forEach(function (m) {
      var cat = m.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    });
    return groups;
  }

  function metaForCategory(name) {
    return (
      slugToMeta[name] ||
      categoryMeta.find(function (c) {
        return c.name === name;
      }) ||
      null
    );
  }

  function renderDeptGrid(groups) {
    if (!deptGrid) return;
    var cards = categoryMeta
      .map(function (meta) {
        var items = groups[meta.name];
        if (!items || !items.length) return "";
        return (
          '<a class="dept-card" href="?category=' +
          encodeURIComponent(meta.slug) +
          '" data-slug="' +
          esc(meta.slug) +
          '">' +
          '<img class="dept-card-img" src="' +
          esc(meta.image) +
          '" alt="' +
          esc(meta.name) +
          '" width="400" height="250" loading="lazy" />' +
          '<span class="dept-card-label">' +
          '<span class="dept-card-code">' +
          esc(meta.code) +
          "</span>" +
          '<span class="dept-card-name">' +
          esc(meta.name) +
          "</span>" +
          '<span class="dept-card-count">' +
          items.length +
          " PDF" +
          (items.length === 1 ? "" : "s") +
          "</span></span></a>"
        );
      })
      .filter(Boolean)
      .join("");

    if (!cards) {
      deptGrid.innerHTML =
        '<p class="materials-empty">No categorized materials yet.</p>';
      return;
    }
    deptGrid.innerHTML = cards;
  }

  function renderPdfCard(m) {
    var url = m.fileUrl || "#";
    var fullTitle = m.title || "PDF";
    var shortTitle = formatPdfTitle(fullTitle, activeCategoryName);
    return (
      '<article class="material-pdf-card">' +
      '<h3 class="material-pdf-title" title="' +
      esc(fullTitle) +
      '">' +
      esc(shortTitle) +
      "</h3>" +
      '<a href="' +
      esc(url) +
      '" target="_blank" rel="noopener noreferrer">Download PDF</a>' +
      "</article>"
    );
  }

  function showGrid() {
    activeCategoryName = "";
    if (gridView) gridView.classList.remove("materials-hidden");
    if (detailView) {
      detailView.classList.add("materials-hidden");
      detailView.hidden = true;
    }
    setQuerySlug("");
  }

  function showCategory(slug) {
    var meta = categoryMeta.find(function (c) {
      return c.slug === slug;
    });
    if (!meta) {
      showGrid();
      return;
    }
    var groups = groupByCategory(allItems);
    var items = groups[meta.name] || [];
    if (!items.length) {
      showGrid();
      return;
    }

    activeCategoryName = meta.name;
    if (meta.name === GATE_CATEGORY) items = sortGateItems(items);

    if (detailTitle) detailTitle.textContent = meta.name;
    if (detailMeta)
      detailMeta.textContent = items.length + " PDF" + (items.length === 1 ? "" : "s") + " available";
    if (detailThumb) {
      detailThumb.src = meta.image;
      detailThumb.alt = meta.name;
    }
    if (pdfGrid) pdfGrid.innerHTML = items.map(renderPdfCard).join("");

    if (gridView) gridView.classList.add("materials-hidden");
    if (detailView) {
      detailView.classList.remove("materials-hidden");
      detailView.hidden = false;
    }
    setQuerySlug(slug);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindNav() {
    if (btnBack) {
      btnBack.addEventListener("click", function () {
        showGrid();
      });
    }
    if (deptGrid) {
      deptGrid.addEventListener("click", function (e) {
        var card = e.target.closest(".dept-card");
        if (!card) return;
        e.preventDefault();
        var slug = card.getAttribute("data-slug");
        if (slug) showCategory(slug);
      });
    }
    window.addEventListener("popstate", function () {
      var slug = getQuerySlug();
      if (slug) showCategory(slug);
      else showGrid();
    });
  }

  function init(items) {
    allItems = items;
    var groups = groupByCategory(items);
    renderDeptGrid(groups);
    bindNav();
    var slug = getQuerySlug();
    if (slug) showCategory(slug);
    else showGrid();
  }

  function showError() {
    if (deptGrid)
      deptGrid.innerHTML =
        '<p class="materials-empty">Could not load materials. Run <code>npm start</code> and open <code>http://localhost:3000/study-materials.html</code>.</p>';
  }

  function showLoading() {
    if (deptGrid) deptGrid.innerHTML = '<p class="materials-loading">Loading study materials…</p>';
  }

  showLoading();

  Promise.all([
    fetch("/data/material-categories.json").then(function (r) {
      if (!r.ok) throw new Error("categories");
      return r.json();
    }),
    window.ResearchiumApi && window.ResearchiumApi.get
      ? window.ResearchiumApi.get("/api/materials")
      : fetch("/api/materials").then(function (r) {
          if (!r.ok) throw new Error("materials");
          return r.json();
        }),
  ])
    .then(function (res) {
      categoryMeta = res[0];
      categoryMeta.forEach(function (c) {
        slugToMeta[c.name] = c;
      });
      var items = res[1];
      if (!Array.isArray(items) || !items.length) {
        if (deptGrid)
          deptGrid.innerHTML =
            '<p class="materials-empty">No materials listed yet. Staff can add PDFs from the admin dashboard.</p>';
        return;
      }
      init(items);
    })
    .catch(showError);
})();

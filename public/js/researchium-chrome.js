/**
 * Researchium site chrome — Yes Officer–style header + footer.
 */
(function () {
  "use strict";

  var PAGE = document.body.getAttribute("data-page") || "";
  var LOGO_PNG = "/images/researchium-logo.png";
  var LOGO_FAVICON = "/images/researchium-favicon.png";
  var LOGO_VER = "header6";
  var LOGO_ALT = "Researchium — Exam prep, science and mathematics";

  function logoUrl() {
    return LOGO_PNG + "?v=" + LOGO_VER;
  }

  function brandLogoImg(className) {
    return (
      '<img src="' +
      logoUrl() +
      '" alt="' +
      LOGO_ALT +
      '" class="' +
      className +
      '" width="1024" height="210" decoding="async" fetchpriority="high" />'
    );
  }

  function initFavicon() {
    if (document.querySelector('link[data-rm-icon="1"]')) return;
    var link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    link.href = LOGO_FAVICON + "?v=" + LOGO_VER;
    link.setAttribute("data-rm-icon", "1");
    document.head.appendChild(link);
    var preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.href = logoUrl();
    document.head.appendChild(preload);
  }

  var NAV_LINKS = [
    { href: "/courses.html", label: "Courses", key: "courses" },
    { href: "/mcq-test.html", label: "Mock Tests", key: "mcq" },
    { href: "/study-materials.html", label: "Study Materials", key: "study" },
    { href: "/live-classes.html", label: "Live Classes", key: "live" },
    { href: "/pricing.html", label: "Plans", key: "pricing" },
    { href: "/csir-net.html", label: "CSIR NET", key: "csir" },
    { href: "/watch.html", label: "Watch", key: "watch" },
    { href: "/blog.html", label: "Blog", key: "blog" },
    { href: "/about.html", label: "About", key: "about" }
  ];

  function esc(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderNavLinks(className) {
    return NAV_LINKS.map(function (item) {
      var active = item.key === PAGE ? " site-nav__link--active" : "";
      return (
        '<li class="site-nav__item">' +
        '<a class="site-nav__link' +
        active +
        '" href="' +
        esc(item.href) +
        '">' +
        esc(item.label) +
        "</a></li>"
      );
    }).join("");
  }

  function renderHeader() {
    return (
      '<header class="site-header">' +
      '<div class="site-nav" id="siteNav">' +
      '<div class="site-nav__row">' +
      '<a href="/" class="site-nav__brand" aria-label="' +
      LOGO_ALT +
      ' home">' +
      brandLogoImg("site-nav__logo-img") +
      "</a>" +
      '<form class="site-nav__search" id="siteNavSearchForm" role="search">' +
      '<input type="search" id="siteNavSearchInput" placeholder="Search courses, mock tests…" aria-label="Search" />' +
      '<button type="submit">Search</button></form>' +
      '<div class="site-nav__actions-top">' +
      '<a href="/pricing.html" class="site-nav__sub">Get Subscription</a>' +
      '<a href="/signin.html" class="site-nav__signin">Sign In</a>' +
      '<button type="button" class="site-nav__toggle" id="siteNavToggle" ' +
      'aria-label="Open menu" aria-expanded="false" aria-controls="siteNavPanel">' +
      "<span></span><span></span><span></span></button></div></div>" +
      '<ul class="site-nav__list site-nav__list--desktop">' +
      renderNavLinks() +
      "</ul>" +
      '<div class="site-nav__panel" id="siteNavPanel">' +
      '<form class="site-nav__search site-nav__search--mobile" id="siteNavSearchFormMobile" role="search">' +
      '<input type="search" placeholder="Search courses, mock tests…" aria-label="Search" />' +
      '<button type="submit">Search</button></form>' +
      '<ul class="site-nav__list">' +
      '<li class="site-nav__item"><a class="site-nav__link' +
      (PAGE === "home" ? " site-nav__link--active" : "") +
      '" href="/">Home</a></li>' +
      renderNavLinks() +
      "</ul>" +
      '<a href="/pricing.html" class="site-nav__cta">Get Subscription</a></div></div></header>'
    );
  }

  function renderFooter() {
    return (
      '<div class="footer-grid container">' +
      '<div class="footer-brand-block">' +
      '<a href="/" class="logo footer-logo" aria-label="' +
      LOGO_ALT +
      ' home">' +
      brandLogoImg("footer-logo-img") +
      "</a>" +
      '<p class="footer-desc">Structured learning for exams, research careers, and publication-ready skills — courses, live classes, and mocks in one place.</p>' +
      '<div class="et-footer-social">' +
      '<a href="https://www.youtube.com/@MathswithDivyanshuSir" target="_blank" rel="noopener noreferrer" aria-label="YouTube">YT</a>' +
      '<a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">in</a>' +
      "</div></div>" +
      '<nav class="footer-links" aria-label="Platform">' +
      "<h4>Platform</h4>" +
      '<a href="/courses.html">Courses</a>' +
      '<a href="/mcq-test.html">Mock Tests</a>' +
      '<a href="/study-materials.html">Study Materials</a>' +
      '<a href="/pricing.html">Subscription</a>' +
      "</nav>" +
      '<nav class="footer-links" aria-label="Programs">' +
      "<h4>Programs</h4>" +
      '<a href="/live-classes.html">Live Classes</a>' +
      '<a href="/csir-net.html">CSIR UGC NET</a>' +
      '<a href="/gate-exam.html">GATE Exam</a>' +
      '<a href="/watch.html">Video Library</a>' +
      "</nav>" +
      '<nav class="footer-links" aria-label="Company">' +
      "<h4>Company</h4>" +
      '<a href="/about.html">About</a>' +
      '<a href="/blog.html">Blog</a>' +
      '<a href="/signin.html">Contact</a>' +
      "</nav></div>"
    );
  }

  function goSearch(q) {
    var term = String(q || "").trim();
    if (!term) {
      window.location.href = "/courses.html";
      return;
    }
    window.location.href = "/courses.html?q=" + encodeURIComponent(term);
  }

  function bindSearch(form) {
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var inp = form.querySelector('input[type="search"]');
      goSearch(inp ? inp.value : "");
    });
  }

  function setMenuOpen(nav, toggle, open) {
    if (!nav || !toggle) return;
    nav.classList.toggle("site-nav--open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("site-nav-lock", open);
  }

  function initHeader() {
    var mount = document.getElementById("site-header");
    if (!mount) return;

    mount.innerHTML = renderHeader();

    bindSearch(document.getElementById("siteNavSearchForm"));
    bindSearch(document.getElementById("siteNavSearchFormMobile"));

    var nav = document.getElementById("siteNav");
    var toggle = document.getElementById("siteNavToggle");
    if (!nav || !toggle) return;

    toggle.addEventListener("click", function () {
      setMenuOpen(nav, toggle, !nav.classList.contains("site-nav--open"));
    });

    nav.querySelectorAll(".site-nav__link").forEach(function (link) {
      link.addEventListener("click", function () {
        setMenuOpen(nav, toggle, false);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("site-nav--open")) {
        setMenuOpen(nav, toggle, false);
      }
    });

    window.matchMedia("(min-width: 1025px)").addEventListener("change", function (e) {
      if (e.matches) setMenuOpen(nav, toggle, false);
    });
  }

  function initFooter() {
    var mount = document.getElementById("site-footer-main");
    if (mount) mount.innerHTML = renderFooter();
  }

  initFavicon();
  initHeader();
  initFooter();
})();

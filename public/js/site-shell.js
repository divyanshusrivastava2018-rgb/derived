(function () {
  var page = document.body.getAttribute("data-page") || "";

  var navHtml =
    '<nav class="navbar et-nav" aria-label="Primary" id="siteNav">' +
    '<div class="nav-inner">' +
    '<a href="/" class="logo"><span class="logo-icon" aria-hidden="true">📘</span>Research<span class="logo-gold">ium</span></a>' +
    '<button type="button" class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false">' +
    '<span></span><span></span><span></span></button>' +
    '<ul class="nav-links">' +
    '<li><a href="/" data-nav="home">Home</a></li>' +
    '<li><a href="/courses.html" data-nav="courses">Courses</a></li>' +
    '<li><a href="/about.html" data-nav="about">About</a></li>' +
    '<li class="nav-has-dropdown">' +
    '<span class="nav-dropdown-trigger" tabindex="0" role="button" aria-haspopup="true">Pages <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></span>' +
    '<ul class="nav-dropdown-menu">' +
    '<li><a href="/live-classes.html" data-nav="live">Live Classes</a></li>' +
    '<li><a href="/study-materials.html" data-nav="study">Study Materials</a></li>' +
    '<li><a href="/mcq-test.html" data-nav="mcq">MCQ Practice</a></li>' +
    '<li><a href="/pricing.html" data-nav="pricing">Pricing</a></li>' +
    '<li><a href="/csir-net.html" data-nav="csir">CSIR UGC NET</a></li>' +
    '<li><a href="/watch.html" data-nav="watch">Watch</a></li>' +
    "</ul></li>" +
    '<li><a href="/blog.html" data-nav="blog">Blog</a></li>' +
    '<li><a href="/signin.html" data-nav="signin">Contact</a></li>' +
    "</ul>" +
    '<div class="nav-actions">' +
    '<a href="/signin.html" class="nav-signin">Sign In</a>' +
    '<a href="/pricing.html" class="btn-gold">Get Started</a>' +
    "</div></div></nav>";

  var footerMainHtml =
    '<div class="footer-grid container">' +
    '<div class="footer-brand-block">' +
    '<a href="/" class="logo footer-logo"><span class="logo-icon" aria-hidden="true">📘</span>Research<span class="logo-gold">ium</span></a>' +
    '<p class="footer-desc">From JEE to FAANG — structured learning, live sessions, and research-backed paths in one platform.</p>' +
    '<div class="et-footer-social">' +
    '<a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">YT</a>' +
    '<a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">in</a>' +
    '<a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">X</a>' +
    "</div></div>" +
    '<nav class="footer-links" aria-label="Company">' +
    "<h4>Company</h4>" +
    '<a href="/about.html">About us</a>' +
    '<a href="/pricing.html">Pricing</a>' +
    '<a href="/signin.html">Contact</a>' +
    '<a href="/blog.html">Blog</a>' +
    "</nav>" +
    '<nav class="footer-links" aria-label="Resources">' +
    "<h4>Resources</h4>" +
    '<a href="/study-materials.html">Study Materials</a>' +
    '<a href="/mcq-test.html">MCQ Practice</a>' +
    '<a href="/live-classes.html">Live Classes</a>' +
    '<a href="/csir-net.html">CSIR NET</a>' +
    "</nav>" +
    '<nav class="footer-links" aria-label="Programs">' +
    "<h4>Programs</h4>" +
    '<a href="/courses.html">All courses</a>' +
    '<a href="/courses.html">JEE / NEET</a>' +
    '<a href="/courses.html">UPSC</a>' +
    '<a href="/courses.html">Coding &amp; AI</a>' +
    "</nav></div>";

  var headerMount = document.getElementById("site-header");
  if (headerMount) headerMount.innerHTML = navHtml;

  var footerMount = document.getElementById("site-footer-main");
  if (footerMount) footerMount.innerHTML = footerMainHtml;

  var subPages = ["live", "study", "mcq", "pricing", "csir", "watch"];
  var isSubPage = subPages.indexOf(page) !== -1;

  document.querySelectorAll(".nav-links a[data-nav]").forEach(function (a) {
    a.classList.toggle("nav-active", a.getAttribute("data-nav") === page);
  });

  var nav = document.getElementById("siteNav");
  var toggle = document.getElementById("navToggle");
  var mobileNavMq = window.matchMedia("(max-width: 1024px)");

  function isMobileNav() {
    return mobileNavMq.matches;
  }

  function setDropdownOpen(dropdown, open) {
    if (!dropdown) return;
    dropdown.classList.toggle("is-open", open);
    var trigger = dropdown.querySelector(".nav-dropdown-trigger");
    if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
  }

  document.querySelectorAll(".nav-has-dropdown").forEach(function (dropdown) {
    var trigger = dropdown.querySelector(".nav-dropdown-trigger");
    var menu = dropdown.querySelector(".nav-dropdown-menu");
    if (!trigger) return;
    if (menu && !menu.id) menu.id = "navPagesMenu";

    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", menu ? menu.id : "navPagesMenu");

    if (isSubPage) {
      dropdown.classList.add("nav-sub-active");
      if (isMobileNav()) setDropdownOpen(dropdown, true);
    }

    function onTriggerActivate(e) {
      if (!isMobileNav()) return;
      e.preventDefault();
      e.stopPropagation();
      var willOpen = !dropdown.classList.contains("is-open");
      document.querySelectorAll(".nav-has-dropdown.is-open").forEach(function (other) {
        if (other !== dropdown) setDropdownOpen(other, false);
      });
      setDropdownOpen(dropdown, willOpen);
    }

    trigger.addEventListener("click", onTriggerActivate);
    trigger.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        onTriggerActivate(e);
      }
    });
  });

  mobileNavMq.addEventListener("change", function () {
    if (!isMobileNav()) {
      document.querySelectorAll(".nav-has-dropdown.is-open").forEach(function (d) {
        setDropdownOpen(d, false);
      });
    } else if (isSubPage) {
      var dd = document.querySelector(".nav-has-dropdown");
      if (dd) setDropdownOpen(dd, true);
    }
  });

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open) {
        document.querySelectorAll(".nav-has-dropdown.is-open").forEach(function (d) {
          setDropdownOpen(d, false);
        });
      }
    });

    nav.addEventListener("click", function (e) {
      if (!isMobileNav()) return;
      if (!e.target.closest(".nav-has-dropdown")) {
        document.querySelectorAll(".nav-has-dropdown.is-open").forEach(function (d) {
          setDropdownOpen(d, false);
        });
      }
    });
  }
})();

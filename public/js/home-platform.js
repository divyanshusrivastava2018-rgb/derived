/**
 * Researchium homepage — Yes Officer–style sections (Researchium content only).
 */
(function () {
  "use strict";

  var HERO_SLIDES = [
    {
      badge: "Trusted learning",
      title: "Built for serious exam & research aspirants",
      lead: "Courses, live classes, GATE & CSIR mocks, and study PDFs — one platform for your prep journey.",
      stat: "2,500+",
      statLabel: "active learners",
      cta: { href: "/pricing.html", label: "Get Subscription" },
      secondary: { href: "/courses.html", label: "Browse courses" },
      img: "/images/hero-students.png",
      alt: "Students learning online"
    },
    {
      badge: "Live & recorded",
      title: "Learn live. Revise anytime.",
      lead: "Join scheduled doubt labs and replay sessions on your schedule.",
      stat: "Weekly",
      statLabel: "live slots",
      cta: { href: "/live-classes.html", label: "View live schedule" },
      secondary: { href: "/watch.html", label: "Watch library" },
      img: "/images/hero-students.png",
      alt: "Live class learning"
    },
    {
      badge: "Mock tests",
      title: "Practice like the real exam",
      lead: "GATE Mathematics mocks, topic quizzes, and category-wise practice tests with instant scoring.",
      stat: "50+",
      statLabel: "mock papers",
      cta: { href: "/mcq-test.html", label: "Start mock test" },
      secondary: { href: "/gate-exam.html", label: "GATE exam mode" },
      img: "/images/hero-students.png",
      alt: "Exam practice"
    }
  ];

  var LIVE_FALLBACK = [
    { title: "JEE / NEET doubt lab", meta: "Problem solving · Live", href: "/live-classes.html", icon: "📐" },
    { title: "CSIR NET — Life Sciences", meta: "Syllabus coverage", href: "/csir-net.html", icon: "🔬" },
    { title: "GATE Mathematics", meta: "Full-length strategy", href: "/gate-exam.html", icon: "📊" },
    { title: "Research writing clinic", meta: "Methods & publishing", href: "/blog.html", icon: "✍️" }
  ];

  var STORIES = [
    {
      name: "Priya M.",
      handle: "@priya_m",
      quote:
        "The mock tests and PDF library are well organized. I can track weak topics and revisit live recordings before exams."
    },
    {
      name: "Rahul K.",
      handle: "@rahul_k",
      quote:
        "Researchium pulled my GATE prep, course videos, and notes into one place. The interface is clean and easy to navigate."
    },
    {
      name: "Ananya S.",
      handle: "@ananya_s",
      quote:
        "CSIR NET section with live schedule and materials saved me hours of hunting across random channels."
    },
    {
      name: "Vikram T.",
      handle: "@vikram_t",
      quote:
        "Subscription pricing is transparent. I upgraded for live classes and the playlist sync on the watch page is excellent."
    },
    {
      name: "Meera J.",
      handle: "@meera_j",
      quote:
        "Study materials by category make revision structured. MCQ practice feels close to real exam timing."
    }
  ];

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function initHeroCarousel() {
    var root = document.getElementById("yoHeroSlides");
    var dotsRoot = document.getElementById("yoHeroDots");
    if (!root) return;

    root.innerHTML = HERO_SLIDES.map(function (s, i) {
      return (
        '<div class="yo-hero__slide' +
        (i === 0 ? " is-active" : "") +
        '" data-slide="' +
        i +
        '">' +
        '<div class="yo-hero__inner">' +
        '<div class="yo-hero__content">' +
        '<span class="yo-hero__badge">' +
        esc(s.badge) +
        "</span>" +
        "<h1>" +
        esc(s.title) +
        "</h1>" +
        '<p class="yo-hero__lead">' +
        esc(s.lead) +
        "</p>" +
        '<p class="yo-hero__stat"><strong>' +
        esc(s.stat) +
        "</strong> " +
        esc(s.statLabel) +
        "</p>" +
        '<div class="yo-hero__actions">' +
        '<a href="' +
        esc(s.cta.href) +
        '" class="yo-btn-primary">' +
        esc(s.cta.label) +
        "</a>" +
        '<a href="' +
        esc(s.secondary.href) +
        '" class="yo-btn-outline">' +
        esc(s.secondary.label) +
        "</a></div></div>" +
        '<div class="yo-hero__visual"><img src="' +
        esc(s.img) +
        '" alt="' +
        esc(s.alt) +
        '" width="420" height="400" loading="' +
        (i === 0 ? "eager" : "lazy") +
        '" /></div></div></div>'
      );
    }).join("");

    if (dotsRoot) {
      dotsRoot.innerHTML = HERO_SLIDES.map(function (_, i) {
        return (
          '<button type="button" class="yo-hero__dot' +
          (i === 0 ? " is-active" : "") +
          '" data-dot="' +
          i +
          '" aria-label="Slide ' +
          (i + 1) +
          '"></button>'
        );
      }).join("");
    }

    var slides = root.querySelectorAll(".yo-hero__slide");
    var dots = dotsRoot ? dotsRoot.querySelectorAll(".yo-hero__dot") : [];
    var idx = 0;
    var timer;

    function show(n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (el, i) {
        el.classList.toggle("is-active", i === idx);
      });
      dots.forEach(function (el, i) {
        el.classList.toggle("is-active", i === idx);
      });
    }

    dots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        show(Number(dot.getAttribute("data-dot")));
        resetTimer();
      });
    });

    function resetTimer() {
      clearInterval(timer);
      timer = setInterval(function () {
        show(idx + 1);
      }, 6000);
    }

    resetTimer();
  }

  function renderLiveCards(items) {
    var row = document.getElementById("yoLiveRow");
    if (!row) return;
    row.innerHTML = items
      .map(function (item) {
        return (
          '<a class="yo-live-card" href="' +
          esc(item.href) +
          '">' +
          '<div class="yo-live-card__thumb" aria-hidden="true">' +
          esc(item.icon || "▶") +
          "</div>" +
          '<div class="yo-live-card__body">' +
          '<div class="yo-live-card__tag">Live classes</div>' +
          "<h3>" +
          esc(item.title) +
          "</h3>" +
          "<p>" +
          esc(item.meta) +
          "</p></div></a>"
        );
      })
      .join("");
  }

  function loadLiveClasses() {
    var load =
      window.ResearchiumSiteData && window.ResearchiumSiteData.fetchSite
        ? window.ResearchiumSiteData.fetchSite()
        : fetch("/api/site")
            .then(function (r) {
              return r.ok ? r.json() : {};
            })
            .catch(function () {
              return {};
            });

    load.then(function (site) {
      var schedule = site && Array.isArray(site.liveSchedule) ? site.liveSchedule : [];
      var items = schedule.slice(0, 8).map(function (row) {
        return {
          title: row.title || "Live session",
          meta: (row.time || "Scheduled") + (row.meta ? " · " + row.meta : ""),
          href: row.linkHref || "/live-classes.html",
          icon: "▶"
        };
      });
      if (!items.length) items = LIVE_FALLBACK;
      renderLiveCards(items);
    });
  }

  function initStories() {
    var track = document.getElementById("yoStoriesTrack");
    if (!track) return;
    track.innerHTML = STORIES.map(function (s) {
      var initial = (s.name.charAt(0) || "R").toUpperCase();
      return (
        '<article class="yo-story-card">' +
        '<div class="yo-story-card__head">' +
        '<div class="yo-story-card__avatar">' +
        esc(initial) +
        "</div><div>" +
        '<div class="yo-story-card__name">' +
        esc(s.name) +
        "</div>" +
        '<div class="yo-story-card__handle">' +
        esc(s.handle) +
        "</div></div></div>" +
        "<blockquote>" +
        esc(s.quote) +
        "</blockquote></article>"
      );
    }).join("");
  }

  function ytThumb(id) {
    return "https://i.ytimg.com/vi/" + encodeURIComponent(id) + "/hqdefault.jpg";
  }

  function renderCourses(grid, items) {
    if (!items.length) {
      grid.innerHTML = '<p class="loading-banner">No courses yet. Check back soon.</p>';
      return;
    }
    grid.innerHTML = items
      .map(function (c) {
        var isFree = !c.price || Number(c.price) === 0;
        var thumb = "";
        if (c.thumbUrl) {
          thumb = '<img src="' + esc(c.thumbUrl) + '" alt="" loading="lazy" />';
        } else if (c.type === "youtube" && c.ytId) {
          thumb =
            '<img src="' +
            esc(ytThumb(c.ytId)) +
            '" alt="" loading="lazy" onerror="this.style.display=\'none\'" />';
        } else {
          thumb = '<div class="et-course-thumb-placeholder">📚</div>';
        }
        var priceHtml = isFree
          ? '<span class="et-course-price">Free</span>'
          : '<span class="et-course-price">₹' + esc(String(Number(c.price).toLocaleString())) + "</span>";
        var href = "/watch.html?id=" + encodeURIComponent(c.id);
        var rating = Number(c.rating) || 4.5;
        var students = Number(c.students) || 0;
        return (
          '<a class="et-course-card" href="' +
          href +
          '"><div class="et-course-thumb">' +
          thumb +
          '<span class="et-course-tag">' +
          esc(c.category || "Course") +
          "</span></div><div class="et-course-body"><div class="et-course-author"><img src=\"https://api.dicebear.com/7.x/initials/svg?seed=" +
          encodeURIComponent(c.instructor || "R") +
          '" alt="" width="28" height="28" /><span>' +
          esc(c.instructor || "Researchium") +
          "</span></div><h3>" +
          esc(c.title) +
          '</h3><p class="et-course-rating"><span class="stars">★★★★★</span> ' +
          rating.toFixed(1) +
          " (" +
          students.toLocaleString() +
          ")</p></div><div class="et-course-footer"><span>Course</span>" +
          priceHtml +
          "</div></a>"
        );
      })
      .join("");
  }

  function loadCourses() {
    var grid = document.getElementById("yoCoursesGrid");
    if (!grid) return;

    var req =
      window.ResearchiumApi && window.ResearchiumApi.get
        ? window.ResearchiumApi.get("/api/courses")
        : fetch("/api/courses").then(function (r) {
            return r.json();
          });

    req
      .then(function (courses) {
        renderCourses(grid, Array.isArray(courses) ? courses.slice(0, 6) : []);
      })
      .catch(function () {
        grid.innerHTML = '<p class="loading-banner">Could not load courses. Start the server or try again.</p>';
      });
  }

  function loadBenefits() {
    var grid = document.getElementById("yoBenefitsGrid");
    if (!grid) return;

    var req =
      window.ResearchiumApi && window.ResearchiumApi.get
        ? window.ResearchiumApi.get("/api/platform/overview")
        : fetch("/api/platform/overview").then(function (r) {
            return r.ok ? r.json() : null;
          });

    req
      .then(function (data) {
        if (!data || !Array.isArray(data.features)) return;
        var headline = document.getElementById("yoBenefitsHeadline");
        var sub = document.getElementById("yoBenefitsSubhead");
        if (headline && data.headline) headline.textContent = data.headline;
        if (sub && data.subhead) sub.textContent = data.subhead;

        grid.innerHTML = data.features
          .map(function (f) {
            return (
              '<a class="yo-benefit-pill" href="' +
              esc(f.href || "/why-feature.html?slug=" + encodeURIComponent(f.slug)) +
              '"><span>' +
              esc(f.icon) +
              "</span><span>" +
              esc(f.title) +
              '</span><span class="yo-benefit-pill__stat">' +
              esc(f.stat || "") +
              "</span></a>"
            );
          })
          .join("");

        if (data.learnAnywhere) {
          var la = data.learnAnywhere;
          var t = document.getElementById("yoLearnAnywhereTitle");
          var s = document.getElementById("yoLearnAnywhereSummary");
          if (t && la.title) t.textContent = la.title;
          if (s && la.summary) s.textContent = la.summary;
        }
      })
      .catch(function () {
        grid.innerHTML =
          '<a class="yo-benefit-pill" href="/live-classes.html"><span>▶</span><span>Live + Recorded</span></a>' +
          '<a class="yo-benefit-pill" href="/study-materials.html"><span>📄</span><span>Downloadable PDFs</span></a>' +
          '<a class="yo-benefit-pill" href="/mcq-test.html"><span>🎯</span><span>Daily practice</span></a>' +
          '<a class="yo-benefit-pill" href="/gate-exam.html"><span>📊</span><span>Full mocks</span></a>' +
          '<a class="yo-benefit-pill" href="/csir-net.html#ai-doubt"><span>💬</span><span>Doubt support</span></a>' +
          '<a class="yo-benefit-pill" href="/mcq-test.html#mock-test-series"><span>📈</span><span>Progress tracking</span></a>';
      });
  }

  function loadCsirStats() {
    var req =
      window.ResearchiumApi && window.ResearchiumApi.get
        ? window.ResearchiumApi.get("/api/goal/stats")
        : fetch("/api/goal/stats").then(function (r) {
            return r.ok ? r.json() : null;
          });
    req
      .then(function (s) {
        if (!s) return;
        var learners = document.getElementById("etCsirStatLearners");
        var educators = document.getElementById("etCsirStatEducators");
        if (learners && s.learners) learners.textContent = String(s.learners);
        if (educators && s.educators != null) educators.textContent = String(s.educators) + "+";
      })
      .catch(function () {});
  }

  initHeroCarousel();
  initStories();
  loadLiveClasses();
  loadCourses();
  loadBenefits();
  loadCsirStats();
})();

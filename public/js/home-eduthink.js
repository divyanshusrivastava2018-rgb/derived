(function () {
  var testimonials = [
    {
      quote:
        "Researchium helped me structure JEE prep with live doubts and a clear course path. The catalog and MCQ practice are exactly what I needed.",
      name: "Priya Sharma",
      role: "JEE Aspirant",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya"
    },
    {
      quote:
        "The research blog and course library made the jump from coursework to publishing far less intimidating. Highly recommend for serious students.",
      name: "Arjun Mehta",
      role: "M.Sc. Research",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun"
    },
    {
      quote:
        "Live classes plus on-demand replays — I never miss a session. Transparent pricing and free starter access were a huge plus.",
      name: "Sneha Reddy",
      role: "UPSC Learner",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sneha"
    }
  ];

  var testimonialIndex = 0;

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function ytThumb(ytId) {
    return "https://img.youtube.com/vi/" + encodeURIComponent(ytId) + "/hqdefault.jpg";
  }

  function bindHeroSearch() {
    var form = document.getElementById("etHeroSearchForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = document.getElementById("etHeroSearchInput");
      var val = q && q.value ? q.value.trim() : "";
      window.location.href = val
        ? "/courses.html?q=" + encodeURIComponent(val)
        : "/courses.html";
    });
  }

  function renderCourses(list) {
    var grid = document.getElementById("etCoursesGrid");
    if (!grid) return;
    var items = (list || []).slice(0, 6);
    if (!items.length) {
      grid.innerHTML =
        '<p class="loading-banner">No courses yet. Add courses in Admin or run <code>npm start</code>.</p>';
      return;
    }
    grid.innerHTML = items
      .map(function (c) {
        var isFree = !c.price || Number(c.price) === 0;
        var thumb = "";
        if (c.thumbUrl) {
          thumb = '<img src="' + escapeHtml(c.thumbUrl) + '" alt="" loading="lazy" />';
        } else if (c.type === "youtube" && c.ytId) {
          thumb =
            '<img src="' + escapeHtml(ytThumb(c.ytId)) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'" />';
        } else {
          thumb = '<div class="et-course-thumb-placeholder">📚</div>';
        }
        var priceHtml = isFree
          ? '<span class="et-course-price">Free</span>'
          : '<span class="et-course-price">₹' + escapeHtml(String(Number(c.price).toLocaleString())) + "</span>";
        var duration = escapeHtml(c.duration || "Self-paced");
        var lessons =
          c.type === "youtube"
            ? "Video course"
            : c.type === "upload"
              ? "Uploaded"
              : "External";
        var rating = Number(c.rating) || 4.5;
        var students = Number(c.students) || 0;
        var href = "/watch.html?id=" + encodeURIComponent(c.id);
        return (
          '<a class="et-course-card" href="' +
          href +
          '">' +
          '<div class="et-course-thumb">' +
          thumb +
          '<span class="et-course-tag">' +
          escapeHtml(c.category || "Course") +
          "</span></div>" +
          '<div class="et-course-body">' +
          '<div class="et-course-author">' +
          '<img src="https://api.dicebear.com/7.x/initials/svg?seed=' +
          encodeURIComponent(c.instructor || "R") +
          '" alt="" width="28" height="28" />' +
          "<span>" +
          escapeHtml(c.instructor || "Researchium") +
          "</span></div>" +
          "<h3>" +
          escapeHtml(c.title) +
          "</h3>" +
          '<p class="et-course-rating"><span class="stars">★★★★★</span> ' +
          rating.toFixed(1) +
          " (" +
          students.toLocaleString() +
          ")</p></div>" +
          '<div class="et-course-footer"><span>' +
          lessons +
          " · " +
          duration +
          "</span>" +
          priceHtml +
          "</div></a>"
        );
      })
      .join("");
  }

  function loadCourses() {
    var grid = document.getElementById("etCoursesGrid");
    if (!grid) return;
    var load =
      window.ResearchiumApi && window.ResearchiumApi.get
        ? window.ResearchiumApi.get("/api/courses")
        : fetch("/api/courses").then(function (r) {
            if (!r.ok) throw new Error();
            return r.json();
          });
    load.then(renderCourses)
      .catch(function () {
        grid.innerHTML =
          '<p class="loading-banner">Could not load courses. Start the server with <code>npm start</code>.</p>';
      });
  }

  function renderTestimonial(i) {
    var t = testimonials[i];
    if (!t) return;
    var card = document.getElementById("etTestimonialCard");
    if (!card) return;
    card.innerHTML =
      '<div class="et-quote-mark">"</div>' +
      '<p class="et-testimonial-text">' +
      escapeHtml(t.quote) +
      "</p>" +
      '<div class="et-testimonial-user">' +
      '<img src="' +
      escapeHtml(t.avatar) +
      '" alt="" width="56" height="56" />' +
      "<strong>" +
      escapeHtml(t.name) +
      "</strong>" +
      "<span>" +
      escapeHtml(t.role) +
      "</span></div>";
    document.querySelectorAll(".et-testimonial-dots button").forEach(function (btn, idx) {
      btn.classList.toggle("is-active", idx === i);
    });
  }

  function bindTestimonials() {
    renderTestimonial(0);
    document.getElementById("etTestPrev")?.addEventListener("click", function () {
      testimonialIndex = (testimonialIndex - 1 + testimonials.length) % testimonials.length;
      renderTestimonial(testimonialIndex);
    });
    document.getElementById("etTestNext")?.addEventListener("click", function () {
      testimonialIndex = (testimonialIndex + 1) % testimonials.length;
      renderTestimonial(testimonialIndex);
    });
    var dots = document.getElementById("etTestimonialDots");
    if (dots) {
      dots.innerHTML = testimonials
        .map(function (_, i) {
          return (
            '<button type="button" aria-label="Slide ' +
            (i + 1) +
            '"' +
            (i === 0 ? ' class="is-active"' : "") +
            " data-i=\"" +
            i +
            '"></button>'
          );
        })
        .join("");
      dots.querySelectorAll("button").forEach(function (btn) {
        btn.addEventListener("click", function () {
          testimonialIndex = Number(btn.getAttribute("data-i")) || 0;
          renderTestimonial(testimonialIndex);
        });
      });
    }
  }

  function bindCmsHero() {
    var loadSite =
      window.ResearchiumSiteData && window.ResearchiumSiteData.fetchSite
        ? window.ResearchiumSiteData.fetchSite()
        : fetch("/api/site").then(function (r) {
            return r.json();
          });
    loadSite
      .then(function (site) {
        var p = site.pageCopy && site.pageCopy.home;
        if (!p) return;
        if (p.secTag && document.getElementById("etHeroBadge")) {
          document.getElementById("etHeroBadge").textContent = String(p.secTag).replace(/<[^>]+>/g, "").trim() || "100% Online Learning";
        }
        if (p.titleHtml && document.getElementById("etHeroTitle")) {
          var safe =
            window.ResearchiumSanitize && window.ResearchiumSanitize.html
              ? window.ResearchiumSanitize.html(p.titleHtml)
              : String(p.titleHtml).replace(/<[^>]+>/g, "");
          document.getElementById("etHeroTitle").innerHTML = safe;
        }
        if (p.leadHtml && document.getElementById("etHeroLead")) {
          document.getElementById("etHeroLead").textContent = String(p.leadHtml).replace(/<[^>]+>/g, " ").trim();
        }
      })
      .catch(function () {});
  }

  function loadCsirHomeStats() {
    var statLoad =
      window.ResearchiumApi && window.ResearchiumApi.get
        ? window.ResearchiumApi.get("/api/goal/stats")
        : fetch("/api/goal/stats").then(function (r) {
            if (!r.ok) throw new Error();
            return r.json();
          });
    statLoad
      .then(function (s) {
        if (!s) return;
        var learners = document.getElementById("etCsirStatLearners");
        var educators = document.getElementById("etCsirStatEducators");
        var meta = document.getElementById("etCsirLearnerStat");
        if (learners && s.learners) learners.textContent = String(s.learners);
        if (educators && s.educators != null) {
          educators.textContent = String(s.educators) + "+";
        }
        if (meta && s.learners) meta.textContent = String(s.learners) + " NET learners";
      })
      .catch(function () {});
  }

  function loadHomeSummary() {
    var summaryLoad =
      window.ResearchiumApi && window.ResearchiumApi.get
        ? window.ResearchiumApi.get("/api/home/summary")
        : fetch("/api/home/summary").then(function (r) {
            if (!r.ok) throw new Error();
            return r.json();
          });
    summaryLoad.then(function (s) {
        var proof = document.querySelector(".et-social-proof strong");
        if (proof && s.learnerCount) {
          proof.textContent = Number(s.learnerCount).toLocaleString() + "+";
        }
        var featNum = document.getElementById("etFeatCourseCount");
        if (featNum && s.courseCount != null) {
          featNum.textContent = String(s.courseCount);
        }
      })
      .catch(function () {});
  }

  bindHeroSearch();
  loadCourses();
  bindTestimonials();
  bindCmsHero();
  loadHomeSummary();
  loadCsirHomeStats();
})();

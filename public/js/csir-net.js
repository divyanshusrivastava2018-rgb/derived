(function () {
  var API = (typeof window !== "undefined" && window.DERIVED_API_BASE) || "/api";
  var standalone = document.body && document.body.getAttribute("data-csir-standalone") === "true";

  function link(path) {
    if (!standalone) return path;
    if (path.indexOf("/") === 0 && path.indexOf(".html") !== -1) {
      var hash = {
        "/signin.html": "#register",
        "/pricing.html": "#plans",
        "/courses.html": "#subjects",
        "/live-classes.html": "#educators",
        "/mcq-test.html": "#features",
        "/about.html": "#faq",
        "/blog.html": "#faq"
      };
      return hash[path] || path;
    }
    return path;
  }

  function planCta(plan) {
    if (standalone) return plan.id === "free" ? "#register" : "#plans";
    if (plan.id === "free") return "/signin.html";
    return "/pricing.html?plan=" + encodeURIComponent(plan.id);
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function formatCount(n) {
    var num = Number(n);
    if (!Number.isFinite(num)) return String(n);
    if (num >= 1000) return Math.round(num / 1000) + "K";
    return String(num);
  }

  function initials(name) {
    return String(name || "")
      .split(/\s+/)
      .map(function (w) {
        return w[0];
      })
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  var avatarGradients = [
    "linear-gradient(135deg, #4fffb0, #00c2ff)",
    "linear-gradient(135deg,#00c2ff,#6a00ff)",
    "linear-gradient(135deg,#ff6b6b,#ffd166)",
    "linear-gradient(135deg,#a8ff78,#78ffd6)"
  ];

  function bindFaq() {
    document.querySelectorAll(".faq-q").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".faq-item");
        var isOpen = item.classList.contains("open");
        document.querySelectorAll(".faq-item.open").forEach(function (i) {
          i.classList.remove("open");
        });
        if (!isOpen) item.classList.add("open");
      });
    });
  }

  function observeReveal() {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach(function (el) {
      observer.observe(el);
    });
  }

  function loadStats() {
    return fetch(API + "/goal/stats")
      .then(function (r) {
        if (!r.ok) throw new Error("stats");
        return r.json();
      })
      .then(function (s) {
        var row = document.getElementById("heroStats");
        if (!row || !s) return;
        row.innerHTML =
          '<div class="hero-stat"><strong>' +
          esc(s.learners) +
          '</strong><span>Learners trust us</span></div>' +
          '<div class="hero-stat"><strong>' +
          esc(s.educators) +
          '+</strong><span>Expert educators</span></div>' +
          '<div class="hero-stat"><strong>' +
          esc(s.successRate) +
          '</strong><span>Success rate</span></div>';
      })
      .catch(function () {});
  }

  function loadSubjects() {
    return fetch(API + "/subjects")
      .then(function (r) {
        if (!r.ok) throw new Error("subjects");
        return r.json();
      })
      .then(function (list) {
        var grid = document.getElementById("subjectsGrid");
        if (!grid || !Array.isArray(list)) return;
        grid.innerHTML = list
          .map(function (s) {
            return (
              '<a class="subject-card reveal" href="' +
              esc(link("/courses.html")) +
              '">' +
              '<div class="s-icon">' +
              esc(s.icon) +
              "</div>" +
              "<h4>" +
              esc(s.name) +
              "</h4>" +
              "<span>" +
              esc(s.lessonCount) +
              "+ lessons</span>" +
              "</a>"
            );
          })
          .join("");
        observeReveal();
      })
      .catch(function () {});
  }

  function loadEducators() {
    return fetch(API + "/educators")
      .then(function (r) {
        if (!r.ok) throw new Error("educators");
        return r.json();
      })
      .then(function (list) {
        var row = document.getElementById("educatorsRow");
        if (!row || !Array.isArray(list)) return;
        row.innerHTML = list
          .map(function (e, i) {
            var ini = e.initials || initials(e.name);
            var grad = avatarGradients[i % avatarGradients.length];
            return (
              '<a class="educator-card reveal" href="' +
              esc(link("/live-classes.html")) +
              '">' +
              '<div class="edu-head">' +
              '<div class="edu-avatar" style="background:' +
              grad +
              '">' +
              esc(ini) +
              "</div>" +
              "<div>" +
              '<div class="edu-name">' +
              esc(e.name) +
              "</div>" +
              '<div class="edu-sub">' +
              esc(e.subject) +
              "</div>" +
              '<div class="edu-tag">' +
              esc(e.institution) +
              " · " +
              esc(e.experience) +
              " yrs exp</div>" +
              "</div></div>" +
              '<div class="edu-stats">' +
              '<div class="edu-stat"><strong>' +
              formatCount(e.learners) +
              '</strong><span>Learners</span></div>' +
              '<div class="edu-stat"><strong>' +
              esc(e.rating) +
              ' ★</strong><span>Rating</span></div>' +
              '<div class="edu-stat"><strong>' +
              esc(e.lessonCount) +
              '+</strong><span>Lessons</span></div>' +
              "</div></a>"
            );
          })
          .join("");
        observeReveal();
      })
      .catch(function () {});
  }

  function loadPlans() {
    return fetch(API + "/plans")
      .then(function (r) {
        if (!r.ok) throw new Error("plans");
        return r.json();
      })
      .then(function (list) {
        var grid = document.getElementById("plansGrid");
        if (!grid || !Array.isArray(list)) return;
        grid.innerHTML = list
          .map(function (p) {
            var featured = p.popular ? " featured" : "";
            var badge = p.popular ? '<div class="plan-badge">Most popular</div>' : "";
            var perks = (p.perks || [])
              .map(function (perk) {
                return "<li>" + esc(perk) + "</li>";
              })
              .join("");
            var periodLabel = p.period === "forever" ? " forever" : " /" + esc(p.period);
            return (
              '<div class="plan-card' +
              featured +
              ' reveal">' +
              badge +
              '<div class="plan-name">' +
              esc(p.name) +
              "</div>" +
              '<div class="plan-price"><strong>₹' +
              esc(p.price) +
              "</strong><span>" +
              periodLabel +
              "</span></div>" +
              '<ul class="plan-perks">' +
              perks +
              "</ul>" +
              '<a class="plan-btn" href="' +
              esc(planCta(p)) +
              '" data-plan-id="' +
              esc(p.id) +
              '">Choose ' +
              esc(p.name) +
              "</a></div>"
            );
          })
          .join("");
        observeReveal();
      })
      .catch(function () {});
  }

  function loadTestimonials() {
    return fetch(API + "/testimonials")
      .then(function (r) {
        if (!r.ok) throw new Error("testimonials");
        return r.json();
      })
      .then(function (list) {
        var grid = document.getElementById("testGrid");
        if (!grid || !Array.isArray(list)) return;
        grid.innerHTML = list
          .map(function (t) {
            var ini = initials(t.name);
            var stars = "★".repeat(Math.min(5, Number(t.rating) || 5));
            return (
              '<div class="test-card reveal">' +
              '<div class="test-stars">' +
              stars +
              "</div>" +
              '<p class="test-quote">"' +
              esc(t.quote) +
              '"</p>' +
              '<div class="test-author">' +
              '<div class="test-avatar">' +
              esc(ini) +
              "</div>" +
              "<div><div class=\"test-name\">" +
              esc(t.name) +
              "</div>" +
              '<div class="test-meta">' +
              esc(t.subject) +
              " · " +
              esc(t.rank) +
              " · " +
              esc(t.session) +
              "</div></div></div></div>"
            );
          })
          .join("");
        observeReveal();
      })
      .catch(function () {});
  }

  function loadFaqs() {
    return fetch(API + "/faqs")
      .then(function (r) {
        if (!r.ok) throw new Error("faqs");
        return r.json();
      })
      .then(function (list) {
        var wrap = document.getElementById("faqList");
        if (!wrap || !Array.isArray(list)) return;
        wrap.innerHTML = list
          .map(function (f) {
            return (
              '<div class="faq-item">' +
              '<button class="faq-q" type="button">' +
              esc(f.question) +
              ' <span class="arrow">▼</span></button>' +
              '<div class="faq-a">' +
              esc(f.answer) +
              "</div></div>"
            );
          })
          .join("");
        bindFaq();
      })
      .catch(function () {});
  }

  function bindLeadForm() {
    var form = document.getElementById("csirLeadForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = document.getElementById("csirLeadMsg");
      var payload = {
        name: document.getElementById("leadName").value.trim(),
        email: document.getElementById("leadEmail").value.trim(),
        phone: document.getElementById("leadPhone").value.trim(),
        subject: document.getElementById("leadSubject").value,
        plan: document.getElementById("leadPlan").value
      };
      fetch(API + "/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, body: j };
          });
        })
        .then(function (res) {
          if (msg) {
            msg.textContent = res.ok
              ? res.body.message || "Registered!"
              : res.body.error || "Could not register.";
            msg.style.color = res.ok ? "var(--accent)" : "var(--accent3)";
          }
          if (res.ok) form.reset();
        })
        .catch(function () {
          if (msg) {
            msg.textContent = standalone
              ? "Server unavailable. Run npm start in derived-csir-ugc-net."
              : "Server unavailable. Run npm start and open http://localhost:3000";
            msg.style.color = "var(--accent3)";
          }
        });
    });
  }

  function bindDoubtForm() {
    var form = document.getElementById("csirDoubtForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var out = document.getElementById("csirDoubtAnswer");
      var payload = {
        question: document.getElementById("doubtQuestion").value.trim(),
        subject: document.getElementById("doubtSubject").value
      };
      if (out) out.textContent = "Thinking…";
      fetch(API + "/doubts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) {
          if (!r.ok) throw new Error("doubts");
          return r.json();
        })
        .then(function (j) {
          if (out) out.textContent = j.answer || "No answer returned.";
        })
        .catch(function () {
          if (out) out.textContent = "Could not reach the doubt API.";
        });
    });
  }

  function bindPlanSubscribe() {
    document.querySelectorAll(".plan-btn[data-plan-id]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        if (standalone || btn.getAttribute("href").charAt(0) !== "#") return;
        var planId = btn.getAttribute("data-plan-id");
        if (!planId || planId === "free") return;
        e.preventDefault();
        var email = window.prompt("Enter your email to continue:");
        if (!email) return;
        fetch(API + "/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), planId: planId })
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (j) {
            if (j.checkoutUrl) window.location.href = j.checkoutUrl;
            else alert(j.message || "Order created.");
          })
          .catch(function () {
            alert("Could not start checkout.");
          });
      });
    });
  }

  bindLeadForm();
  bindDoubtForm();
  bindFaq();
  observeReveal();

  Promise.all([
    loadStats(),
    loadSubjects(),
    loadEducators(),
    loadPlans(),
    loadTestimonials(),
    loadFaqs()
  ]).then(bindPlanSubscribe);
})();

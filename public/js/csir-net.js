(function () {
  var API = (typeof window !== "undefined" && window.DERIVED_API_BASE) || "/api";
  var standalone = document.body && document.body.getAttribute("data-csir-standalone") === "true";

  function link(path) {
    if (!standalone) return path;
    if (path.indexOf("/") === 0 && path.indexOf(".html") !== -1) {
      var hash = {
        "/signin.html": "/signin.html",
        "#contact": "#contact",
        "/pricing.html": "#plans",
        "/courses.html": "#courses",
        "/live-classes.html": "/live-classes.html",
        "/mcq-test.html": "#features",
        "/about.html": "#faq",
        "/blog.html": "#faq",
        "/contact-thanks.html": "/contact-thanks.html"
      };
      return hash[path] || path;
    }
    return path;
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
        var learners = document.getElementById("heroStatLearners");
                var success = document.getElementById("heroStatSuccess");
                var rating = document.getElementById("heroStatRating");
                if (learners && s.learners) learners.textContent = String(s.learners);
                if (success && s.successRate) success.textContent = String(s.successRate);
                if (rating && s.rating) rating.textContent = String(s.rating);
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

  var hcaptchaWidgetIds = {};

  function hcaptchaTokenFor(key) {
    var id = hcaptchaWidgetIds[key];
    if (id == null || !window.hcaptcha) return "";
    return window.hcaptcha.getResponse(id) || "";
  }

  function initHcaptcha() {
    var mounts = document.querySelectorAll("[data-hcaptcha-mount]");
    if (!mounts.length) return;
    fetch(API + "/site/public")
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .then(function (cfg) {
        if (!cfg || !cfg.hcaptchaSiteKey) return;
        function renderAll() {
          if (!window.hcaptcha) return;
          mounts.forEach(function (mount) {
            var key = mount.getAttribute("data-hcaptcha-mount") || "default";
            mount.hidden = false;
            hcaptchaWidgetIds[key] = window.hcaptcha.render(mount, {
              sitekey: cfg.hcaptchaSiteKey
            });
          });
        }
        if (window.hcaptcha) {
          renderAll();
          return;
        }
        var script = document.createElement("script");
        script.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
        script.async = true;
        script.onload = renderAll;
        document.head.appendChild(script);
      })
      .catch(function () {});
  }

  function bindContactForm() {
    var form = document.getElementById("csirContactForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = document.getElementById("csirContactMsg");
      var submitBtn = document.getElementById("csirContactSubmit");
      var privacy = document.getElementById("contactPrivacy");
      if (privacy && !privacy.checked) {
        if (msg) {
          msg.textContent = "Please accept the Privacy Policy to continue.";
          msg.className = "csir-contact-msg csir-contact-msg--err";
        }
        return;
      }
      var payload = {
        name: document.getElementById("contactName").value.trim(),
        email: document.getElementById("contactEmail").value.trim(),
        phone: document.getElementById("contactPhone").value.trim(),
        subject: document.getElementById("contactSubject").value.trim(),
        message: document.getElementById("contactMessage").value.trim(),
        privacyAccepted: true
      };
      var contactToken = hcaptchaTokenFor("contact");
      if (contactToken) payload.hcaptchaToken = contactToken;
      if (msg) {
        msg.textContent = "Sending…";
        msg.className = "csir-contact-msg";
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }
      var willRedirect = false;
      fetch(API + "/contact", {
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
              ? res.body.message || "Message sent. Thank you!"
              : res.body.error || "Could not send message.";
            msg.className =
              "csir-contact-msg " +
              (res.ok ? "csir-contact-msg--ok" : "csir-contact-msg--err");
          }
          if (res.ok) {
            willRedirect = true;
            var redirect =
              (res.body && res.body.redirectUrl) || "/contact-thanks.html";
            redirect = link(redirect);
            if (submitBtn) submitBtn.textContent = "Message sent";
            if (msg) {
              msg.textContent = "Redirecting…";
              msg.className = "csir-contact-msg csir-contact-msg--ok";
            }
            setTimeout(function () {
              window.location.href = redirect + "?sent=1";
            }, 600);
            return;
          }
        })
        .catch(function () {
          if (msg) {
            msg.textContent = standalone
              ? "Server unavailable. Run npm start from the project root."
              : "Server unavailable. Run npm start and open http://localhost:3000";
            msg.className = "csir-contact-msg csir-contact-msg--err";
          }
        })
        .finally(function () {
          if (submitBtn && !willRedirect) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Send Message";
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
      var btn = document.getElementById("csirDoubtSubmit");
      var questionEl = document.getElementById("doubtQuestion");
      var payload = {
        question: questionEl && questionEl.value.trim(),
        subject: document.getElementById("doubtSubject").value
      };
      if (!payload.question || payload.question.length < 3) {
        if (out) {
          out.textContent = "Please type a question (at least 3 characters).";
          out.className = "doubt-answer doubt-answer--error";
        }
        return;
      }
      var doubtToken = hcaptchaTokenFor("doubt");
      if (hcaptchaWidgetIds.doubt != null && !doubtToken) {
        if (out) {
          out.textContent = "Please complete the captcha verification.";
          out.className = "doubt-answer doubt-answer--error";
        }
        return;
      }
      if (doubtToken) payload.hcaptchaToken = doubtToken;
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Finding answer…";
      }
      if (out) {
        out.textContent = "Preparing your explanation…";
        out.className = "doubt-answer doubt-answer--loading";
      }
      fetch(API + "/doubts", {
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
          if (out) {
            if (res.ok && res.body.answer) {
              out.textContent = res.body.answer;
              out.className = "doubt-answer doubt-answer--ready";
            } else {
              out.textContent = res.body.error || "Could not get an answer. Please try again.";
              out.className = "doubt-answer doubt-answer--error";
            }
          }
        })
        .catch(function () {
          if (out) {
            out.textContent =
              "Our study assistant is busy. Please try again in a moment.";
            out.className = "doubt-answer doubt-answer--error";
          }
        })
        .finally(function () {
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Get answer";
          }
        });
    });
  }

  initHcaptcha();
  bindContactForm();
  bindDoubtForm();
  bindFaq();
  observeReveal();

  Promise.all([loadStats(), loadSubjects(), loadFaqs()]);
})();

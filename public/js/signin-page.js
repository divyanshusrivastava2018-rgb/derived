(function () {
  var btn = document.getElementById("btnSigninContinue");
  var statusEl = document.getElementById("signinStatus");
  var emailEl = document.getElementById("email");

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("signin-status--error", !!isError);
  }

  fetch("/api/member/status")
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      if (j.paid) {
        setStatus("You already have Pro access on this device. Continue to your courses.");
      }
    })
    .catch(function () {
      /* server offline */
    });

  if (!btn) return;
  btn.addEventListener("click", function () {
    var email = emailEl ? String(emailEl.value || "").trim() : "";
    if (!email) {
      window.location.href = "/courses.html";
      return;
    }
    btn.disabled = true;
    var post =
      window.ResearchiumApi && window.ResearchiumApi.post
        ? window.ResearchiumApi.post("/api/member/interest", { email: email, source: "signin" }).then(
            function (j) {
              return { ok: true, status: 201, body: j };
            }
          )
        : fetch("/api/member/interest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email, source: "signin" })
          }).then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, status: r.status, body: j };
            });
          });
    post
      .then(function (res) {
        if (res.ok || res.status === 200) {
          window.location.href = "/courses.html";
          return;
        }
        setStatus((res.body && res.body.error) || "Could not save email.", true);
        btn.disabled = false;
      })
      .catch(function () {
        window.location.href = "/courses.html";
      });
  });
})();

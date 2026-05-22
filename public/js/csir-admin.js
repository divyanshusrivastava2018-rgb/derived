(function () {
  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function apiFetch(url, opts) {
    return fetch(url, Object.assign({ credentials: "same-origin" }, opts || {}));
  }

  function authHeaders() {
    return {};
  }

  function showLogin() {
    document.getElementById("csirAdminLogin").hidden = false;
    document.getElementById("csirAdminDash").hidden = true;
  }

  function showDash() {
    document.getElementById("csirAdminLogin").hidden = true;
    document.getElementById("csirAdminDash").hidden = false;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  async function loadContacts() {
    var wrap = document.getElementById("csirAdminTableWrap");
    var stats = document.getElementById("csirAdminStats");
    if (!wrap) return;
    wrap.innerHTML = '<p class="csir-admin-muted">Loading…</p>';

    try {
      var r = await apiFetch("/api/admin/csir-leads", { headers: authHeaders() });
      if (r.status === 401) {
        showLogin();
        return;
      }
      if (!r.ok) throw new Error("load failed");
      var leads = await r.json();
      var contacts = Array.isArray(leads)
        ? leads.filter(function (l) {
            return l.type === "contact" || l.message;
          })
        : [];

      if (stats) {
        stats.innerHTML =
          '<div class="csir-admin-stat"><strong>' +
          contacts.length +
          '</strong><span>Contact messages</span></div>' +
          '<div class="csir-admin-stat"><strong>' +
          (leads.length - contacts.length) +
          '</strong><span>Other leads</span></div>';
      }

      if (!contacts.length) {
        wrap.innerHTML = "<p class=\"csir-admin-muted\">No contact messages yet.</p>";
        return;
      }

      contacts.sort(function (a, b) {
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });

      var rows = contacts
        .map(function (l) {
          return (
            "<tr><td>" +
            esc(l.name) +
            "</td><td><a href=\"mailto:" +
            esc(l.email) +
            "\">" +
            esc(l.email) +
            "</a></td><td>" +
            esc(l.phone || "—") +
            "</td><td>" +
            esc(l.subject || "—") +
            '</td><td class="csir-admin-msg-cell">' +
            esc(l.message || "—") +
            "</td><td>" +
            esc(formatDate(l.createdAt)) +
            "</td></tr>"
          );
        })
        .join("");

      wrap.innerHTML =
        '<table class="csir-admin-table"><thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Subject</th><th>Message</th><th>Received</th></tr></thead><tbody>' +
        rows +
        "</tbody></table>";
    } catch {
      wrap.innerHTML = "<p class=\"csir-admin-muted\">Could not load messages. Check you are signed in.</p>";
    }
  }

  document.getElementById("csirAdminLoginForm")?.addEventListener("submit", async function (e) {
    e.preventDefault();
    var err = document.getElementById("csirAdminLoginErr");
    var user = document.getElementById("csirAdminUser").value.trim();
    var pass = document.getElementById("csirAdminPass").value;
    if (err) err.hidden = true;
    try {
      var r = await apiFetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass })
      });
      var data = await r.json();
      if (!r.ok || !data.ok) {
        if (err) {
          err.textContent = data.error || "Sign in failed.";
          err.hidden = false;
        }
        return;
      }
      document.getElementById("csirAdminPass").value = "";
      showDash();
      loadContacts();
    } catch {
      if (err) {
        err.textContent = "Network error. Is the server running?";
        err.hidden = false;
      }
    }
  });

  document.getElementById("csirAdminLogout")?.addEventListener("click", async function () {
    try {
      await apiFetch("/api/admin/logout", { method: "POST", headers: authHeaders() });
    } catch (_) {}
    showLogin();
  });

  document.getElementById("csirAdminRefresh")?.addEventListener("click", loadContacts);

  async function boot() {
    try {
      var r = await apiFetch("/api/admin/session");
      var data = await r.json();
      if (r.ok && data.ok) {
        showDash();
        loadContacts();
      } else {
        showLogin();
      }
    } catch {
      showLogin();
    }
  }

  boot();
})();

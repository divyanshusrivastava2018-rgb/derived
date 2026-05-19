/**
 * Paid-member status — verified via signed httpOnly cookie from the server.
 */
(function () {
  var cachedPaid = false;
  var checked = false;

  function refreshStatus() {
    var req =
      window.ResearchiumApi && window.ResearchiumApi.get
        ? window.ResearchiumApi.get("/api/member/status")
        : fetch("/api/member/status", { credentials: "same-origin" }).then(function (r) {
            return r.ok ? r.json() : { paid: false };
          });
    return req
      .then(function (data) {
        cachedPaid = !!(data && data.paid);
        checked = true;
        return cachedPaid;
      })
      .catch(function () {
        cachedPaid = false;
        checked = true;
        return false;
      });
  }

  window.ResearchiumMember = {
    isPaid: function () {
      return cachedPaid;
    },
    refresh: refreshStatus,
    setPaidDemo: function () {
      return fetch("/api/member/demo-unlock", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" }
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok) throw new Error((data && data.error) || "Unlock failed");
            cachedPaid = true;
            checked = true;
            return true;
          });
        });
    },
    clear: function () {
      return fetch("/api/member/logout", {
        method: "POST",
        credentials: "same-origin"
      }).then(function () {
        cachedPaid = false;
        checked = true;
      });
    }
  };

  refreshStatus();
})();

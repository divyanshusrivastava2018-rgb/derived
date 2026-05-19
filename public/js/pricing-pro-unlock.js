(function () {
  var btn = document.getElementById("btnProUnlock");
  if (!btn) return;
  btn.addEventListener("click", function () {
    if (typeof ResearchiumMember === "undefined" || !ResearchiumMember.setPaidDemo) return;
    btn.disabled = true;
    ResearchiumMember.setPaidDemo()
      .then(function () {
        var ret = new URLSearchParams(location.search).get("return");
        if (ret && ret.startsWith("/") && !ret.startsWith("//")) {
          window.location.href = ret;
        } else {
          window.location.href = "/courses.html";
        }
      })
      .catch(function (err) {
        btn.disabled = false;
        alert(err.message || "Could not activate demo access. Is the server running?");
      });
  });
})();

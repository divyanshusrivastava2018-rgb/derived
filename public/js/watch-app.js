(function () {
  var API = "/api/courses";
  var REFRESH_MS = 60 * 1000;

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function escapeHtml(s) {
    if (s == null || s === "") return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function isFreeCourse(c) {
    return !c.price || Number(c.price) === 0;
  }

  function canWatchCourse(c) {
    if (c && c.canWatch === true) return true;
    if (c && c.canWatch === false) return false;
    return isFreeCourse(c);
  }

  function renderPlayer(c, host) {
    host.innerHTML = "";
    if (c.type === "youtube" && c.ytId) {
      host.innerHTML =
        '<iframe src="https://www.youtube.com/embed/' +
        escapeHtml(c.ytId) +
        '?rel=0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>';
    } else if (c.type === "upload" && c.fileUrl) {
      var mime = c.mimeType || "";
      if (mime.startsWith("video/")) {
        host.innerHTML =
          '<video src="' + escapeHtml(c.fileUrl) + '" controls autoplay playsinline></video>';
      } else {
        host.innerHTML = '<iframe src="' + escapeHtml(c.fileUrl) + '"></iframe>';
      }
    } else if (c.type === "external" && c.extUrl) {
      host.innerHTML =
        '<iframe src="' + escapeHtml(c.extUrl) + '" allowfullscreen></iframe>';
    } else {
      host.innerHTML =
        '<div class="watch-no-preview">Preview not available for this item.</div>';
    }
  }

  var currentId = null;
  var allCourses = [];

  function buildPricingReturnUrl() {
    return "/pricing.html?return=" + encodeURIComponent(window.location.pathname + window.location.search);
  }

  function setPaywallVisible(show) {
    var wall = document.getElementById("watchPaywall");
    var host = document.getElementById("watchPlayerHost");
    var link = document.getElementById("watchUpgradeLink");
    if (link) link.href = buildPricingReturnUrl();
    if (wall) wall.hidden = !show;
    if (host) host.hidden = show;
  }

  function setError(msg) {
    var el = document.getElementById("watchError");
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  function renderDetail(c) {
    document.getElementById("watchCategory").textContent = c.category || "";
    document.getElementById("watchTitle").textContent = c.title || "";
    document.getElementById("watchInstructor").textContent =
      "👤 " + (c.instructor || "Researchium") + " · " + (c.level || "") + " · " + (c.lang || "English");
    document.getElementById("watchDesc").textContent = c.desc || "";
    document.title = (c.title ? c.title + " · " : "") + "Watch – Researchium";

    var host = document.getElementById("watchFrame");
    var allowed = canWatchCourse(c);
    setPaywallVisible(!allowed);
    if (allowed) {
      renderPlayer(c, host);
    } else if (host) {
      host.innerHTML = "";
    }
  }

  function renderSidebarList() {
    var list = document.getElementById("watchList");
    if (!list) return;

    var sorted = allCourses.slice().sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (!sorted.length) {
      list.innerHTML = '<p class="watch-list-empty">No courses in the catalog.</p>';
      return;
    }

    list.innerHTML = sorted
      .map(function (c) {
        var active = c.id === currentId;
        var paid = !isFreeCourse(c);
        var locked = paid && !canWatchCourse(c);
        var lockHtml = locked ? '<span class="watch-lock" title="Pro">🔒</span>' : "";
        var priceHtml = paid
          ? '<span class="watch-side-price">₹' + Number(c.price).toLocaleString() + "</span>"
          : '<span class="watch-side-free">Free</span>';
        return (
          '<a href="/watch.html?id=' +
          encodeURIComponent(c.id) +
          '" class="watch-list-item' +
          (active ? " is-active" : "") +
          (locked ? " is-locked" : "") +
          '">' +
          '<span class="watch-list-title">' +
          escapeHtml(c.title) +
          lockHtml +
          "</span>" +
          '<span class="watch-list-meta">' +
          escapeHtml(c.category || "") +
          " · " +
          priceHtml +
          "</span></a>"
        );
      })
      .join("");
  }

  function fetchOpts() {
    return { credentials: "same-origin" };
  }

  async function apiGet(path) {
    if (window.ResearchiumApi && window.ResearchiumApi.get) {
      return window.ResearchiumApi.get(path);
    }
    var r = await fetch(path, fetchOpts());
    if (!r.ok) throw new Error("Could not load");
    return r.json();
  }

  async function loadAllCourses(silent) {
    try {
      allCourses = await apiGet(API);
      renderSidebarList();
      var note = document.getElementById("watchRefreshNote");
      if (note && !silent) {
        note.textContent = "Updated " + new Date().toLocaleTimeString();
      }
    } catch (e) {
      if (!silent) {
        var list = document.getElementById("watchList");
        if (list) list.innerHTML = '<p class="watch-list-empty">Could not refresh list. Is the server running?</p>';
      }
    }
  }

  async function init() {
    if (typeof ResearchiumMember !== "undefined" && ResearchiumMember.refresh) {
      await ResearchiumMember.refresh();
    }

    var id = qs("id");
    if (!id) {
      setError("Missing course. Open a video from the course catalog.");
      document.getElementById("watchPlayerSection").hidden = true;
      setPaywallVisible(false);
      await loadAllCourses(false);
      return;
    }

    currentId = id;

    try {
      var c = await apiGet(API + "/" + encodeURIComponent(id));
      setError("");
      renderDetail(c);
    } catch (e) {
      setError(e && e.status === 404 ? "Course not found." : "Could not load this course.");
      document.getElementById("watchPlayerSection").hidden = true;
      setPaywallVisible(false);
    }

    await loadAllCourses(false);
    setInterval(function () {
      loadAllCourses(true);
      if (currentId) {
        apiGet(API + "/" + encodeURIComponent(currentId))
          .then(function (c) {
            if (c) renderDetail(c);
          })
          .catch(function () {});
      }
    }, REFRESH_MS);
  }

  init();
})();

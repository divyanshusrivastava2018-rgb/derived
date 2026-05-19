(function () {
  var API = "/api/courses";
  var REFRESH_MS = 60 * 1000;
  var CHEMISTRY_PLAYLIST_ID = "PLIowxflsb4xC5P98ChXATyDaGEAPpV4RN";

  var currentId = null;
  var currentCourse = null;
  var allCourses = [];
  var playlistVideos = [];
  var activeVideoId = null;

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

  function embedSrc(ytId, ytListId) {
    var src = "https://www.youtube.com/embed/" + encodeURIComponent(ytId) + "?rel=0";
    if (ytListId) src += "&list=" + encodeURIComponent(ytListId);
    return src;
  }

  function renderPlayer(ytId, ytListId, host) {
    host.innerHTML = "";
    if (!ytId) {
      host.innerHTML = '<div class="watch-no-preview">Preview not available.</div>';
      return;
    }
    host.innerHTML =
      '<iframe src="' +
      embedSrc(ytId, ytListId) +
      '" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>';
  }

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

  function setSidebarTitle(text, hint) {
    var h2 = document.getElementById("watch-sidebar-title");
    var hintEl = document.querySelector(".watch-sidebar-hint");
    if (h2) h2.textContent = text;
    if (hintEl && hint != null) hintEl.textContent = hint;
  }

  async function loadPlaylistVideos(c) {
    if (Array.isArray(c.playlistVideos) && c.playlistVideos.length) {
      return c.playlistVideos.slice();
    }
    if (c.ytListId === CHEMISTRY_PLAYLIST_ID || c.id === "d1") {
      try {
        var r = await fetch("/data/chemistry-playlist.json");
        if (r.ok) {
          var data = await r.json();
          if (Array.isArray(data.videos) && data.videos.length) return data.videos;
        }
      } catch (_) {
        /* ignore */
      }
    }
    return [];
  }

  function playVideo(ytId) {
    if (!currentCourse || !ytId) return;
    activeVideoId = ytId;
    var host = document.getElementById("watchFrame");
    if (host && canWatchCourse(currentCourse)) {
      renderPlayer(ytId, currentCourse.ytListId || null, host);
    }
    renderPlaylistSidebar();
    var params = new URLSearchParams(window.location.search);
    params.set("id", currentId);
    params.set("v", ytId);
    var next = window.location.pathname + "?" + params.toString();
    window.history.replaceState(null, "", next);
  }

  function renderPlaylistSidebar() {
    var list = document.getElementById("watchList");
    if (!list || !playlistVideos.length) return;

    setSidebarTitle(
      "Playlist · " + playlistVideos.length + " videos",
      currentCourse && currentCourse.playlistUrl
        ? "Tap a lecture to play. Full series on YouTube linked below."
        : "Tap a lecture to play in order."
    );

    var linkHtml = "";
    if (currentCourse && currentCourse.playlistUrl) {
      linkHtml =
        '<p class="watch-pl-yt-link"><a href="' +
        escapeHtml(currentCourse.playlistUrl) +
        '" target="_blank" rel="noopener noreferrer">Open full playlist on YouTube ↗</a></p>';
    }

    list.innerHTML =
      linkHtml +
      playlistVideos
        .map(function (v) {
          var active = v.id === activeVideoId;
          return (
            '<button type="button" class="watch-list-item watch-pl-item' +
            (active ? " is-active" : "") +
            '" data-vid="' +
            escapeHtml(v.id) +
            '">' +
            '<span class="watch-pl-seq">' +
            (v.seq || "") +
            "</span>" +
            '<span class="watch-list-title">' +
            escapeHtml(v.title || "Lecture") +
            "</span></button>"
          );
        })
        .join("");

    list.querySelectorAll(".watch-pl-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        playVideo(btn.getAttribute("data-vid"));
      });
    });
  }

  function renderDetail(c) {
    currentCourse = c;
    document.getElementById("watchCategory").textContent = c.category || "";
    document.getElementById("watchTitle").textContent = c.title || "";
    document.getElementById("watchInstructor").textContent =
      "👤 " + (c.instructor || "Researchium") + " · " + (c.level || "") + " · " + (c.lang || "English");
    document.getElementById("watchDesc").textContent = c.desc || "";
    document.title = (c.title ? c.title + " · " : "") + "Watch – Researchium";

    var allowed = canWatchCourse(c);
    setPaywallVisible(!allowed);

    var startId = qs("v") || c.ytId;
    activeVideoId = startId;

    var host = document.getElementById("watchFrame");
    if (allowed) {
      renderPlayer(startId, c.ytListId || null, host);
    } else if (host) {
      host.innerHTML = "";
    }
  }

  function renderSidebarList() {
    var list = document.getElementById("watchList");
    if (!list) return;

    setSidebarTitle(
      "All videos",
      "List refreshes from the server every minute so new uploads appear automatically."
    );

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

  async function refreshSidebarForCourse(c) {
    playlistVideos = await loadPlaylistVideos(c);
    if (playlistVideos.length) {
      renderPlaylistSidebar();
    } else {
      renderSidebarList();
    }
  }

  async function loadAllCourses(silent) {
    try {
      allCourses = await apiGet(API);
      if (currentCourse) {
        await refreshSidebarForCourse(currentCourse);
      } else {
        renderSidebarList();
      }
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
      await refreshSidebarForCourse(c);
    } catch (e) {
      setError(e && e.status === 404 ? "Course not found." : "Could not load this course.");
      document.getElementById("watchPlayerSection").hidden = true;
      setPaywallVisible(false);
    }

    await loadAllCourses(true);
    setInterval(function () {
      loadAllCourses(true);
      if (currentId) {
        apiGet(API + "/" + encodeURIComponent(currentId))
          .then(function (c) {
            if (!c) return;
            currentCourse = c;
            renderDetail(c);
            return refreshSidebarForCourse(c);
          })
          .catch(function () {});
      }
    }, REFRESH_MS);
  }

  init();
})();

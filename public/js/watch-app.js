(function () {
  var API = "/api/courses";
  var REFRESH_MS = 60 * 1000;
  var CHEMISTRY_PLAYLIST_ID = "PLIowxflsb4xC5P98ChXATyDaGEAPpV4RN";
  var CHEMISTRY_PLAYLIST_URL =
    "https://www.youtube.com/playlist?list=" + CHEMISTRY_PLAYLIST_ID;

  var currentId = null;
  var currentCourse = null;
  var allCourses = [];
  var playlistVideos = [];
  var activeVideoId = null;
  var chemistryBundlePromise = null;

  function qs(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function escapeHtml(s) {
    if (s == null || s === "") return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function isChemistryDemo(c) {
    if (!c) return false;
    if (c.id === "d1") return true;
    return /^CHEMISTRY\s+DEMO/i.test(String(c.title || "").trim());
  }

  function isFreeCourse(c) {
    return !c.price || Number(c.price) === 0;
  }

  function canWatchCourse(c) {
    if (c && c.canWatch === true) return true;
    if (c && c.canWatch === false) return false;
    return isFreeCourse(c);
  }

  function fetchChemistryBundle() {
    if (!chemistryBundlePromise) {
      chemistryBundlePromise = fetch("/data/chemistry-playlist.json", { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("missing");
          return r.json();
        })
        .catch(function () {
          return null;
        });
    }
    return chemistryBundlePromise;
  }

  async function enrichCourse(c) {
    if (!c || typeof c !== "object" || Array.isArray(c)) return c;
    if (!isChemistryDemo(c)) return c;

    var bundle = await fetchChemistryBundle();
    var videos =
      Array.isArray(c.playlistVideos) && c.playlistVideos.length
        ? c.playlistVideos
        : bundle && Array.isArray(bundle.videos)
          ? bundle.videos
          : [];

    var firstId = (videos[0] && videos[0].id) || c.ytId || null;

    return Object.assign({}, c, {
      type: "youtube",
      title: c.title || "CHEMISTRY DEMO VIDEO",
      category: c.category || "JEE / NEET",
      level: c.level || "Advanced",
      instructor: c.instructor || "Researchium",
      lang: c.lang || "Hindi",
      price: c.price != null ? c.price : 0,
      ytId: c.ytId || firstId,
      ytListId: c.ytListId || (bundle && bundle.playlistId) || CHEMISTRY_PLAYLIST_ID,
      playlistUrl: c.playlistUrl || (bundle && bundle.playlistUrl) || CHEMISTRY_PLAYLIST_URL,
      playlistVideos: videos,
      duration: c.duration || (videos.length ? "Playlist · " + videos.length + " videos" : "Playlist"),
      desc:
        c.desc ||
        (bundle && bundle.subheading) ||
        "Class-10 Chemistry — watch all lectures in order."
    });
  }

  function embedSrc(ytId, ytListId) {
    if (ytId) {
      var src = "https://www.youtube.com/embed/" + encodeURIComponent(ytId) + "?rel=0";
      if (ytListId) src += "&list=" + encodeURIComponent(ytListId);
      return src;
    }
    if (ytListId) {
      return (
        "https://www.youtube.com/embed/videoseries?list=" + encodeURIComponent(ytListId) + "&rel=0"
      );
    }
    return null;
  }

  function ytThumb(id) {
    return "https://img.youtube.com/vi/" + encodeURIComponent(id) + "/mqdefault.jpg";
  }

  function renderPlayer(ytId, ytListId, host) {
    host.innerHTML = "";
    var src = embedSrc(ytId, ytListId);
    if (!src) {
      host.innerHTML = '<div class="watch-no-preview">Could not load playlist. Try again later.</div>';
      return;
    }
    host.innerHTML =
      '<iframe src="' +
      src +
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
    var enriched = await enrichCourse(c);
    if (Array.isArray(enriched.playlistVideos) && enriched.playlistVideos.length) {
      return enriched.playlistVideos.slice();
    }
    return [];
  }

  function playVideo(ytId) {
    if (!currentCourse || !ytId) return;
    activeVideoId = ytId;
    var host = document.getElementById("watchFrame");
    if (host && canWatchCourse(currentCourse)) {
      renderPlayer(ytId, currentCourse.ytListId || CHEMISTRY_PLAYLIST_ID, host);
    }
    renderPlaylistSidebar();
    var params = new URLSearchParams(window.location.search);
    params.set("id", currentId);
    params.set("v", ytId);
    window.history.replaceState(null, "", window.location.pathname + "?" + params.toString());
  }

  function renderPlaylistSidebar() {
    var list = document.getElementById("watchList");
    if (!list || !playlistVideos.length) return;

    setSidebarTitle(
      "Playlist · " + playlistVideos.length + " videos",
      "Tap a lecture to play — same style as Live Classes."
    );

    var linkHtml =
      '<p class="watch-pl-yt-link"><a href="' +
      escapeHtml((currentCourse && currentCourse.playlistUrl) || CHEMISTRY_PLAYLIST_URL) +
      '" target="_blank" rel="noopener noreferrer">Open full playlist on YouTube ↗</a></p>';

    list.innerHTML =
      linkHtml +
      '<div class="watch-pl-queue" role="list" aria-label="Chemistry playlist">' +
      playlistVideos
        .map(function (v) {
          var active = v.id === activeVideoId;
          return (
            '<button type="button" class="watch-list-item watch-pl-item yt-pl-item' +
            (active ? " is-active" : "") +
            '" data-vid="' +
            escapeHtml(v.id) +
            '" role="listitem">' +
            '<span class="watch-pl-seq">' +
            (v.seq || "") +
            "</span>" +
            '<img class="watch-pl-thumb" src="' +
            escapeHtml(ytThumb(v.id)) +
            '" alt="" loading="lazy" width="80" height="45" />' +
            '<span class="watch-list-title">' +
            escapeHtml(v.title || "Lecture") +
            "</span></button>"
          );
        })
        .join("") +
      "</div>";

    list.querySelectorAll(".watch-pl-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        playVideo(btn.getAttribute("data-vid"));
      });
    });
  }

  async function renderDetail(c) {
    currentCourse = await enrichCourse(c);
    document.getElementById("watchCategory").textContent = currentCourse.category || "";
    document.getElementById("watchTitle").textContent = currentCourse.title || "";
    document.getElementById("watchInstructor").textContent =
      "👤 " +
      (currentCourse.instructor || "Researchium") +
      " · " +
      (currentCourse.level || "") +
      " · " +
      (currentCourse.lang || "English");
    document.getElementById("watchDesc").textContent = currentCourse.desc || "";
    document.title = (currentCourse.title ? currentCourse.title + " · " : "") + "Watch – Researchium";

    var allowed = canWatchCourse(currentCourse);
    setPaywallVisible(!allowed);

    var startId = qs("v") || currentCourse.ytId;
    if (!startId && playlistVideos.length) startId = playlistVideos[0].id;
    activeVideoId = startId;

    var host = document.getElementById("watchFrame");
    if (allowed) {
      renderPlayer(startId, currentCourse.ytListId || CHEMISTRY_PLAYLIST_ID, host);
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
      var list = await apiGet(API);
      var enriched = [];
      for (var i = 0; i < list.length; i++) {
        enriched.push(await enrichCourse(list[i]));
      }
      allCourses = enriched;
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
        var el = document.getElementById("watchList");
        if (el) el.innerHTML = '<p class="watch-list-empty">Could not refresh list. Is the server running?</p>';
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
      var raw = await apiGet(API + "/" + encodeURIComponent(id));
      setError("");
      playlistVideos = await loadPlaylistVideos(raw);
      await renderDetail(raw);
      await refreshSidebarForCourse(raw);
    } catch (e) {
      if (isChemistryDemo({ id: id, title: "CHEMISTRY DEMO VIDEO" })) {
        var fallback = await enrichCourse({ id: id, title: "CHEMISTRY DEMO VIDEO", price: 0, type: "youtube" });
        setError("");
        playlistVideos = await loadPlaylistVideos(fallback);
        await renderDetail(fallback);
        await refreshSidebarForCourse(fallback);
      } else {
        setError(e && e.status === 404 ? "Course not found." : "Could not load this course.");
        document.getElementById("watchPlayerSection").hidden = true;
        setPaywallVisible(false);
      }
    }

    await loadAllCourses(true);
    setInterval(function () {
      loadAllCourses(true);
      if (currentId) {
        apiGet(API + "/" + encodeURIComponent(currentId))
          .then(async function (c) {
            if (!c) return;
            playlistVideos = await loadPlaylistVideos(c);
            await renderDetail(c);
            await refreshSidebarForCourse(c);
          })
          .catch(function () {});
      }
    }, REFRESH_MS);
  }

  init();
})();

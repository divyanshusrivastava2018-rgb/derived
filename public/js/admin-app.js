(function () {
  var STORAGE_KEY = "researchium_admin_token";
  var PAGE_KEYS = ["home", "about", "pricing", "live", "blog", "courses"];
  var PAGE_LABELS = {
    home: "Home",
    about: "About",
    pricing: "Pricing",
    live: "Live classes",
    blog: "Blog",
    courses: "Courses (hero only — count tag stays dynamic)"
  };

  var loginEl = document.getElementById("admin-login");
  var dashEl = document.getElementById("admin-dash");
  var activeCourseTab = "youtube";

  function getToken() {
    return sessionStorage.getItem(STORAGE_KEY) || "";
  }

  function setToken(s) {
    if (s) sessionStorage.setItem(STORAGE_KEY, s);
    else sessionStorage.removeItem(STORAGE_KEY);
  }

  function authHeaders(isJson) {
    var h = {};
    var t = getToken();
    if (t) h.Authorization = "Bearer " + t;
    if (isJson) h["Content-Type"] = "application/json";
    return h;
  }

  function showToast(msg, isErr) {
    var t = document.getElementById("adminToast");
    if (!t) return;
    t.textContent = msg;
    t.classList.toggle("is-error", !!isErr);
    t.hidden = false;
    clearTimeout(t._hide);
    t._hide = setTimeout(function () {
      t.hidden = true;
    }, 4000);
  }

  function showLogin() {
    setToken("");
    if (loginEl) loginEl.hidden = false;
    if (dashEl) dashEl.hidden = true;
  }

  async function loadLoginHint() {
    var info = document.getElementById("adminLoginInfo");
    var userInput = document.getElementById("adminUsername");
    if (!info || !userInput) return;
    userInput.placeholder = "Your login ID";
    info.textContent = "Credentials are configured on the server (not stored in this page).";
  }

  function showDash() {
    if (loginEl) loginEl.hidden = true;
    if (dashEl) dashEl.hidden = false;
    loadBlogTable();
    loadCourseList();
    loadLiveYtForm();
    renderPageCopyEditor();
    loadNewsTable();
    loadMaterialsTable();
    loadLeadsTables();
  }

  async function handleAuthResponse(r) {
    if (r.status === 401) {
      setToken("");
      showLogin();
      showToast("Session expired — sign in again.", true);
      return null;
    }
    return r;
  }

  document.getElementById("adminLoginForm")?.addEventListener("submit", async function (e) {
    e.preventDefault();
    var err = document.getElementById("adminLoginErr");
    var username = document.getElementById("adminUsername").value.trim();
    var password = document.getElementById("adminPassword").value;
    err.hidden = true;
    try {
      var r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username, password: password })
      });
      var data = await r.json().catch(function () {
        return {};
      });
      if (!r.ok || !data.token) {
        err.textContent =
          data.error ||
          "Invalid login ID or password.";
        err.hidden = false;
        return;
      }
      setToken(data.token);
      document.getElementById("adminPassword").value = "";
      showDash();
      showToast("Signed in.");
    } catch {
      err.textContent = "Could not reach server.";
      err.hidden = false;
    }
  });

  loadLoginHint();

  document.getElementById("adminTogglePw")?.addEventListener("click", function () {
    var inp = document.getElementById("adminPassword");
    if (!inp) return;
    var show = inp.type === "password";
    inp.type = show ? "text" : "password";
    this.textContent = show ? "Hide" : "Show";
    this.setAttribute("aria-pressed", show ? "true" : "false");
  });

  document.getElementById("adminLogout")?.addEventListener("click", async function () {
    var t = getToken();
    if (t) {
      try {
        await fetch("/api/admin/logout", { method: "POST", headers: authHeaders() });
      } catch (_) {
        /* ignore */
      }
    }
    showLogin();
    showToast("Signed out.");
  });

  document.querySelectorAll(".admin-tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".admin-tab").forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });
      document.querySelectorAll(".admin-panel").forEach(function (p) {
        p.hidden = true;
      });
      var map = {
        blog: "panel-blog",
        videos: "panel-videos",
        liveyt: "panel-liveyt",
        pages: "panel-pages",
        news: "panel-news",
        materials: "panel-materials",
        leads: "panel-leads"
      };
      if (tab === "leads") loadLeadsTables();
      var id = map[tab];
      if (id) {
        var el = document.getElementById(id);
        if (el) el.hidden = false;
      }
    });
  });

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function attrEsc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  async function loadBlogTable() {
    var wrap = document.getElementById("blogTableWrap");
    if (!wrap) return;
    wrap.innerHTML = '<p class="admin-muted">Loading…</p>';
    try {
      var r = await fetch("/api/blog");
      var posts = await r.json();
      if (!posts.length) {
        wrap.innerHTML = "<p>No posts yet.</p>";
        return;
      }
      var rows = posts
        .map(function (p) {
          return (
            "<tr><td>" +
            esc(p.tag) +
            "</td><td>" +
            esc(p.title) +
            "</td><td>" +
            esc(p.href) +
            "</td><td>" +
            (p.order != null ? esc(String(p.order)) : "") +
            '</td><td class="admin-td-actions"><button type="button" class="btn-card-ghost btn-edit-post" data-id="' +
            esc(p.id) +
            '">Edit</button> <button type="button" class="btn-card-danger btn-del-post" data-id="' +
            esc(p.id) +
            '">Delete</button></td></tr>'
          );
        })
        .join("");
      wrap.innerHTML =
        '<table class="admin-table"><thead><tr><th>Tag</th><th>Title</th><th>Link</th><th>Order</th><th></th></tr></thead><tbody>' +
        rows +
        "</tbody></table>";
    } catch {
      wrap.innerHTML = "<p>Failed to load blog.</p>";
    }
  }

  document.getElementById("blogTableWrap")?.addEventListener("click", async function (e) {
    var del = e.target.closest(".btn-del-post");
    var ed = e.target.closest(".btn-edit-post");
    if (del) {
      var id = del.getAttribute("data-id");
      if (!id || !confirm("Delete this post?")) return;
      var r = await handleAuthResponse(await fetch("/api/blog/" + encodeURIComponent(id), { method: "DELETE", headers: authHeaders() }));
      if (!r || !r.ok) return;
      showToast("Post deleted.");
      loadBlogTable();
    } else if (ed) {
      var pid = ed.getAttribute("data-id");
      openBlogModal(pid);
    }
  });

  document.getElementById("btnNewPost")?.addEventListener("click", function () {
    openBlogModal(null);
  });

  var blogModal = document.getElementById("blogModal");

  function openBlogModal(id) {
    document.getElementById("blogModalTitle").textContent = id ? "Edit post" : "New post";
    document.getElementById("blogEditId").value = id || "";
    if (!id) {
      document.getElementById("blogFieldTag").value = "";
      document.getElementById("blogFieldTitle").value = "";
      document.getElementById("blogFieldExcerpt").value = "";
      document.getElementById("blogFieldHref").value = "/";
      document.getElementById("blogFieldOrder").value = String(Date.now());
      var exNew = document.getElementById("blogEditExtras");
      if (exNew) exNew.value = "{}";
    } else {
      fetch("/api/blog/" + encodeURIComponent(id))
        .then(function (r) {
          return r.json();
        })
        .then(function (p) {
          document.getElementById("blogFieldTag").value = p.tag || "";
          document.getElementById("blogFieldTitle").value = p.title || "";
          document.getElementById("blogFieldExcerpt").value = p.excerpt || "";
          document.getElementById("blogFieldHref").value = p.href || "/";
          document.getElementById("blogFieldOrder").value = String(p.order != null ? p.order : 0);
          var core = { tag: 1, title: 1, excerpt: 1, href: 1, order: 1, id: 1, createdAt: 1 };
          var extras = {};
          for (var k in p) {
            if (Object.prototype.hasOwnProperty.call(p, k) && !core[k]) extras[k] = p[k];
          }
          var exEl = document.getElementById("blogEditExtras");
          if (exEl) exEl.value = JSON.stringify(extras, null, 2);
        })
        .catch(function () {
          showToast("Could not load post.", true);
        });
    }
    blogModal.classList.add("open");
  }

  document.getElementById("blogModalClose")?.addEventListener("click", function () {
    blogModal.classList.remove("open");
  });
  blogModal?.addEventListener("click", function (e) {
    if (e.target === blogModal) blogModal.classList.remove("open");
  });

  document.getElementById("blogModalForm")?.addEventListener("submit", async function (e) {
    e.preventDefault();
    var id = document.getElementById("blogEditId").value;
    var body = {
      tag: document.getElementById("blogFieldTag").value.trim(),
      title: document.getElementById("blogFieldTitle").value.trim(),
      excerpt: document.getElementById("blogFieldExcerpt").value.trim(),
      href: document.getElementById("blogFieldHref").value.trim() || "/",
      order: Number(document.getElementById("blogFieldOrder").value) || 0
    };
    var url = id ? "/api/blog/" + encodeURIComponent(id) : "/api/blog";
    var method = id ? "PUT" : "POST";
    var r0 = await fetch(url, { method, headers: authHeaders(true), body: JSON.stringify(body) });
    var r = await handleAuthResponse(r0);
    if (!r || !r.ok) {
      var err = await r0.json().catch(function () {
        return {};
      });
      showToast(err.error || "Save failed", true);
      return;
    }
    blogModal.classList.remove("open");
    showToast("Post saved.");
    loadBlogTable();
  });

  function extractYtId(url) {
    if (!url) return null;
    var s = String(url).trim();
    var m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    return null;
  }

  document.querySelectorAll("#panel-videos .tab-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      activeCourseTab = b.getAttribute("data-ctab") || "youtube";
      document.querySelectorAll("#panel-videos .tab-btn").forEach(function (x) {
        x.classList.toggle("active", x === b);
      });
      ["youtube", "upload", "external"].forEach(function (t) {
        var el = document.getElementById("adm-tab-" + t);
        if (el) el.classList.toggle("u-hidden", t !== activeCourseTab);
      });
    });
  });

  document.getElementById("btnImportPlaylist")?.addEventListener("click", async function () {
    var urlEl = document.getElementById("importPlaylistUrl");
    var out = document.getElementById("importPlaylistResult");
    var playlistUrl = urlEl && urlEl.value.trim();
    if (!playlistUrl) {
      showToast("Paste a playlist URL first.", true);
      return;
    }
    var cat = document.getElementById("importCategory").value;
    var body = {
      playlistUrl: playlistUrl,
      importAsCourses: document.getElementById("chkImportCourses").checked,
      syncSitePlayer: document.getElementById("chkSyncPlayer").checked,
      autoCategory: !cat,
      category: cat || undefined,
      level: document.getElementById("importLevel").value,
      lang: document.getElementById("importLang").value,
      instructor: document.getElementById("importInst").value.trim(),
      price: parseInt(document.getElementById("importPrice").value, 10) || 0
    };
    var btn = document.getElementById("btnImportPlaylist");
    btn.disabled = true;
    if (out) {
      out.hidden = true;
    }
    try {
      var r0 = await fetch("/api/admin/import-playlist", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(body)
      });
      var r = await handleAuthResponse(r0);
      var data = await r0.json().catch(function () {
        return {};
      });
      if (!r || !r0.ok) {
        showToast(data.error || "Import failed", true);
        if (out) {
          out.textContent = data.error || "";
          out.hidden = false;
        }
        return;
      }
      var msg =
        "Imported " +
        data.videosFound +
        " videos. Category: " +
        data.categoryUsed +
        ". Added " +
        data.coursesAdded +
        " courses" +
        (data.coursesSkipped ? " (" + data.coursesSkipped + " skipped as duplicates)" : "") +
        (data.sitePlayerVideos ? "; synced " + data.sitePlayerVideos + " to on-page player." : ".");
      showToast("Playlist import complete.");
      if (out) {
        out.textContent = msg;
        out.hidden = false;
      }
      loadCourseList();
      if (body.syncSitePlayer) loadLiveYtForm();
    } catch (e) {
      showToast(e.message || "Import failed", true);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("adminCourseForm")?.addEventListener("submit", async function (e) {
    e.preventDefault();
    var title = document.getElementById("admTitle").value.trim();
    if (!title) {
      showToast("Title required.", true);
      return;
    }
    var payloadBase = {
      title,
      category: document.getElementById("admCat").value,
      level: document.getElementById("admLvl").value,
      instructor: document.getElementById("admInst").value.trim() || "Researchium",
      lang: document.getElementById("admLang").value,
      price: parseInt(document.getElementById("admPrice").value, 10) || 0,
      duration: document.getElementById("admDur").value.trim() || "Self-paced",
      desc: document.getElementById("admDesc").value.trim()
    };
    try {
      if (activeCourseTab === "upload") {
        var f = document.getElementById("admFile").files[0];
        if (!f) {
          showToast("Choose a file.", true);
          return;
        }
        var fd = new FormData();
        fd.append("type", "upload");
        Object.keys(payloadBase).forEach(function (k) {
          fd.append(k, String(payloadBase[k]));
        });
        fd.append("courseFile", f);
        var th = document.getElementById("admThumb").files[0];
        if (th) fd.append("thumb", th);
        var r0 = await fetch("/api/courses", { method: "POST", headers: authHeaders(), body: fd });
        var r = await handleAuthResponse(r0);
        if (!r || !r.ok) throw new Error((await r0.json().catch(function () { return {}; })).error || "Save failed");
      } else if (activeCourseTab === "youtube") {
        var ytUrl = document.getElementById("admYtUrl").value.trim();
        if (!extractYtId(ytUrl)) {
          showToast("Valid YouTube URL required.", true);
          return;
        }
        var r1 = await fetch("/api/courses", {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({ type: "youtube", ytUrl, ...payloadBase })
        });
        var r2 = await handleAuthResponse(r1);
        if (!r2 || !r2.ok) throw new Error((await r1.json().catch(function () { return {}; })).error || "Save failed");
      } else {
        var extUrl = document.getElementById("admExtUrl").value.trim();
        if (!extUrl) {
          showToast("External URL required.", true);
          return;
        }
        var r3 = await fetch("/api/courses", {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({ type: "external", extUrl, ...payloadBase })
        });
        var r4 = await handleAuthResponse(r3);
        if (!r4 || !r4.ok) throw new Error((await r3.json().catch(function () { return {}; })).error || "Save failed");
      }
      showToast("Course published.");
      document.getElementById("adminCourseForm").reset();
      loadCourseList();
    } catch (err) {
      showToast(err.message || "Could not save", true);
    }
  });

  async function loadCourseList() {
    var list = document.getElementById("adminCourseList");
    if (!list) return;
    list.innerHTML = '<p class="admin-muted">Loading…</p>';
    try {
      var r = await fetch("/api/courses");
      var courses = await r.json();
      if (!courses.length) {
        list.innerHTML = "<p>No courses.</p>";
        return;
      }
      list.innerHTML = courses
        .slice(0, 80)
        .map(function (c) {
          return (
            '<div class="admin-course-row"><div><strong>' +
            esc(c.title) +
            "</strong><br/><span class=\"admin-muted\">" +
            esc(c.type) +
            " · " +
            esc(c.category) +
            '</span></div><button type="button" class="btn-card-danger btn-del-course" data-id="' +
            esc(c.id) +
            '">Delete</button></div>'
          );
        })
        .join("");
    } catch {
      list.innerHTML = "<p>Failed to load courses.</p>";
    }
  }

  document.getElementById("btnClearAllCourses")?.addEventListener("click", async function () {
    if (!confirm("Delete ALL courses from the catalog? This cannot be undone.")) return;
    var purgeHeaders = Object.assign({}, authHeaders(), { "X-Researchium-Confirm": "purge-all-courses" });
    var r0 = await fetch("/api/courses", { method: "DELETE", headers: purgeHeaders });
    var r = await handleAuthResponse(r0);
    if (!r || !r.ok) {
      showToast("Could not clear catalog.", true);
      return;
    }
    showToast("All courses removed.");
    loadCourseList();
  });

  document.getElementById("adminCourseList")?.addEventListener("click", async function (e) {
    var b = e.target.closest(".btn-del-course");
    if (!b) return;
    var id = b.getAttribute("data-id");
    if (!id || !confirm("Delete this course?")) return;
    var r0 = await fetch("/api/courses/" + encodeURIComponent(id), { method: "DELETE", headers: authHeaders() });
    var r = await handleAuthResponse(r0);
    if (!r || !r.ok) return;
    showToast("Course deleted.");
    loadCourseList();
  });

  var cachedSite = null;

  async function loadLiveYtForm() {
    try {
      var r = await fetch("/api/site");
      cachedSite = await r.json();
      var pl = cachedSite.youtubePlaylist || {};
      document.getElementById("ytHeading").value = pl.heading || "";
      document.getElementById("ytSub").value = pl.subheading || "";
      document.getElementById("ytVideosJson").value = JSON.stringify(pl.videos || [], null, 2);
      renderScheduleEditor(cachedSite.liveSchedule || []);
    } catch {
      showToast("Could not load site content.", true);
    }
  }

  function renderScheduleEditor(rows) {
    var host = document.getElementById("scheduleEditor");
    if (!host) return;
    host.innerHTML = (rows.length ? rows : [{ time: "", title: "", meta: "", linkHref: "/", linkLabel: "Join" }])
      .map(function (row, i) {
        return (
          '<div class="schedule-edit-row" data-i="' +
          i +
          '"><label>Time</label><input class="admin-input sch-time" value="' +
          attrEsc(row.time) +
          '" /><label>Title</label><input class="admin-input sch-title" value="' +
          attrEsc(row.title) +
          '" /><label>Meta</label><input class="admin-input sch-meta" value="' +
          attrEsc(row.meta) +
          '" /><label>Link</label><input class="admin-input sch-href" value="' +
          attrEsc(row.linkHref) +
          '" /><label>Button</label><input class="admin-input sch-label" value="' +
          attrEsc(row.linkLabel) +
          '" /></div>'
        );
      })
      .join("");
  }

  document.getElementById("btnAddSchedule")?.addEventListener("click", function () {
    var host = document.getElementById("scheduleEditor");
    var div = document.createElement("div");
    div.className = "schedule-edit-row";
    div.innerHTML =
      '<label>Time</label><input class="admin-input sch-time" /><label>Title</label><input class="admin-input sch-title" /><label>Meta</label><input class="admin-input sch-meta" /><label>Link</label><input class="admin-input sch-href" value="/" /><label>Button</label><input class="admin-input sch-label" value="Join" />';
    host.appendChild(div);
  });

  function gatherSchedule() {
    var prev = cachedSite && Array.isArray(cachedSite.liveSchedule) ? cachedSite.liveSchedule : [];
    return [...document.querySelectorAll("#scheduleEditor .schedule-edit-row")].map(function (row, i) {
      var base = prev[i] && typeof prev[i] === "object" ? prev[i] : {};
      return Object.assign({}, base, {
        time: row.querySelector(".sch-time")?.value?.trim() || "",
        title: row.querySelector(".sch-title")?.value?.trim() || "",
        meta: row.querySelector(".sch-meta")?.value?.trim() || "",
        linkHref: row.querySelector(".sch-href")?.value?.trim() || "/",
        linkLabel: row.querySelector(".sch-label")?.value?.trim() || "Open"
      });
    });
  }

  document.getElementById("btnSaveLiveYt")?.addEventListener("click", async function () {
    var videos;
    try {
      videos = JSON.parse(document.getElementById("ytVideosJson").value);
      if (!Array.isArray(videos)) throw new Error();
    } catch {
      showToast("Videos JSON must be an array.", true);
      return;
    }
    var prevPl =
      cachedSite && cachedSite.youtubePlaylist && typeof cachedSite.youtubePlaylist === "object"
        ? cachedSite.youtubePlaylist
        : {};
    var body = {
      youtubePlaylist: Object.assign({}, prevPl, {
        heading: document.getElementById("ytHeading").value.trim(),
        subheading: document.getElementById("ytSub").value.trim(),
        videos
      }),
      liveSchedule: gatherSchedule()
    };
    var r0 = await fetch("/api/site", { method: "PUT", headers: authHeaders(true), body: JSON.stringify(body) });
    var r = await handleAuthResponse(r0);
    if (!r || !r.ok) {
      showToast("Save failed.", true);
      return;
    }
    cachedSite = await r.json();
    showToast("Live & YouTube saved.");
  });

  function renderPageCopyEditor() {
    var host = document.getElementById("pageCopyEditor");
    if (!host) return;
    fetch("/api/site")
      .then(function (r) {
        return r.json();
      })
      .then(function (site) {
        cachedSite = site;
        var pc = site.pageCopy || {};
        host.innerHTML = PAGE_KEYS.map(function (key) {
          var label = PAGE_LABELS[key] || key;
          return (
            '<div class="admin-card page-copy-block" data-page-key="' +
            esc(key) +
            '"><h3>' +
            esc(label) +
            '</h3><label class="admin-label">Section tag</label><textarea class="admin-textarea admin-page-sec" rows="1"></textarea>' +
            '<label class="admin-label">Title HTML</label><textarea class="admin-textarea admin-page-title" rows="2"></textarea>' +
            '<label class="admin-label">Lead HTML</label><textarea class="admin-textarea admin-page-lead" rows="3"></textarea></div>'
          );
        }).join("");
        host.querySelectorAll(".page-copy-block").forEach(function (block) {
          var key = block.getAttribute("data-page-key");
          var p = (key && pc[key]) || {};
          var s = block.querySelector(".admin-page-sec");
          var t = block.querySelector(".admin-page-title");
          var l = block.querySelector(".admin-page-lead");
          if (s) s.value = p.secTag || "";
          if (t) t.value = p.titleHtml || "";
          if (l) l.value = p.leadHtml || "";
        });
      })
      .catch(function () {
        host.innerHTML = "<p>Could not load page copy.</p>";
      });
  }

  document.getElementById("btnSavePages")?.addEventListener("click", async function () {
    var pageCopy = {};
    var pcBase = (cachedSite && cachedSite.pageCopy) || {};
    document.querySelectorAll(".page-copy-block").forEach(function (block) {
      var key = block.getAttribute("data-page-key");
      if (!key) return;
      var basePc = (pcBase[key] && typeof pcBase[key] === "object" ? pcBase[key] : {}) || {};
      pageCopy[key] = Object.assign({}, basePc, {
        secTag: block.querySelector(".admin-page-sec")?.value ?? "",
        titleHtml: block.querySelector(".admin-page-title")?.value ?? "",
        leadHtml: block.querySelector(".admin-page-lead")?.value ?? ""
      });
    });
    var r0 = await fetch("/api/site", { method: "PUT", headers: authHeaders(true), body: JSON.stringify({ pageCopy }) });
    var r = await handleAuthResponse(r0);
    if (!r || !r.ok) {
      showToast("Save failed.", true);
      return;
    }
    cachedSite = await r.json();
    showToast("Page copy saved.");
  });

  function clearNewsForm() {
    document.getElementById("newsEditId").value = "";
    document.getElementById("newsFieldTitle").value = "";
    document.getElementById("newsFieldContent").value = "";
    document.getElementById("newsFieldStatus").value = "current";
  }

  function clearMaterialForm() {
    document.getElementById("materialEditId").value = "";
    document.getElementById("materialFieldTitle").value = "";
    document.getElementById("materialFieldUrl").value = "";
  }

  async function loadNewsTable() {
    var wrap = document.getElementById("newsTableWrap");
    if (!wrap) return;
    wrap.innerHTML = '<p class="admin-muted">Loading…</p>';
    try {
      var r = await fetch("/api/news");
      var items = await r.json();
      if (!items.length) {
        wrap.innerHTML = "<p>No news items yet.</p>";
        return;
      }
      var rows = items
        .map(function (n) {
          return (
            "<tr><td>" +
            esc(n.status) +
            "</td><td>" +
            esc(n.title) +
            "</td><td>" +
            esc((n.content || "").slice(0, 60)) +
            "…</td><td class=\"admin-td-actions\"><button type=\"button\" class=\"btn-card-ghost btn-edit-news\" data-id=\"" +
            esc(n.id) +
            "\">Edit</button> <button type=\"button\" class=\"btn-card-danger btn-del-news\" data-id=\"" +
            esc(n.id) +
            "\">Delete</button></td></tr>"
          );
        })
        .join("");
      wrap.innerHTML =
        '<table class="admin-table"><thead><tr><th>Status</th><th>Title</th><th>Preview</th><th></th></tr></thead><tbody>' +
        rows +
        "</tbody></table>";
    } catch {
      wrap.innerHTML = "<p>Failed to load news.</p>";
    }
  }

  async function loadMaterialsTable() {
    var wrap = document.getElementById("materialsTableWrap");
    if (!wrap) return;
    wrap.innerHTML = '<p class="admin-muted">Loading…</p>';
    try {
      var r = await fetch("/api/materials");
      var items = await r.json();
      if (!items.length) {
        wrap.innerHTML = "<p>No materials yet.</p>";
        return;
      }
      var rows = items
        .map(function (m) {
          return (
            "<tr><td>" +
            esc(m.title) +
            "</td><td>" +
            esc(m.fileUrl) +
            '</td><td class="admin-td-actions"><button type="button" class="btn-card-ghost btn-edit-material" data-id="' +
            esc(m.id) +
            '">Edit</button> <button type="button" class="btn-card-danger btn-del-material" data-id="' +
            esc(m.id) +
            '">Delete</button></td></tr>'
          );
        })
        .join("");
      wrap.innerHTML =
        '<table class="admin-table"><thead><tr><th>Title</th><th>URL</th><th></th></tr></thead><tbody>' +
        rows +
        "</tbody></table>";
    } catch {
      wrap.innerHTML = "<p>Failed to load materials.</p>";
    }
  }

  document.getElementById("btnNewNews")?.addEventListener("click", clearNewsForm);
  document.getElementById("btnCancelNews")?.addEventListener("click", clearNewsForm);
  document.getElementById("btnNewMaterial")?.addEventListener("click", clearMaterialForm);
  document.getElementById("btnCancelMaterial")?.addEventListener("click", clearMaterialForm);

  document.getElementById("newsAdminForm")?.addEventListener("submit", async function (e) {
    e.preventDefault();
    var id = document.getElementById("newsEditId").value;
    var body = {
      title: document.getElementById("newsFieldTitle").value.trim(),
      content: document.getElementById("newsFieldContent").value.trim(),
      status: document.getElementById("newsFieldStatus").value
    };
    var url = id ? "/api/news/" + encodeURIComponent(id) : "/api/news";
    var method = id ? "PUT" : "POST";
    var r0 = await fetch(url, { method: method, headers: authHeaders(true), body: JSON.stringify(body) });
    var r = await handleAuthResponse(r0);
    if (!r || !r.ok) {
      showToast("Could not save news.", true);
      return;
    }
    clearNewsForm();
    showToast("News saved.");
    loadNewsTable();
  });

  document.getElementById("materialAdminForm")?.addEventListener("submit", async function (e) {
    e.preventDefault();
    var id = document.getElementById("materialEditId").value;
    var body = {
      title: document.getElementById("materialFieldTitle").value.trim(),
      fileUrl: document.getElementById("materialFieldUrl").value.trim()
    };
    var url = id ? "/api/materials/" + encodeURIComponent(id) : "/api/materials";
    var method = id ? "PUT" : "POST";
    var r0 = await fetch(url, { method: method, headers: authHeaders(true), body: JSON.stringify(body) });
    var r = await handleAuthResponse(r0);
    if (!r || !r.ok) {
      showToast("Could not save material.", true);
      return;
    }
    clearMaterialForm();
    showToast("Material saved.");
    loadMaterialsTable();
  });

  document.getElementById("newsTableWrap")?.addEventListener("click", async function (e) {
    var del = e.target.closest(".btn-del-news");
    var ed = e.target.closest(".btn-edit-news");
    if (del) {
      var id = del.getAttribute("data-id");
      if (!id || !confirm("Delete this news item?")) return;
      var r = await handleAuthResponse(
        await fetch("/api/news/" + encodeURIComponent(id), { method: "DELETE", headers: authHeaders() })
      );
      if (!r || !r.ok) return;
      showToast("News deleted.");
      loadNewsTable();
    } else if (ed) {
      var nid = ed.getAttribute("data-id");
      fetch("/api/news/" + encodeURIComponent(nid))
        .then(function (r) {
          return r.json();
        })
        .then(function (n) {
          document.getElementById("newsEditId").value = n.id || "";
          document.getElementById("newsFieldTitle").value = n.title || "";
          document.getElementById("newsFieldContent").value = n.content || "";
          document.getElementById("newsFieldStatus").value = n.status || "current";
        })
        .catch(function () {
          showToast("Could not load news item.", true);
        });
    }
  });

  document.getElementById("materialsTableWrap")?.addEventListener("click", async function (e) {
    var del = e.target.closest(".btn-del-material");
    var ed = e.target.closest(".btn-edit-material");
    if (del) {
      var id = del.getAttribute("data-id");
      if (!id || !confirm("Delete this material?")) return;
      var r = await handleAuthResponse(
        await fetch("/api/materials/" + encodeURIComponent(id), { method: "DELETE", headers: authHeaders() })
      );
      if (!r || !r.ok) return;
      showToast("Material deleted.");
      loadMaterialsTable();
    } else if (ed) {
      var mid = ed.getAttribute("data-id");
      fetch("/api/materials")
        .then(function (r) {
          return r.json();
        })
        .then(function (list) {
          var m = list.find(function (x) {
            return x.id === mid;
          });
          if (!m) return;
          document.getElementById("materialEditId").value = m.id || "";
          document.getElementById("materialFieldTitle").value = m.title || "";
          document.getElementById("materialFieldUrl").value = m.fileUrl || "";
        });
    }
  });

  async function loadLeadsTables() {
    var csirWrap = document.getElementById("csirLeadsTableWrap");
    var memberWrap = document.getElementById("memberInterestTableWrap");
    if (!csirWrap && !memberWrap) return;
    if (csirWrap) csirWrap.innerHTML = '<p class="admin-muted">Loading…</p>';
    if (memberWrap) memberWrap.innerHTML = '<p class="admin-muted">Loading…</p>';
    try {
      if (csirWrap) {
        var r1 = await handleAuthResponse(
          await fetch("/api/admin/csir-leads", { headers: authHeaders() })
        );
        if (!r1 || !r1.ok) {
          csirWrap.innerHTML = "<p>Could not load CSIR leads.</p>";
        } else {
          var leads = await r1.json();
          if (!leads.length) {
            csirWrap.innerHTML = "<p>No CSIR leads yet.</p>";
          } else {
            var rows1 = leads
              .map(function (l) {
                return (
                  "<tr><td>" +
                  esc(l.type || "—") +
                  "</td><td>" +
                  esc(l.name) +
                  "</td><td>" +
                  esc(l.email) +
                  "</td><td>" +
                  esc(l.phone || "—") +
                  "</td><td>" +
                  esc(l.subject || l.plan || "—") +
                  "</td><td>" +
                  esc(l.message ? String(l.message).slice(0, 80) + (l.message.length > 80 ? "…" : "") : "—") +
                  "</td><td>" +
                  esc(l.createdAt) +
                  "</td></tr>"
                );
              })
              .join("");
            csirWrap.innerHTML =
              '<table class="admin-table"><thead><tr><th>Type</th><th>Name</th><th>Email</th><th>Mobile</th><th>Subject</th><th>Message</th><th>Created</th></tr></thead><tbody>' +
              rows1 +
              "</tbody></table>";
          }
        }
      }
      if (memberWrap) {
        var r2 = await handleAuthResponse(
          await fetch("/api/admin/member-interest", { headers: authHeaders() })
        );
        if (!r2 || !r2.ok) {
          memberWrap.innerHTML = "<p>Could not load member interest.</p>";
        } else {
          var interest = await r2.json();
          if (!interest.length) {
            memberWrap.innerHTML = "<p>No sign-in interest emails yet.</p>";
          } else {
            var rows2 = interest
              .map(function (row) {
                return (
                  "<tr><td>" +
                  esc(row.email) +
                  "</td><td>" +
                  esc(row.source) +
                  "</td><td>" +
                  esc(row.createdAt) +
                  "</td></tr>"
                );
              })
              .join("");
            memberWrap.innerHTML =
              '<table class="admin-table"><thead><tr><th>Email</th><th>Source</th><th>Created</th></tr></thead><tbody>' +
              rows2 +
              "</tbody></table>";
          }
        }
      }
    } catch {
      if (csirWrap) csirWrap.innerHTML = "<p>Failed to load leads.</p>";
      if (memberWrap) memberWrap.innerHTML = "<p>Failed to load interest.</p>";
    }
  }

  async function bootAdmin() {
    var t = getToken();
    if (!t) {
      showLogin();
      return;
    }
    try {
      var r = await fetch("/api/admin/session", { headers: { Authorization: "Bearer " + t } });
      if (r.ok) {
        showDash();
        return;
      }
    } catch (_) {
      /* offline or wrong origin */
    }
    setToken("");
    showLogin();
  }

  bootAdmin();
})();

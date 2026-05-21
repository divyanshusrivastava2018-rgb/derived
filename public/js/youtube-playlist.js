(function () {
  var root = document.getElementById("yt-playlist-root");
  if (!root) return;

  function thumbUrl(id) {
    return "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg";
  }

  function watchUrl(id) {
    return "https://www.youtube.com/watch?v=" + encodeURIComponent(id);
  }

  function embedUrl(id) {
    return "https://www.youtube.com/embed/" + encodeURIComponent(id) + "?rel=0&modestbranding=1";
  }

  function formatViews(n) {
    if (n == null || n === "" || Number.isNaN(Number(n))) return null;
    var v = Number(n);
    if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M views";
    if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K views";
    return v.toLocaleString() + " views";
  }

  function normalizeVideoId(raw) {
    if (raw == null) return null;
    var s = String(raw).trim();
    var m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    return null;
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  async function fetchOembed(id) {
    try {
      var r = await fetch("/api/youtube/oembed?v=" + encodeURIComponent(id));
      if (!r.ok) return null;
      return r.json();
    } catch (_) {
      return null;
    }
  }

  root.innerHTML =
    '<p class="yt-pl-loading">Loading playlist…</p>';

  function loadPlaylistData() {
    var sitePromise =
      window.ResearchiumSiteData && window.ResearchiumSiteData.fetchSite
        ? window.ResearchiumSiteData.fetchSite()
        : fetch("/api/site").then(function (r) {
            if (!r.ok) throw new Error("api");
            return r.json();
          });
    return sitePromise.then(function (site) {
        var pl = site && site.youtubePlaylist ? site.youtubePlaylist : null;
        if (!pl || !Array.isArray(pl.videos)) throw new Error("shape");
        return pl;
      })
      .catch(function () {
        return fetch("/data/youtube-playlist.json").then(function (r) {
          if (!r.ok) throw new Error("static");
          return r.json();
        });
      });
  }

  loadPlaylistData().then(async function (data) {
      var heading = data.heading || "YouTube playlist";
      var sub = data.subheading || "";
      var playlistUrl = typeof data.playlistUrl === "string" ? data.playlistUrl.trim() : "";
      var channelUrl = typeof data.channelUrl === "string" ? data.channelUrl.trim() : "";
      var rawList = Array.isArray(data.videos) ? data.videos : [];
      var videos = [];
      rawList.forEach(function (v) {
        if (!v || typeof v !== "object") return;
        var nid = normalizeVideoId(v.id);
        if (!nid) return;
        videos.push(Object.assign({}, v, { id: nid }));
      });

      var oembeds = await Promise.all(videos.map(function (v) {
        return fetchOembed(v.id);
      }));

      videos.forEach(function (v, i) {
        var oe = oembeds[i];
        if (oe && oe.title) v.resolvedTitle = oe.title;
        else if (v.title) v.resolvedTitle = v.title;
        else v.resolvedTitle = "YouTube video";
        if (oe && oe.thumbnail_url) v.resolvedThumb = oe.thumbnail_url;
        else v.resolvedThumb = thumbUrl(v.id);
        if (oe && oe.author_name) v.resolvedAuthor = oe.author_name;
      });

      root.innerHTML = "";

      var head = el("div", "yt-pl-head");
      var h2 = el("h2", null, heading);
      h2.id = "yt-playlist-heading";
      head.appendChild(h2);
      if (sub) {
        var p = el("p", "yt-pl-sub", sub);
        head.appendChild(p);
      }
      if (playlistUrl || channelUrl) {
        var links = el("p", "yt-pl-sub");
        function appendLink(href, text) {
          if (!href) return;
          var a = document.createElement("a");
          a.href = href;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = text;
          if (links.childNodes.length > 0) {
            links.appendChild(document.createTextNode(" · "));
          }
          links.appendChild(a);
        }
        appendLink(playlistUrl, "Open full playlist on YouTube");
        appendLink(channelUrl, "Visit YouTube channel");
        head.appendChild(links);
      }
      root.appendChild(head);

      var bar = el("div", "yt-pl-toolbar");
      bar.innerHTML =
        '<label class="yt-pl-sort-label" for="yt-pl-sort">Arrange</label>' +
        '<select id="yt-pl-sort" class="yt-pl-sort" aria-label="Sort videos">' +
        '<option value="seq">Playlist order (recommended)</option>' +
        '<option value="views">Most viewed first</option>' +
        "</select>" +
        '<span class="yt-pl-hint">Tip: set optional <code>views</code> per video in <strong>Admin → Live &amp; YouTube</strong> (stored in <code>server/data/site-content.json</code>) to sort by popularity.</span>';
      root.appendChild(bar);
      var sortSel = bar.querySelector("#yt-pl-sort");

      var hub = el("div", "yt-pl-hub");
      var stageWrap = el("div", "yt-pl-stage-wrap");
      var ratio = el("div", "yt-pl-ratio");
      var iframe = document.createElement("iframe");
      iframe.className = "yt-pl-iframe";
      iframe.setAttribute("title", "YouTube video player");
      iframe.setAttribute("allowfullscreen", "");
      iframe.setAttribute(
        "allow",
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      );
      ratio.appendChild(iframe);
      stageWrap.appendChild(ratio);

      var nowPlaying = el("div", "yt-pl-now");
      stageWrap.appendChild(nowPlaying);

      var queue = el("div", "yt-pl-queue");
      queue.setAttribute("role", "list");
      queue.setAttribute("aria-label", "Video list");

      hub.appendChild(stageWrap);
      hub.appendChild(queue);
      root.appendChild(hub);

      var order = videos.map(function (_, i) {
        return i;
      });

      function sortOrder(mode) {
        var idx = videos.map(function (_, i) {
          return i;
        });
        if (mode === "views") {
          idx.sort(function (a, b) {
            var va = videos[a].views;
            var vb = videos[b].views;
            var na = va == null || va === "" ? -1 : Number(va);
            var nb = vb == null || vb === "" ? -1 : Number(vb);
            if (nb !== na) return nb - na;
            return (videos[a].seq || a + 1) - (videos[b].seq || b + 1);
          });
        } else {
          idx.sort(function (a, b) {
            return (videos[a].seq || a + 1) - (videos[b].seq || b + 1);
          });
        }
        order = idx;
        renderQueue();
      }

      var active = 0;

      function setActive(globalIndex) {
        active = globalIndex;
        var v = videos[globalIndex];
        iframe.src = embedUrl(v.id);
        nowPlaying.innerHTML =
          '<div class="yt-pl-now-tag">Now playing</div>' +
          "<h3>" +
          escapeHtml(v.resolvedTitle) +
          "</h3>" +
          (v.resolvedAuthor
            ? '<p class="yt-pl-channel">' + escapeHtml(v.resolvedAuthor) + "</p>"
            : "") +
          '<a class="yt-pl-open-yt" href="' +
          watchUrl(v.id) +
          '" target="_blank" rel="noopener noreferrer">Open on YouTube for full details &amp; live stats →</a>';
        renderQueue();
      }

      function escapeHtml(s) {
        var d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
      }

      function renderQueue() {
        queue.innerHTML = "";
        order.forEach(function (globalIdx, pos) {
          var v = videos[globalIdx];
          var item = el("button", "yt-pl-item" + (globalIdx === active ? " is-active" : ""));
          item.type = "button";
          item.setAttribute("role", "listitem");

          var idxBadge = el("span", "yt-pl-idx", String(pos + 1));

          var thumb = el("span", "yt-pl-thumb");
          thumb.style.backgroundImage = "url(" + JSON.stringify(v.resolvedThumb) + ")";

          var body = el("span", "yt-pl-item-body");
          var t = el("span", "yt-pl-item-title", escapeHtml(v.resolvedTitle));
          var meta = el("span", "yt-pl-item-meta");
          var vw = formatViews(v.views);
          meta.appendChild(el("span", "yt-pl-views", vw || "Views on YouTube"));
          if (v.note) {
            meta.appendChild(el("span", "yt-pl-note", " · " + escapeHtml(v.note)));
          }
          body.appendChild(t);
          body.appendChild(meta);

          item.appendChild(idxBadge);
          item.appendChild(thumb);
          item.appendChild(body);

          item.addEventListener("click", function () {
            setActive(globalIdx);
          });

          queue.appendChild(item);
        });
      }

      sortSel.addEventListener("change", function () {
        sortOrder(sortSel.value);
      });

      if (videos.length === 0) {
        hub.innerHTML =
          rawList.length > 0
            ? '<p class="yt-pl-empty">No valid YouTube video IDs in the list. Each entry needs an 11-character id or a normal watch/embed URL in <code>id</code>.</p>'
            : '<p class="yt-pl-empty">No videos yet. Add them in <strong>Admin → Live &amp; YouTube</strong>.</p>';
        return;
      }

      sortOrder(sortSel.value);
      var first = order[0];
      setActive(first);
    })
    .catch(function () {
      root.innerHTML =
        '<p class="yt-pl-error">Could not load the playlist. Start the server and open the site from it, or check <code>server/data/site-content.json</code>.</p>';
    });
})();

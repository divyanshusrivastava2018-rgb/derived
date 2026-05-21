(function () {
  var root = document.getElementById("jee-neet-grid");
  if (!root) return;

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = String(s == null ? "" : s);
    return d.innerHTML;
  }

  function thumb(id) {
    return "https://i.ytimg.com/vi/" + encodeURIComponent(id) + "/mqdefault.jpg";
  }

  function watch(id) {
    return "https://www.youtube.com/watch?v=" + encodeURIComponent(id);
  }

  function normalizeVideoId(raw) {
    if (raw == null) return null;
    var s = String(raw).trim();
    var m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    return null;
  }

  var loadSite =
    window.ResearchiumSiteData && window.ResearchiumSiteData.fetchSite
      ? window.ResearchiumSiteData.fetchSite()
      : fetch("/api/site").then(function (r) {
          if (!r.ok) throw new Error("api");
          return r.json();
        });

  loadSite.then(function (site) {
      var pl = site && site.youtubePlaylist ? site.youtubePlaylist : null;
      var raw = pl && Array.isArray(pl.videos) ? pl.videos : [];
      var videos = [];
      raw.forEach(function (v) {
        if (!v || typeof v !== "object") return;
        var id = normalizeVideoId(v.id);
        if (!id) return;
        videos.push({
          id: id,
          title: (v.note || v.title || "JEE / NEET YouTube lesson").trim()
        });
      });
      if (!videos.length) {
        root.innerHTML = '<p class="yt-pl-empty">No playlist videos found yet.</p>';
        return;
      }
      root.innerHTML = videos
        .slice(0, 8)
        .map(function (v) {
          return (
            '<a class="jee-neet-card" href="' +
            watch(v.id) +
            '" target="_blank" rel="noopener noreferrer">' +
            '<img class="jee-neet-thumb" src="' +
            thumb(v.id) +
            '" alt="' +
            esc(v.title) +
            '" loading="lazy"/>' +
            '<span class="jee-neet-body"><span class="jee-neet-title">' +
            esc(v.title) +
            "</span></span></a>"
          );
        })
        .join("");
    })
    .catch(function () {
      root.innerHTML = '<p class="yt-pl-error">Could not load JEE / NEET videos right now.</p>';
    });
})();

/**
 * Cached /api/site fetch — one request per tab session (sessionStorage, 5 min TTL).
 */
(function () {
  var KEY = "researchium_site_cache_v1";
  var TTL_MS = 5 * 60 * 1000;
  var inflight = null;

  function readCache() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.at || Date.now() - o.at > TTL_MS) return null;
      return o.data;
    } catch {
      return null;
    }
  }

  function writeCache(data) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data: data }));
    } catch {
      /* quota / private mode */
    }
  }

  function fetchSite() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);
    if (inflight) return inflight;
    var req =
      window.ResearchiumApi && window.ResearchiumApi.get
        ? window.ResearchiumApi.get("/api/site")
        : fetch("/api/site").then(function (r) {
            if (!r.ok) throw new Error("site");
            return r.json();
          });
    inflight = req.then(function (data) {
        writeCache(data);
        inflight = null;
        return data;
      })
      .catch(function (e) {
        inflight = null;
        throw e;
      });
    return inflight;
  }

  window.ResearchiumSiteData = {
    fetchSite: fetchSite,
    invalidate: function () {
      try {
        sessionStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      inflight = null;
    }
  };
})();

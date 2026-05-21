/**
 * Central API access — same-origin when served by Express (npm start).
 * Optional: <meta name="researchium-api-base" content="https://your-api.example.com">
 * Static hosting falls back to /data/offline-*.json for read-only GETs.
 */
(function () {
  var meta = document.querySelector('meta[name="researchium-api-base"]');
  var configured = (meta && meta.getAttribute("content")) || window.RESEARCHIUM_API_BASE || "";
  var API_BASE = String(configured).replace(/\/$/, "");

  function apiUrl(path) {
    var p = path.charAt(0) === "/" ? path : "/" + path;
    return API_BASE + p;
  }

  function isGet(opts) {
    return !opts || !opts.method || String(opts.method).toUpperCase() === "GET";
  }

  function offlinePath(apiPath) {
    if (apiPath.indexOf("/api/courses") === 0) return "/data/offline-courses.json";
    if (apiPath.indexOf("/api/site") === 0) return "/data/offline-site.json";
    if (apiPath.indexOf("/api/blog") === 0) return "/data/offline-blog.json";
    if (apiPath.indexOf("/api/news") === 0) return "/data/offline-news.json";
    if (apiPath.indexOf("/api/materials") === 0) return "/data/offline-materials.json";
    if (apiPath.indexOf("/api/mcq/mock-tests") === 0) return "/data/offline-mock-tests.json";
    if (apiPath.indexOf("/api/mcq/gate/papers") === 0) return "/data/offline-gate-papers.json";
    return null;
  }

  function fetchOffline(apiPath) {
    var rel = offlinePath(apiPath);
    if (!rel) return Promise.reject(new Error("No offline data"));
    return fetch(rel, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("Offline data missing");
      return r.json();
    }).then(function (data) {
      var courseMatch = apiPath.match(/^\/api\/courses\/([^/?#]+)$/);
      if (courseMatch && Array.isArray(data)) {
        var one = data.find(function (c) {
          return c && c.id === courseMatch[1];
        });
        if (!one) {
          var err = new Error("Course not found");
          err.status = 404;
          throw err;
        }
        return one;
      }
      return data;
    });
  }

  function fetchJson(path, opts) {
    var url = apiUrl(path);
    var options = Object.assign({ credentials: "same-origin", headers: {} }, opts || {});
    if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    return fetch(url, options).then(function (r) {
      return r.json().then(function (json) {
        if (!r.ok) {
          var err = new Error((json && json.error) || r.statusText || "Request failed");
          err.status = r.status;
          err.body = json;
          throw err;
        }
        return json;
      });
    });
  }

  var healthPromise = null;

  window.ResearchiumApi = {
    base: API_BASE,
    url: apiUrl,
    isOnline: null,

    checkHealth: function () {
      if (healthPromise) return healthPromise;
      healthPromise = fetch(apiUrl("/healthz"), { cache: "no-store", credentials: "same-origin" })
        .then(function (r) {
          window.ResearchiumApi.isOnline = r.ok;
          return r.ok;
        })
        .catch(function () {
          window.ResearchiumApi.isOnline = false;
          return false;
        });
      return healthPromise;
    },

    fetchJson: function (path, opts) {
      return fetchJson(path, opts).catch(function (err) {
        if (isGet(opts) && offlinePath(path)) {
          return fetchOffline(path);
        }
        throw err;
      });
    },

    get: function (path) {
      return window.ResearchiumApi.fetchJson(path, { method: "GET" });
    },

    post: function (path, body) {
      return window.ResearchiumApi.fetchJson(path, { method: "POST", body: body });
    }
  };
})();

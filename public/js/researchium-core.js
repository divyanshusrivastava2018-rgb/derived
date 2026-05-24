/**
 * Researchium client core — API client + cached site config (from scratch).
 * Error helpers: /js/researchium-errors.js (load before this file on GATE exam).
 */
(function () {
  "use strict";

  var Err = window.ResearchiumErrors || {};

  var meta = document.querySelector('meta[name="researchium-api-base"]');
  var configured = (meta && meta.getAttribute("content")) || window.RESEARCHIUM_API_BASE || "";
  var runtimeGateApiBase = "";

  function pickApiBase() {
    if (configured && String(configured).trim()) {
      return String(configured).trim().replace(/\/$/, "");
    }
    if (runtimeGateApiBase && String(runtimeGateApiBase).trim()) {
      return String(runtimeGateApiBase).trim().replace(/\/$/, "");
    }
    return "";
  }

  var API_BASE = "";

  function loadRuntimeConfig() {
    return fetch("/data/runtime-config.json", { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .catch(function () {
        return {};
      })
      .then(function (cfg) {
        runtimeGateApiBase = (cfg && cfg.gateApiBase) || "";
        API_BASE = pickApiBase();
        if (window.ResearchiumApi) {
          window.ResearchiumApi.base = API_BASE;
        }
      });
  }

  var configReady = loadRuntimeConfig();

  function fetchCredentials(url) {
    try {
      var target = new URL(url, window.location.href);
      if (target.origin === window.location.origin) return "same-origin";
    } catch {
      /* ignore */
    }
    return "omit";
  }

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
    if (apiPath.indexOf("/api/platform/overview") === 0) return "/data/offline-platform-overview.json";
    return null;
  }

  function fetchOffline(apiPath) {
    var rel = offlinePath(apiPath);
    if (!rel) return Promise.reject(new Error("No offline data"));
    return fetch(rel, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("Offline data missing");
        return r.json();
      })
      .then(function (data) {
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
    return configReady.then(function () {
      var url = apiUrl(path);
      var options = Object.assign({ credentials: fetchCredentials(url), headers: {} }, opts || {});
    if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    return fetch(url, options)
      .catch(function (networkErr) {
        var msg = Err.errorToMessage
          ? Err.errorToMessage(networkErr)
          : networkErr.message || "Network error";
        throw new Error(msg);
      })
      .then(function (r) {
        return r.text().then(function (text) {
          var json = null;
          if (text && text.trim().charAt(0) === "{") {
            try {
              json = JSON.parse(text);
            } catch (parseErr) {
              json = null;
            }
          }
          if (!r.ok) {
            var fail = Err.httpFailPayload
              ? Err.httpFailPayload(r.status, json)
              : { status: r.status, error: json && json.error, message: json && json.message };
            var err = new Error(
              Err.formatErrMessage ? Err.formatErrMessage(fail) : r.statusText || "Request failed"
            );
            err.status = r.status;
            err.body = json;
            throw err;
          }
          if (json != null) return json;
          if (text && text.trim().charAt(0) === "<") {
            throw new Error(
              "API returned HTML instead of JSON. Ensure the Node server is running and /api is proxied correctly."
            );
          }
          return text ? JSON.parse(text) : {};
        });
      });
    });
  }

  var healthPromise = null;

  window.ResearchiumApi = {
    base: API_BASE,
    ready: configReady,
    url: apiUrl,
    isOnline: null,

    checkHealth: function () {
      if (healthPromise) return healthPromise;
      healthPromise = configReady.then(function () {
        var url = apiUrl("/healthz");
        return fetch(url, { cache: "no-store", credentials: fetchCredentials(url) })
          .then(function (r) {
            window.ResearchiumApi.isOnline = r.ok;
            return r.ok;
          })
          .catch(function () {
            window.ResearchiumApi.isOnline = false;
            return false;
          });
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

  var SITE_KEY = "researchium_site_cache_v1";
  var SITE_TTL_MS = 5 * 60 * 1000;
  var siteInflight = null;

  function readSiteCache() {
    try {
      var raw = sessionStorage.getItem(SITE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.at || Date.now() - o.at > SITE_TTL_MS) return null;
      return o.data;
    } catch {
      return null;
    }
  }

  function writeSiteCache(data) {
    try {
      sessionStorage.setItem(SITE_KEY, JSON.stringify({ at: Date.now(), data: data }));
    } catch {
      /* quota / private mode */
    }
  }

  function fetchSite() {
    var cached = readSiteCache();
    if (cached) return Promise.resolve(cached);
    if (siteInflight) return siteInflight;
    siteInflight = window.ResearchiumApi.get("/api/site")
      .then(function (data) {
        writeSiteCache(data);
        siteInflight = null;
        return data;
      })
      .catch(function (e) {
        siteInflight = null;
        throw e;
      });
    return siteInflight;
  }

  window.ResearchiumSiteData = {
    fetchSite: fetchSite,
    invalidate: function () {
      try {
        sessionStorage.removeItem(SITE_KEY);
      } catch {
        /* ignore */
      }
      siteInflight = null;
    }
  };

  var LEARNER_KEY = "researchium_learner_id";

  function getLearnerId() {
    try {
      var id = localStorage.getItem(LEARNER_KEY);
      if (!id) {
        id =
          "lr_" +
          Math.random().toString(36).slice(2, 10) +
          Date.now().toString(36).slice(-6);
        localStorage.setItem(LEARNER_KEY, id);
      }
      return id;
    } catch {
      return "lr_anonymous";
    }
  }

  function recordProgress(payload) {
    var body = Object.assign({ learnerId: getLearnerId() }, payload || {});
    return fetch(apiUrl("/api/platform/progress"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).catch(function () {
      return null;
    });
  }

  window.ResearchiumProgress = {
    getLearnerId: getLearnerId,
    record: recordProgress
  };
})();

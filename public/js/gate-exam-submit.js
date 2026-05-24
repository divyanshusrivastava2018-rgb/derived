/**
 * GATE exam submit helper — health check, submit, session retry.
 * Requires researchium-errors.js; optional researchium-core.js for API base URL.
 */
(function () {
  "use strict";

  /** @type {string} API origin (e.g. https://app.onrender.com) or "" for same-origin relative /api */
  var gateApiOrigin = "";
  var gateApiResolved = false;
  var gateApiResolvePromise = null;

  function errMsg(err) {
    if (window.ResearchiumErrors && window.ResearchiumErrors.errorToMessage) {
      return window.ResearchiumErrors.errorToMessage(err);
    }
    if (err && typeof err.message === "string" && err.message !== "[object Object]") {
      return err.message;
    }
    return String(err);
  }

  function showErr(err, title) {
    if (window.ResearchiumErrors && window.ResearchiumErrors.showErrorModal) {
      window.ResearchiumErrors.showErrorModal(err, title || "Submission failed");
      return;
    }
    alert((title || "Error") + "\n\n" + errMsg(err));
  }

  function whenCoreReady() {
    if (window.ResearchiumApi && window.ResearchiumApi.ready) {
      return window.ResearchiumApi.ready;
    }
    return Promise.resolve();
  }

  function gateApiUrl(suffix) {
    var path = "/api/mcq/gate" + (suffix.charAt(0) === "/" ? suffix : "/" + suffix);
    var origin = String(gateApiOrigin || "").replace(/\/$/, "");
    return origin ? origin + path : path;
  }

  function fetchCredentials(url) {
    try {
      var target = new URL(url, window.location.href);
      if (target.origin === window.location.origin) return "same-origin";
    } catch {
      /* ignore */
    }
    return "omit";
  }

  function normalizeSubmitError(msg, status) {
    var lower = String(msg || "").toLowerCase();
    if (
      status === 404 ||
      lower.indexOf("page could not be found") >= 0 ||
      lower.indexOf("exam submit api was not found") >= 0 ||
      (lower.indexOf("not found") >= 0 &&
        lower.indexOf("paper not found") < 0 &&
        lower.indexOf("question not found") < 0)
    ) {
      var tried = gateApiOrigin || window.location.origin;
      return (
        "Exam scoring API is not available (404).\n\n" +
        "This site is serving HTML only — the Node server must run for submit/score.\n\n" +
        "• VPS: proxy /api to Node (see docs/nginx-gate-api.example.conf) and run npm start\n" +
        "• GitHub Pages: deploy API on Render (render.yaml), set GitHub secret GATE_API_BASE to that URL\n" +
        "• Local: npm start → http://localhost:3000/gate-exam.html\n\n" +
        "Last tried: " +
        tried
      );
    }
    return null;
  }

  function parseResponseBody(res, text) {
    var body = text == null ? "" : String(text).trim();
    if (!body) {
      if (res.status === 404) {
        throw new Error(normalizeSubmitError("", 404));
      }
      throw new Error("Server returned an empty response (status " + res.status + ").");
    }
    if (body.charAt(0) === "<") {
      if (res.status === 404) {
        throw new Error(normalizeSubmitError("The page could not be found", 404));
      }
      throw new Error(
        "API returned HTML instead of JSON. Ensure the Node server is running and /api is proxied correctly."
      );
    }
    try {
      return JSON.parse(body);
    } catch {
      if (res.status === 404) {
        throw new Error(normalizeSubmitError(body, 404));
      }
      throw new Error("Server returned an unexpected response (status " + res.status + ").");
    }
  }

  function apiFetch(url, options) {
    var opts = Object.assign(
      {
        credentials: fetchCredentials(url),
        headers: { Accept: "application/json", "Content-Type": "application/json" }
      },
      options || {}
    );
    if (opts.body && typeof opts.body === "object") {
      opts.body = JSON.stringify(opts.body);
    }

    return fetch(url, opts)
      .catch(function (netErr) {
        var msg = errMsg(netErr);
        if (!msg || msg === "[object Object]") {
          msg =
            "Cannot reach the exam server. Check your connection and that the Node server is running.";
        }
        throw new Error(msg);
      })
      .then(function (res) {
        return res.text().then(function (text) {
          var json = parseResponseBody(res, text);
          if (!res.ok) {
            var serverMsg =
              json && json.error != null
                ? errMsg(json.error)
                : json && json.message != null
                  ? errMsg(json.message)
                  : "";
            var friendly = normalizeSubmitError(serverMsg, res.status) || serverMsg;
            var err = new Error(friendly || "Request failed with status " + res.status + ".");
            err.status = res.status;
            throw err;
          }
          return json;
        });
      });
  }

  function probeHealthAtOrigin(origin) {
    var url = origin
      ? String(origin).replace(/\/$/, "") + "/api/mcq/gate/healthz"
      : "/api/mcq/gate/healthz";

    return fetch(url, {
      method: "GET",
      credentials: fetchCredentials(url),
      headers: { Accept: "application/json" }
    }).then(function (res) {
      return res.text().then(function (text) {
        if (!res.ok) return false;
        try {
          var data = JSON.parse(text);
          return data && data.ok === true;
        } catch {
          return false;
        }
      });
    }).catch(function () {
      return false;
    });
  }

  function uniqueOrigins(list) {
    var seen = {};
    var out = [];
    list.forEach(function (item) {
      var key = item == null ? "" : String(item);
      if (seen[key]) return;
      seen[key] = true;
      out.push(key);
    });
    return out;
  }

  function resolveGateApiOrigin() {
    if (gateApiResolved) return Promise.resolve(gateApiOrigin);
    if (gateApiResolvePromise) return gateApiResolvePromise;

    gateApiResolvePromise = whenCoreReady()
      .then(function () {
        var candidates = uniqueOrigins([
          "",
          window.ResearchiumApi && window.ResearchiumApi.base ? window.ResearchiumApi.base : ""
        ]);

        var chain = Promise.resolve(false);
        candidates.forEach(function (origin) {
          chain = chain.then(function (found) {
            if (found) return true;
            return probeHealthAtOrigin(origin).then(function (ok) {
              if (ok) {
                gateApiOrigin = origin;
                gateApiResolved = true;
                return true;
              }
              return false;
            });
          });
        });

        return chain.then(function (found) {
          if (!found) {
            throw new Error(normalizeSubmitError("", 404));
          }
          return gateApiOrigin;
        });
      })
      .finally(function () {
        gateApiResolvePromise = null;
      });

    return gateApiResolvePromise;
  }

  function checkApiHealth() {
    return resolveGateApiOrigin().then(function () {
      return apiFetch(gateApiUrl("/healthz"), { method: "GET" });
    });
  }

  function doSubmit(slug, sessionId, responses) {
    return apiFetch(gateApiUrl("/paper/" + encodeURIComponent(slug) + "/submit"), {
      method: "POST",
      body: { sessionId: sessionId || "", responses: responses || {} }
    });
  }

  function startNewSession(slug) {
    return apiFetch(gateApiUrl("/paper/" + encodeURIComponent(slug) + "/start"), {
      method: "POST",
      body: {}
    }).then(function (data) {
      if (!data.sessionId) throw new Error("Server did not return a session ID. Please try again.");
      return data.sessionId;
    });
  }

  function ensureSession(slug, sessionId) {
    var sid = String(sessionId || "").trim();
    if (sid) return Promise.resolve(sid);
    return startNewSession(slug);
  }

  function isRecoverableSubmitError(msg, status) {
    var m = String(msg || "").toLowerCase();
    if (status === 403 && (m.indexOf("session") >= 0 || m.indexOf("start the examination") >= 0)) {
      return true;
    }
    if (m.indexOf("session expired") >= 0 || m.indexOf("invalid session") >= 0) {
      return true;
    }
    if (m.indexOf("session") >= 0 && m.indexOf("required") >= 0) {
      return true;
    }
    return false;
  }

  /**
   * @param {{ slug: string, sessionId?: string, responses: object, onSuccess?: Function, onError?: Function, onLoading?: Function, onSessionId?: Function }} options
   */
  function submitExam(options) {
    var opts = options || {};
    var slug = String(opts.slug || "").trim();
    var sessionId = String(opts.sessionId || "").trim();
    var responses = opts.responses || {};
    var onSuccess = opts.onSuccess || function () {};
    var onError =
      opts.onError ||
      function (msg) {
        showErr(msg, "Submission failed");
      };
    var onLoading = opts.onLoading || function () {};
    var onSessionId = opts.onSessionId || function () {};

    if (!slug) {
      onError("No paper selected. Please refresh and try again.");
      return;
    }

    onLoading(true);

    resolveGateApiOrigin()
      .then(function () {
        return ensureSession(slug, sessionId);
      })
      .then(function (activeSessionId) {
        if (activeSessionId && activeSessionId !== sessionId) {
          onSessionId(activeSessionId);
        }
        return doSubmit(slug, activeSessionId, responses);
      })
      .then(function (result) {
        onLoading(false);
        onSuccess(result);
      })
      .catch(function (firstErr) {
        var msg = errMsg(firstErr);
        var status = firstErr && firstErr.status;

        if (isRecoverableSubmitError(msg, status)) {
          startNewSession(slug)
            .then(function (newSessionId) {
              onSessionId(newSessionId);
              return doSubmit(slug, newSessionId, responses);
            })
            .then(function (result) {
              onLoading(false);
              onSuccess(result);
            })
            .catch(function (retryErr) {
              onLoading(false);
              onError(errMsg(retryErr));
            });
          return;
        }

        onLoading(false);
        onError(msg);
      });
  }

  window.GateExamSubmit = {
    submitExam: submitExam,
    checkApiHealth: checkApiHealth,
    startNewSession: startNewSession,
    ensureSession: ensureSession,
    resolveGateApiOrigin: resolveGateApiOrigin
  };
})();

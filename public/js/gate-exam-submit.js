/**
 * GATE exam submit helper — health check, submit, session retry.
 * Requires researchium-errors.js; optional researchium-core.js for API base URL.
 */
(function () {
  "use strict";

  function apiBase() {
    if (window.ResearchiumApi && window.ResearchiumApi.url) {
      return window.ResearchiumApi.url("/api/mcq/gate");
    }
    return "/api/mcq/gate";
  }

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

  function normalizeSubmitError(msg, status) {
    var m = String(msg || "").trim();
    var lower = m.toLowerCase();
    if (
      status === 404 ||
      lower.indexOf("page could not be found") >= 0 ||
      lower.indexOf("exam submit api was not found") >= 0 ||
      (lower.indexOf("not found") >= 0 && lower.indexOf("paper not found") < 0 && lower.indexOf("question not found") < 0)
    ) {
      var apiHost = "";
      try {
        apiHost = new URL(apiBase() + "/healthz", window.location.origin).origin;
      } catch {
        apiHost = "the exam API host";
      }
      return (
        "Exam scoring is unavailable (404). The page loaded, but " +
        apiHost +
        " did not respond.\n\n" +
        "Use the live site at https://www.derived.co.in with the Node server running, " +
        "or run npm start locally and open http://localhost:3000/gate-exam.html"
      );
    }
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
        credentials: "same-origin",
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

  function checkApiHealth() {
    return new Promise(function (resolve, reject) {
      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (controller) controller.abort();
        reject(
          new Error(
            "The exam server did not respond in time. Check your connection or try refreshing the page."
          )
        );
      }, 8000);

      var opts = controller ? { signal: controller.signal, method: "GET" } : { method: "GET" };

      apiFetch(apiBase() + "/healthz", opts)
        .then(function (data) {
          clearTimeout(timer);
          if (!data || data.ok !== true) {
            reject(new Error("GATE exam API is not ready."));
            return;
          }
          resolve(data);
        })
        .catch(function (err) {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  function doSubmit(slug, sessionId, responses) {
    return apiFetch(apiBase() + "/paper/" + encodeURIComponent(slug) + "/submit", {
      method: "POST",
      body: { sessionId: sessionId || "", responses: responses || {} }
    });
  }

  function startNewSession(slug) {
    return apiFetch(apiBase() + "/paper/" + encodeURIComponent(slug) + "/start", {
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

    checkApiHealth()
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
    ensureSession: ensureSession
  };
})();

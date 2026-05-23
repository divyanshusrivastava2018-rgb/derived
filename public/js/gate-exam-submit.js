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
        return res
          .json()
          .catch(function () {
            if (res.status === 404) {
              throw new Error(
                "Exam submit API was not found (404). Make sure the Node server is running and nginx proxies /api to it."
              );
            }
            throw new Error("Server returned an unexpected response (status " + res.status + ").");
          })
          .then(function (json) {
            if (!res.ok) {
              var serverMsg =
                json && json.error != null
                  ? errMsg(json.error)
                  : json && json.message != null
                    ? errMsg(json.message)
                    : "";
              throw new Error(serverMsg || "Request failed with status " + res.status + ".");
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
      }, 5000);

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

  function isRecoverableSubmitError(msg) {
    var m = String(msg || "").toLowerCase();
    return (
      m.indexOf("not found") >= 0 ||
      m.indexOf("session") >= 0 ||
      m.indexOf("expired") >= 0 ||
      m.indexOf("404") >= 0
    );
  }

  /**
   * @param {{ slug: string, sessionId?: string, responses: object, onSuccess?: Function, onError?: Function, onLoading?: Function }} options
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

    if (!slug) {
      onError("No paper selected. Please refresh and try again.");
      return;
    }

    onLoading(true);

    checkApiHealth()
      .then(function () {
        return doSubmit(slug, sessionId, responses);
      })
      .then(function (result) {
        onLoading(false);
        onSuccess(result);
      })
      .catch(function (firstErr) {
        var msg = errMsg(firstErr);

        if (isRecoverableSubmitError(msg)) {
          startNewSession(slug)
            .then(function (newSessionId) {
              return doSubmit(slug, newSessionId, responses);
            })
            .then(function (result) {
              onLoading(false);
              onSuccess(result);
            })
            .catch(function (retryErr) {
              onLoading(false);
              var retryMsg = errMsg(retryErr);
              if (/not found|404/i.test(retryMsg)) {
                onError(
                  "The submit endpoint could not be found (404).\n\n" +
                    "This usually means the Node server is not running or nginx is not proxying /api to it."
                );
              } else {
                onError(retryMsg);
              }
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
    startNewSession: startNewSession
  };
})();

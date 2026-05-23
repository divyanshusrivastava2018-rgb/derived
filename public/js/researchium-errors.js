/**
 * Researchium — API / network error helpers (no [object Object] in UI).
 */
(function () {
  "use strict";

  function pickString(val) {
    if (val == null) return "";
    if (typeof val === "string") return val;
    if (typeof val === "object") return errorToMessage(val);
    return String(val);
  }

  function errorToMessage(err) {
    if (!err) return "An unknown error occurred. Please try again.";

    if (typeof err === "string") return err;

    if (err instanceof Error) {
      var em = err.message || err.toString();
      if (em && em !== "[object Object]") return em;
      if (err.body) return errorToMessage(err.body);
      return "An unexpected error occurred. Please try again.";
    }

    if (typeof err === "object") {
      var nested =
        pickString(err.message) ||
        pickString(err.error) ||
        pickString(err.detail) ||
        pickString(err.description);

      if (nested && nested !== "[object Object]") return nested;

      var status = err.status || err.statusCode;

      if (status) {
        switch (status) {
          case 400:
            return "Bad request. Please refresh and try again.";
          case 401:
            return "Session expired. Please start the exam again.";
          case 403:
            return "Access denied. You may not have permission for this action.";
          case 404:
            return "The page or resource could not be found (404).";
          case 408:
            return "The request timed out. Check your internet connection and retry.";
          case 429:
            return "Too many requests. Please wait a moment and try again.";
          case 500:
            return "Server error (500). Please try again in a few minutes.";
          case 502:
          case 503:
          case 504:
            return "Server temporarily unavailable (" + status + "). Please try again shortly.";
          default:
            return "Request failed with status " + status + ". Please try again.";
        }
      }

      if (err.name === "TypeError" || err.name === "NetworkError") {
        return "Network error. Please check your internet connection and try again.";
      }

      if (err.name === "AbortError") {
        return "The request was cancelled or timed out. Please try again.";
      }
    }

    try {
      var s = String(err);
      return s === "[object Object]" ? "An unexpected error occurred. Please try again." : s;
    } catch (ignore) {
      return "An unexpected error occurred. Please try again.";
    }
  }

  function formatErrMessage(err) {
    var msg = errorToMessage(err).trim();
    if (!msg) msg = "An unknown error occurred.";
    msg = msg.charAt(0).toUpperCase() + msg.slice(1);
    if (!/[.!?]$/.test(msg)) msg += ".";
    return msg;
  }

  function bindAlertClose(modal, okBtn) {
    function close() {
      modal.classList.add("gate-hidden");
      if (okBtn) okBtn.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape" || e.key === "Enter") close();
    }
    if (okBtn) {
      okBtn.addEventListener("click", close);
      okBtn.focus();
    }
    document.addEventListener("keydown", onKey);
  }

  function showErrorModal(err, title) {
    var message = formatErrMessage(err);
    title = title || "Error";

    var gateModal = document.getElementById("gateAlertModal");
    var gateTitle = document.getElementById("gateAlertTitle");
    var gateText = document.getElementById("gateAlertText");
    var gateOk = document.getElementById("btnAlertOk");

    if (gateModal && gateText) {
      if (gateTitle) gateTitle.textContent = title;
      gateText.textContent = message;
      gateModal.classList.remove("gate-hidden");
      bindAlertClose(gateModal, gateOk);
      return;
    }

    var modalOverlay =
      document.getElementById("noticeModal") ||
      document.getElementById("notice-modal") ||
      document.querySelector(".notice-modal") ||
      document.querySelector("[data-modal='notice']");
    var modalTitle =
      document.getElementById("noticeTitle") ||
      document.getElementById("notice-title") ||
      document.querySelector(".notice-title");
    var modalBody =
      document.getElementById("noticeBody") ||
      document.getElementById("notice-body") ||
      document.querySelector(".notice-body") ||
      document.querySelector(".modal-message");

    if (modalOverlay && modalBody) {
      if (modalTitle) modalTitle.textContent = title;
      modalBody.textContent = message;
      modalOverlay.style.display = "flex";
      modalOverlay.classList.add("active");
      return;
    }

    createFallbackModal(title, message);
  }

  function createFallbackModal(title, message) {
    var old = document.getElementById("__err_modal");
    if (old) old.remove();

    var overlay = document.createElement("div");
    overlay.id = "__err_modal";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:99999";

    var box = document.createElement("div");
    box.style.cssText =
      "background:#fff;border-radius:8px;padding:24px 28px;max-width:360px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.25);font-family:inherit";

    var h = document.createElement("p");
    h.style.cssText = "margin:0 0 6px;font-weight:700;font-size:15px;color:#6d28d9";
    h.textContent = title;

    var p = document.createElement("p");
    p.style.cssText = "margin:0 0 20px;font-size:14px;color:#333;line-height:1.5";
    p.textContent = message;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "OK";
    btn.style.cssText =
      "padding:8px 22px;background:#6d28d9;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px";

    btn.addEventListener("click", function () {
      overlay.remove();
    });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.remove();
    });

    box.appendChild(h);
    box.appendChild(p);
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    btn.focus();
  }

  function safeFetch(url, options) {
    return fetch(url, options)
      .catch(function (networkErr) {
        throw new Error(errorToMessage(networkErr));
      })
      .then(function (res) {
        if (res.ok) return res;
        return res
          .clone()
          .json()
          .catch(function () {
            return null;
          })
          .then(function (payload) {
            var fail = payload && typeof payload === "object" ? payload : {};
            fail.status = res.status;
            throw new Error(errorToMessage(fail));
          });
      });
  }

  function httpFailPayload(status, json) {
    var fail = { status: status };
    if (json && typeof json === "object") {
      if (json.error !== undefined) fail.error = json.error;
      if (json.message !== undefined) fail.message = json.message;
      if (json.detail !== undefined) fail.detail = json.detail;
    }
    return fail;
  }

  window.ResearchiumErrors = {
    errorToMessage: errorToMessage,
    formatErrMessage: formatErrMessage,
    showErrorModal: showErrorModal,
    safeFetch: safeFetch,
    httpFailPayload: httpFailPayload
  };
})();

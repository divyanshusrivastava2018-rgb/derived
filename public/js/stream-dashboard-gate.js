/**
 * Client-side gate for /stream-dashboard.html (practice / static hosting).
 * Password is checked via SHA-256 hash — not stored in plaintext in this file.
 */
(function (global) {
  const STORAGE_KEY = 'researchium_stream_dashboard_v1';
  const PASSWORD_HASH_HEX =
    '45d1bb46c089ce30466bb7940c959d637f5e8e3fbdf585c41ca4c3523544a2fd';
  const DASHBOARD_PATH = '/stream-dashboard.html';
  const RETURN_PATH = '/live-classes.html';

  function isAuthed() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch (_e) {
      return false;
    }
  }

  function setAuthed() {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch (_e) {
      /* ignore */
    }
  }

  async function sha256Hex(text) {
    if (!global.crypto || !global.crypto.subtle) {
      return null;
    }
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function checkPassword(password) {
    const hash = await sha256Hex(password);
    if (!hash) {
      return false;
    }
    return hash === PASSWORD_HASH_HEX;
  }

  async function promptForAccess() {
    const entered = global.prompt('Streamer dashboard — enter password:');
    if (entered === null) {
      return false;
    }
    if (await checkPassword(entered)) {
      setAuthed();
      return true;
    }
    global.alert('Incorrect password.');
    return false;
  }

  async function requireAuthOnLoad() {
    if (isAuthed()) {
      return;
    }
    const ok = await promptForAccess();
    if (!ok) {
      global.location.replace(RETURN_PATH);
    }
  }

  function bindLink(anchor) {
    if (!anchor) {
      return;
    }
    anchor.addEventListener('click', async function (event) {
      event.preventDefault();
      if (isAuthed()) {
        global.location.href = DASHBOARD_PATH;
        return;
      }
      if (await promptForAccess()) {
        global.location.href = DASHBOARD_PATH;
      }
    });
  }

  /** Run on stream-dashboard.html only (external script — works with CSP). */
  async function bootDashboardPage() {
    if (!document.body || document.body.id !== 'stream-dash-body') {
      return;
    }
    if (!isAuthed()) {
      const ok = await promptForAccess();
      if (!ok) {
        global.location.replace(RETURN_PATH);
      }
    }
  }

  global.StreamDashboardGate = {
    bindLink,
    isAuthed,
    requireAuthOnLoad,
    promptForAccess,
    bootDashboardPage
  };

  if (document.body && document.body.id === 'stream-dash-body') {
    bootDashboardPage();
  } else {
    document.addEventListener('DOMContentLoaded', bootDashboardPage);
  }
})(window);

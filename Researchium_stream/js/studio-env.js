/**
 * Shared API URL bootstrap and CSP helpers for stream studio pages.
 */
(function (global) {
  function isIntegrated() {
    return (global.location.pathname || '').startsWith('/stream-studio');
  }

  function isLocalDevHost() {
    const h = global.location.hostname;
    return h === '127.0.0.1' || h === 'localhost' || h === '';
  }

  function resolveMainAppOrigin() {
    const h = global.location.hostname;
    if (h === 'localhost') return 'http://localhost:3000';
    if (h === '127.0.0.1') return 'http://127.0.0.1:3000';
    if (global.location.protocol === 'file:') return 'http://localhost:3000';
    return global.location.origin || '';
  }

  function configure() {
    if (global.RESEARCHIUM_API_URL && global.RESEARCHIUM_STUDIO_URL) {
      return;
    }
    if (isIntegrated()) {
      global.RESEARCHIUM_API_URL =
        global.RESEARCHIUM_API_URL || `${global.location.origin}/stream-api`;
      global.RESEARCHIUM_STUDIO_URL =
        global.RESEARCHIUM_STUDIO_URL || `${global.location.origin}/stream-studio-backend`;
      return;
    }
    if (global.location.protocol === 'file:' || isLocalDevHost()) {
      const main = resolveMainAppOrigin();
      global.RESEARCHIUM_API_URL = global.RESEARCHIUM_API_URL || `${main}/stream-api`;
      global.RESEARCHIUM_STUDIO_URL =
        global.RESEARCHIUM_STUDIO_URL || `${main}/stream-studio-backend`;
    }
  }

  function buildConnectSrc() {
    const parts = ["'self'"];
    const origin = global.location.origin;
    if (origin && origin !== 'null') {
      parts.push(origin);
      if (origin.startsWith('https://')) {
        parts.push(origin.replace(/^https:/, 'wss:'));
      } else if (origin.startsWith('http://')) {
        parts.push(origin.replace(/^http:/, 'ws:'));
      }
    }
    if (isLocalDevHost() || global.location.protocol === 'file:') {
      const main = resolveMainAppOrigin();
      if (main) {
        parts.push(main);
        if (main.startsWith('https://')) {
          parts.push(main.replace(/^https:/, 'wss:'));
        } else if (main.startsWith('http://')) {
          parts.push(main.replace(/^http:/, 'ws:'));
        }
      }
    }
    return [...new Set(parts)].join(' ');
  }

  function buildCsp(options) {
    options = options || {};
    const extraScript = options.extraScriptSrc || [];
    const scriptSrc = ["'self'", ...extraScript].join(' ');
    return [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      'font-src https://fonts.gstatic.com',
      `connect-src ${buildConnectSrc()}`,
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
  }

  configure();

  /**
   * Try to open desktop streaming app (OBS). Requires OBS installed; browser may prompt.
   * Set localStorage `researchium_launch_obs=1` to enable.
   */
  function tryLaunchExternalStreamApp() {
    // Default OFF to avoid desktop-protocol handler issues in browsers.
    if (localStorage.getItem('researchium_launch_obs') !== '1') {
      return;
    }
    const url = String(global.RESEARCHIUM_OBS_LAUNCH_URL || 'obs://').trim();
    if (!url) return;
    try {
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* ignore — browser studio still opens */
    }
  }

  function streamStudioLobbyUrl() {
    if (isIntegrated()) {
      return `${global.location.origin}/stream-studio/studio-lobby.html`;
    }
    return 'studio-lobby.html';
  }

  function streamStudioUrl() {
    if (isIntegrated()) {
      return `${global.location.origin}/stream-studio/studio.html`;
    }
    return 'studio.html';
  }

  function streamDashboardUrl() {
    if (isIntegrated()) {
      return `${global.location.origin}/stream-studio/stream-dashboard.html`;
    }
    return 'stream-dashboard.html';
  }

  global.ResearchiumStudioEnv = {
    configure,
    buildCsp,
    buildConnectSrc,
    isIntegrated,
    isLocalDevHost,
    resolveMainAppOrigin,
    tryLaunchExternalStreamApp,
    streamStudioLobbyUrl,
    streamStudioUrl,
    streamDashboardUrl,
  };
})(window);

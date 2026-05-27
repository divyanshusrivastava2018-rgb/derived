/**
 * Stream studio controls: OBS WebSocket, overlays, cross-platform analytics.
 */
window.ResearchiumStudioControls = (function () {
  const base = () => window.RESEARCHIUM_API_URL || '';

  async function api(path, options = {}) {
    const auth = window.ResearchiumStudioAuth;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (auth?.getToken) {
      const token = await auth.getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${base()}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  function room(path, slug) {
    return `/api/studio-controls/${encodeURIComponent(slug)}${path}`;
  }

  return {
    getAnalytics(slug) {
      return api(room('/analytics', slug));
    },
    startAnalytics(slug, intervalMs) {
      return api(room('/analytics/start', slug), {
        method: 'POST',
        body: JSON.stringify({ intervalMs }),
      });
    },
    stopAnalytics(slug) {
      return api(room('/analytics/stop', slug), { method: 'POST' });
    },
    getOverlays(slug) {
      return api(room('/overlays', slug));
    },
    patchOverlays(slug, config) {
      return api(room('/overlays', slug), {
        method: 'PATCH',
        body: JSON.stringify(config),
      });
    },
    triggerOverlay(slug, type, payload) {
      return api(room('/overlays/trigger', slug), {
        method: 'POST',
        body: JSON.stringify({ type, ...payload }),
      });
    },
    connectObs(opts) {
      return api('/api/studio-controls/obs/connect', {
        method: 'POST',
        body: JSON.stringify(opts || {}),
      });
    },
    disconnectObs() {
      return api('/api/studio-controls/obs/disconnect', { method: 'POST' });
    },
    obsStatus() {
      return api('/api/studio-controls/obs/status');
    },
    obsScenes() {
      return api('/api/studio-controls/obs/scenes');
    },
    switchObsScene(sceneName) {
      return api('/api/studio-controls/obs/scene', {
        method: 'POST',
        body: JSON.stringify({ sceneName }),
      });
    },
    switchBrowserScene(slug, body) {
      return api(room('/scene/browser', slug), {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    mountOverlayLayer() {
      ['stagePortrait', 'stageLandscape'].forEach((id) => {
        const stage = document.getElementById(id);
        if (!stage || stage.querySelector('.overlay-layer')) return;
        const layer = document.createElement('div');
        layer.className = 'overlay-layer';
        layer.setAttribute('aria-live', 'polite');
        stage.appendChild(layer);
      });
    },

    showOverlayEvent(event) {
      const stages = document.querySelectorAll('.overlay-layer');
      stages.forEach((layer) => {
        const card = document.createElement('div');
        card.className = `overlay-card overlay-${event.type} pos-${event.position || 'top'}`;
        const title = document.createElement('div');
        title.className = 'overlay-title';
        title.textContent = event.title || event.user || 'Alert';
        card.appendChild(title);
        if (event.subtitle || event.amount) {
          const sub = document.createElement('div');
          sub.className = 'overlay-sub';
          sub.textContent = event.subtitle || (event.amount ? `$${event.amount}` : '');
          card.appendChild(sub);
        }
        layer.appendChild(card);
        requestAnimationFrame(() => card.classList.add('show'));
        setTimeout(() => {
          card.classList.remove('show');
          setTimeout(() => card.remove(), 400);
        }, event.durationMs || 5000);
      });
    },

    renderAnalyticsBar(breakdown, totalEl, detailEl) {
      if (totalEl) totalEl.textContent = String(breakdown?.totalViewers ?? 0);
      if (!detailEl) return;
      const parts = breakdown?.breakdown || {};
      const labels = { youtube: 'YT', twitch: 'TW', facebook: 'FB', linkedin: 'LI' };
      detailEl.innerHTML = Object.keys(labels)
        .map((p) => {
          const n = parts[p]?.viewers ?? 0;
          const live = parts[p]?.live ? ' live' : '';
          return `<span class="plat-stat${live}">${labels[p]} <strong>${n}</strong></span>`;
        })
        .join('');
    },

    bindSignaling(socket, slug, handlers = {}) {
      if (!socket) return;
      socket.on('overlay-show', (ev) => {
        this.showOverlayEvent(ev);
        handlers.onOverlay?.(ev);
      });
      socket.on('analytics-update', (data) => {
        handlers.onAnalytics?.(data);
      });
      socket.on('studio-state', (state) => {
        if (state?.obsScene) handlers.onObsScene?.(state.obsScene);
      });
    },

    subscribeAnalytics(socket, slug, intervalMs = 5000) {
      socket?.emit('analytics-subscribe', { roomId: slug, intervalMs });
    },

    unsubscribeAnalytics(socket, slug) {
      socket?.emit('analytics-unsubscribe', { roomId: slug });
    },
  };
})();

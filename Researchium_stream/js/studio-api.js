/**
 * Researchium Studio REST API client.
 */
window.ResearchiumStudioApi = (function () {
  const auth = window.ResearchiumStudio;

  async function api(path, options = {}) {
    return auth.api(path, options);
  }

  return {
    getApiBase: () => auth.API_BASE,
    getSignalingBase() {
      if (window.RESEARCHIUM_SIGNALING_URL) return window.RESEARCHIUM_SIGNALING_URL;
      if (window.RESEARCHIUM_STUDIO_URL) return window.RESEARCHIUM_STUDIO_URL;
      if (location.pathname.startsWith('/stream-studio')) {
        return `${location.origin}/stream-studio-backend`;
      }
      const main = window.ResearchiumStudioEnv?.resolveMainAppOrigin?.();
      if (main) return `${main}/stream-studio-backend`;
      return auth.API_BASE || '';
    },
    startStudio(title) {
      return api('/api/studio/start', {
        method: 'POST',
        body: JSON.stringify({ title, origin: location.origin }),
      });
    },
    getRoom(roomSlug) {
      return api(`/api/studio/room/${encodeURIComponent(roomSlug)}`);
    },
    getRoomHost(roomSlug) {
      return api(`/api/studio/room/${encodeURIComponent(roomSlug)}/host?origin=${encodeURIComponent(location.origin)}`);
    },
    updateRoom(roomSlug, patch) {
      return api(`/api/studio/room/${encodeURIComponent(roomSlug)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    },
    setLive(roomSlug, live) {
      return api(`/api/studio/room/${encodeURIComponent(roomSlug)}/live`, {
        method: 'POST',
        body: JSON.stringify({ live }),
      });
    },
    createScene(roomSlug, name, layoutType) {
      return api(`/api/studio/room/${encodeURIComponent(roomSlug)}/scenes`, {
        method: 'POST',
        body: JSON.stringify({ name, layoutType }),
      });
    },
    activateScene(roomSlug, sceneId) {
      return api(`/api/studio/room/${encodeURIComponent(roomSlug)}/scenes/${sceneId}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: true }),
      });
    },
    deleteScene(roomSlug, sceneId) {
      return api(`/api/studio/room/${encodeURIComponent(roomSlug)}/scenes/${sceneId}`, {
        method: 'DELETE',
      });
    },
    getChat(roomSlug, opts = {}) {
      const q = new URLSearchParams();
      if (opts.private === true) q.set('private', '1');
      if (opts.private === false) q.set('private', '0');
      if (opts.since) q.set('since', opts.since);
      const qs = q.toString();
      return api(`/api/studio/room/${encodeURIComponent(roomSlug)}/chat${qs ? `?${qs}` : ''}`);
    },
    postChat(roomSlug, body, isPrivate) {
      return api(`/api/studio/room/${encodeURIComponent(roomSlug)}/chat`, {
        method: 'POST',
        body: JSON.stringify({ body, isPrivate }),
      });
    },
    createGuestInvite(roomSlug) {
      return api(`/api/studio/room/${encodeURIComponent(roomSlug)}/guests`, {
        method: 'POST',
        body: JSON.stringify({ origin: location.origin }),
      });
    },
    joinRoom(roomSlug, inviteToken, displayName) {
      return auth.api(`/api/studio/room/${encodeURIComponent(roomSlug)}/join`, {
        method: 'POST',
        body: JSON.stringify({ inviteToken, displayName }),
        headers: {},
      });
    },
    getNotes(roomSlug) {
      return api(`/api/studio/room/${encodeURIComponent(roomSlug)}/notes`);
    },
    saveNotes(roomSlug, content) {
      return api(`/api/studio/room/${encodeURIComponent(roomSlug)}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      });
    },
    addSource(roomSlug, kind, label, config) {
      return api(`/api/studio/room/${encodeURIComponent(roomSlug)}/sources`, {
        method: 'POST',
        body: JSON.stringify({ kind, label, config }),
      });
    },
    refreshSignalingToken(roomSlug, role) {
      return api(`/api/studio/room/${encodeURIComponent(roomSlug)}/signaling-token`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
    },
  };
})();

const PLATFORM_ICONS = {
  youtube: '▶',
  twitch: '💜',
  facebook: 'ƒ',
  linkedin: 'in',
};

export function getStudioBase() {
  if (typeof window !== 'undefined' && window.RESEARCHIUM_STUDIO_URL) {
    return window.RESEARCHIUM_STUDIO_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === '127.0.0.1' || host === 'localhost') {
      return 'http://127.0.0.1:5050';
    }
  }
  return '';
}

export function getApiBase() {
  if (typeof window !== 'undefined' && window.RESEARCHIUM_API_URL) {
    return window.RESEARCHIUM_API_URL.replace(/\/$/, '');
  }
  return 'http://127.0.0.1:4000';
}

async function getToken() {
  const auth = window.ResearchiumStudio;
  if (!auth?.getToken) return null;
  return auth.getToken();
}

export async function studioRequest(path, options = {}) {
  const base = getStudioBase();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'request_failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function coreRequest(path, options = {}) {
  const base = getApiBase();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const streamV1 = {
  health: () => studioRequest('/api/v1/health'),
  getConnections: () => studioRequest('/api/v1/connections'),
  startOAuth: (platform) =>
    studioRequest(`/api/v1/connections/${platform}/oauth`, { method: 'POST' }),
  disconnect: (platform) =>
    studioRequest(`/api/v1/connections/${platform}`, { method: 'DELETE' }),
  goLiveAll: (body) =>
    studioRequest('/api/multistream/go-live', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  endBroadcast: (broadcastId) =>
    studioRequest('/api/multistream/end', {
      method: 'POST',
      body: JSON.stringify({ broadcastId }),
    }),
  getChatMessages: (roomSlug, params = {}) => {
    const q = new URLSearchParams();
    if (params.since) q.set('since', params.since);
    if (params.platform) q.set('platform', params.platform);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return studioRequest(`/api/v1/rooms/${encodeURIComponent(roomSlug)}/chat/messages${qs ? `?${qs}` : ''}`);
  },
  sendChat: (roomSlug, body, authorName) =>
    studioRequest(`/api/v1/rooms/${encodeURIComponent(roomSlug)}/chat/messages`, {
      method: 'POST',
      body: JSON.stringify({ body, authorName }),
    }),
  startChatRelay: (roomSlug, config) =>
    studioRequest(`/api/v1/rooms/${encodeURIComponent(roomSlug)}/chat/relay/start`, {
      method: 'POST',
      body: JSON.stringify(config || {}),
    }),
  stopChatRelay: (roomSlug) =>
    studioRequest(`/api/v1/rooms/${encodeURIComponent(roomSlug)}/chat/relay/stop`, {
      method: 'POST',
    }),
  chatRelayStatus: (roomSlug) =>
    studioRequest(`/api/v1/rooms/${encodeURIComponent(roomSlug)}/chat/relay/status`),
  getAnalytics: (roomSlug) =>
    studioRequest(`/api/studio-controls/${encodeURIComponent(roomSlug)}/analytics`),
  startAnalytics: (roomSlug) =>
    studioRequest(`/api/studio-controls/${encodeURIComponent(roomSlug)}/analytics/start`, {
      method: 'POST',
      body: JSON.stringify({ intervalMs: 5000 }),
    }),
  stopAnalytics: (roomSlug) =>
    studioRequest(`/api/studio-controls/${encodeURIComponent(roomSlug)}/analytics/stop`, {
      method: 'POST',
    }),
  setRoomLive: (roomSlug, live) =>
    coreRequest(`/api/studio/room/${encodeURIComponent(roomSlug)}/live`, {
      method: 'POST',
      body: JSON.stringify({ live }),
    }),
  getRoomHost: (roomSlug) =>
    coreRequest(`/api/studio/room/${encodeURIComponent(roomSlug)}/host`),
  activateScene: (roomSlug, sceneId) =>
    coreRequest(`/api/studio/room/${encodeURIComponent(roomSlug)}/scenes/${sceneId}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: true }),
    }),
  switchBrowserScene: (roomSlug, body) =>
    studioRequest(`/api/studio-controls/${encodeURIComponent(roomSlug)}/scene/browser`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export { PLATFORM_ICONS };

/**
 * Multi-platform streaming + destinations API helpers.
 */
window.ResearchiumMultistreamApi = (function () {
  const PLATFORMS = [
    { id: 'youtube', name: 'YouTube', color: '#FF0000', rtmpBase: 'rtmp://a.rtmp.youtube.com/live2' },
    { id: 'twitch', name: 'Twitch', color: '#9146FF', rtmpBase: 'rtmp://live.twitch.tv/app' },
    { id: 'facebook', name: 'Facebook Live', color: '#1877F2', rtmpBase: 'rtmps://live-api-s.facebook.com:443/rtmp' },
    { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', rtmpBase: 'rtmp://live.linkedin.com/live-api/rtmp' },
    { id: 'twitter', name: 'X (Twitter)', color: '#000000', rtmpBase: 'rtmp://ingest.pscp.tv:80/x' },
    { id: 'tiktok', name: 'TikTok', color: '#010101', rtmpBase: 'rtmp://live.tiktok.com/live' },
    { id: 'kick', name: 'Kick', color: '#53FC18', rtmpBase: 'rtmp://ingest.kick.com/app' },
    { id: 'instagram', name: 'Instagram', color: '#E1306C', rtmpBase: 'rtmp://live-upload.instagram.com:80/rtmp' },
    { id: 'custom', name: 'Custom RTMP', color: '#6366f1', rtmpBase: '' },
  ];

  const getToken = () => sessionStorage.getItem('studio_token');

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`/api/stream${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'request_failed');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    platforms: PLATFORMS,
    listDestinations() {
      return request('/destinations');
    },
    createDestination(payload) {
      return request('/destinations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    updateDestination(id, payload) {
      return request(`/destinations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    },
    deleteDestination(id) {
      return request(`/destinations/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    // Legacy helpers retained for existing callers.
    getConnections() {
      return Promise.resolve({ platforms: [] });
    },
    startOAuth(platform) {
      return Promise.reject(new Error(`oauth_not_supported:${platform}`));
    },
    disconnect(platform) {
      return Promise.reject(new Error(`disconnect_not_supported:${platform}`));
    },
    goLiveAll(payload) {
      return request('/status', {
        method: 'POST',
        body: JSON.stringify({ live: true, ...payload }),
      });
    },
    endBroadcast(broadcastId) {
      return request('/status', {
        method: 'POST',
        body: JSON.stringify({ live: false }),
      });
    },
  };
})();

/**
 * Researchium Studio room state (browser).
 */
window.ResearchiumStudioRoom = (function () {
  const media = window.ResearchiumMedia;

  function loadSession() {
    try {
      const raw = sessionStorage.getItem('researchium_studio_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSession(data) {
    sessionStorage.setItem('researchium_studio_session', JSON.stringify(data));
  }

  function loadProfile() {
    try {
      const raw = sessionStorage.getItem('researchium_join_profile');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function initials(name) {
    return (name || 'RS')
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  function formatDuration(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function roomSlug() {
    const s = loadSession();
    return s?.roomSlug || s?.studio?.stream?.roomSlug || '';
  }

  return {
    media,
    loadSession,
    saveSession,
    loadProfile,
    initials,
    formatDuration,
    roomSlug,
    noCamera() {
      return sessionStorage.getItem('researchium_studio_no_camera') === '1';
    },
  };
})();

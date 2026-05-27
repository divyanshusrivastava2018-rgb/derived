/**
 * Studio auth + API client (browser).
 */
window.ResearchiumStudio = (function () {
  if (window.ResearchiumStudioEnv) {
    window.ResearchiumStudioEnv.configure();
  }

  function resolveMainAppOrigin() {
    if (location.hostname === 'localhost') return 'http://localhost:3000';
    if (location.hostname === '127.0.0.1') return 'http://127.0.0.1:3000';
    if (location.protocol === 'file:') return 'http://localhost:3000';
    return location.origin || '';
  }

  function resolveApiBase() {
    if (window.RESEARCHIUM_API_URL) return window.RESEARCHIUM_API_URL;
    if (location.pathname.startsWith('/stream-studio')) {
      return `${location.origin}/stream-api`;
    }
    if (
      location.protocol === 'file:' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === 'localhost' ||
      location.hostname === ''
    ) {
      return `${resolveMainAppOrigin()}/stream-api`;
    }
    return '';
  }

  const API_BASE = resolveApiBase();

  const TOKEN_KEY = 'researchium_session';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function getUser() {
    const raw = localStorage.getItem('researchium_user');
    return raw ? JSON.parse(raw) : null;
  }

  function setUser(user) {
    if (user) localStorage.setItem('researchium_user', JSON.stringify(user));
    else localStorage.removeItem('researchium_user');
  }

  function saveSession(data) {
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch {
      const err = new Error('network_error');
      err.status = 0;
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code =
        data.error ||
        (res.status === 502 ? 'stream_backend_unavailable' : 'request_failed');
      const err = new Error(code);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    API_BASE,
    api,
    getToken,
    setToken,
    getUser,
    setUser,
    logout() {
      api('/api/auth/logout', { method: 'POST' }).catch(() => {});
      setToken(null);
      setUser(null);
    },
    async login(email, password) {
      return saveSession(
        await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
      );
    },
    async register(email, password, name, institution) {
      return saveSession(
        await api('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password, name, institution: institution || undefined }),
        })
      );
    },
    async me() {
      const data = await api('/api/auth/me');
      setUser(data.user);
      return data.user;
    },
    async refreshSession() {
      return saveSession(await api('/api/auth/refresh', { method: 'POST' }));
    },
    async updateProfile(patch) {
      const data = await api('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setUser(data.user);
      return data.user;
    },
    async changePassword(currentPassword, newPassword) {
      return api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },
    async forgotPassword(email) {
      return api('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email, origin: location.origin }),
      });
    },
    async resetPassword(token, password) {
      return saveSession(
        await api('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token, password }),
        })
      );
    },
    async startStudio(title) {
      return api('/api/studio/start', {
        method: 'POST',
        body: JSON.stringify({ title, origin: location.origin }),
      });
    },
    async ensureSignedIn() {
      if (getToken()) {
        try {
          return await api('/api/auth/me').then((d) => d.user);
        } catch {
          setToken(null);
          setUser(null);
        }
      }
      const err = new Error('sign_in_required');
      err.status = 401;
      throw err;
    },
    saveStudioSession(session) {
      sessionStorage.setItem(
        'researchium_studio_session',
        JSON.stringify({
          roomSlug: session.roomSlug,
          peerId: session.peerId,
          signalingToken: session.signalingToken,
          signalingUrl: session.signalingUrl,
          stream: session.stream,
          studio: session.studio,
        })
      );
    },
    async openMeeting(opts = {}) {
      await this.ensureSignedIn();
      const dash = window.ResearchiumDashboardApi;
      const session = dash
        ? await dash.openMeeting(opts)
        : await api('/api/dashboard/meeting', {
            method: 'POST',
            body: JSON.stringify({
              title: opts.title,
              forceNew: Boolean(opts.forceNew),
              origin: location.origin,
            }),
          });
      this.saveStudioSession(session);
      return session;
    },
    redirectToDashboard() {
      const url =
        window.ResearchiumStudioEnv?.streamDashboardUrl?.() ||
        new URL('stream-dashboard.html', location.href).href;
      location.replace(url);
    },
    async bootstrapMeeting() {
      try {
        const dash = window.ResearchiumDashboardApi;
        const session = dash
          ? await dash.openMeeting({ forceNew: false })
          : await api('/api/dashboard/meeting', {
              method: 'POST',
              body: JSON.stringify({
                forceNew: false,
                origin: location.origin,
              }),
            });
        this.saveStudioSession(session);
        return session;
      } catch (e) {
        console.warn('[Researchium] bootstrapMeeting:', e.message || e);
        return null;
      }
    },
    async openMeetingDashboard() {
      await this.ensureSignedIn();
      await this.bootstrapMeeting();
      this.redirectToDashboard();
    },
    async openBrowserStudio(opts = {}) {
      await this.openMeeting({ forceNew: Boolean(opts.forceNew) });
      if (!sessionStorage.getItem('researchium_join_profile')) {
        const user = getUser();
        sessionStorage.setItem(
          'researchium_join_profile',
          JSON.stringify({ name: user?.name || 'Host', title: 'Presenter' })
        );
      }
      sessionStorage.setItem('researchium_media_granted', '0');
      location.href = 'studio.html';
    },
  };
})();

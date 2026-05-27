(async function () {
    const STREAM_AUTH_API_BASE =
      window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
    const LOBBY_URL = new URL('studio-lobby.html', window.location.href).href;

    function redirectToLobby() {
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      window.location.replace(LOBBY_URL);
    }

    const token = sessionStorage.getItem('studio_token');
    if (!token) {
      redirectToLobby();
      return;
    }

    try {
      const res = await fetch(`${STREAM_AUTH_API_BASE}/api/stream/auth/verify`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.status === 401 || !res.ok) {
        redirectToLobby();
        return;
      }
      const data = await res.json();
      if (!data?.valid) {
        redirectToLobby();
        return;
      }
    } catch {
      redirectToLobby();
      return;
    }

    document.documentElement.classList.remove('studio-session-pending');
    document.getElementById('btnStudioSignOut')?.addEventListener('click', redirectToLobby);

    const auth = window.ResearchiumStudio;
    const dashboardApi = window.ResearchiumDashboardApi;
    const multistreamApi = window.ResearchiumMultistreamApi;
    const escapeHtml = window.ResearchiumSafe?.escapeHtml || ((v) => String(v ?? ''));
    const titles = {
      'go-live': 'Go live',
      streams: 'My streams',
      chat: 'Unified Chat',
      destinations: 'Destinations',
      schedule: 'Live schedule',
      analytics: 'Analytics',
    };
    let lastBroadcastId = null;
    const params = new URLSearchParams(location.search);
    const studioMedia = window.ResearchiumMedia;

    function applyUserToSidebar(user) {
      const nameEl = document.querySelector('.channel-name');
      if (nameEl && user?.name) nameEl.textContent = user.name;
      const avatar = document.querySelector('.channel-avatar');
      if (avatar && user?.name) {
        avatar.textContent = user.name
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
      }
    }

    let toastTimer = null;
    function showToast(message, type) {
      const el = document.getElementById('streamDashToast');
      if (!el) return;
      el.textContent = message;
      el.className = 'stream-dash-toast' + (type === 'error' ? ' stream-dash-toast--error' : '');
      el.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        el.hidden = true;
      }, 6000);
    }

    function copyText(text, btn) {
      navigator.clipboard?.writeText(text).catch(() => {});
      if (!btn) return;
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = original;
      }, 1200);
    }

    function showBuildBanner() {
      const banner = document.getElementById('reactBuildBanner');
      if (banner) banner.hidden = false;
    }

    function safeLsGet(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }

    function safeLsSet(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    }

    function safeJsonParse(raw, fallback) {
      try {
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    }

    // -----------------------------
    // My streams (card list + localStorage)
    // -----------------------------
    const STREAMS_LS_KEY = 'researchium_streams_v1';
    let streamsFilter = 'all';
    let streamsSearchQuery = '';
    let openStreamMenuId = null;

    const STREAM_PLATFORM_ICON = {
      youtube: { label: 'Y', cls: 'stream-platform-icon--youtube' },
      twitch: { label: 'T', cls: 'stream-platform-icon--twitch' },
      facebook: { label: 'F', cls: 'stream-platform-icon--facebook' },
      linkedin: { label: 'L', cls: 'stream-platform-icon--linkedin' },
      twitter: { label: 'X', cls: 'stream-platform-icon--twitter' },
      tiktok: { label: '♪', cls: 'stream-platform-icon--tiktok' },
      instagram: { label: 'IG', cls: 'stream-platform-icon--instagram' },
      kick: { label: 'K', cls: 'stream-platform-icon--kick' },
      custom: { label: 'C', cls: 'stream-platform-icon--custom' },
    };

    const THUMB_GRADIENTS = [
      ['#8b5cf6', '#6d28d9'],
      ['#ef4444', '#b91c1c'],
      ['#10b981', '#047857'],
      ['#f59e0b', '#b45309'],
      ['#3b82f6', '#1d4ed8'],
      ['#ec4899', '#9d174d'],
    ];

    function loadStreamsFromLs() {
      return safeJsonParse(safeLsGet(STREAMS_LS_KEY), []);
    }

    function saveStreamsToLs(streams) {
      safeLsSet(STREAMS_LS_KEY, JSON.stringify(streams));
    }

    function initDemoStreamsIfNeeded() {
      if (safeLsGet(STREAMS_LS_KEY)) return;
      const now = new Date();
      const today7pm = new Date(now);
      today7pm.setHours(19, 0, 0, 0);
      if (today7pm < now) today7pm.setDate(today7pm.getDate() + 1);
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(18, 30, 0, 0);

      const demo = [
        {
          id: 'demo-real-analysis',
          roomSlug: 'real-analysis-sequences',
          title: 'Real Analysis · Sequences',
          subject: 'Mathematics',
          status: 'scheduled',
          platforms: ['youtube', 'twitch'],
          peakViewers: null,
          scheduledAt: today7pm.toISOString(),
          updatedAt: now.toISOString(),
          createdAt: now.toISOString(),
          link: `${location.origin}/live-classes.html?stream=real-analysis-sequences`,
        },
        {
          id: 'demo-crispr',
          roomSlug: 'crispr-cas9-workshop',
          title: 'CRISPR-Cas9 Workshop',
          subject: 'Biology',
          status: 'ended',
          platforms: ['youtube', 'linkedin'],
          peakViewers: 142,
          scheduledAt: null,
          endedAt: twoDaysAgo.toISOString(),
          updatedAt: twoDaysAgo.toISOString(),
          createdAt: twoDaysAgo.toISOString(),
          link: `${location.origin}/live-classes.html?stream=crispr-cas9-workshop`,
        },
        {
          id: 'demo-physics-qa',
          roomSlug: 'physics-live-qa',
          title: 'Physics Live Q&A',
          subject: 'Physics',
          status: 'draft',
          platforms: [],
          peakViewers: null,
          scheduledAt: null,
          updatedAt: now.toISOString(),
          createdAt: now.toISOString(),
          link: `${location.origin}/live-classes.html?stream=physics-live-qa`,
        },
      ];
      saveStreamsToLs(demo);
    }

    function mergeApiStreams(apiStreams) {
      const local = loadStreamsFromLs();
      if (!apiStreams?.length) return local;
      const bySlug = new Map(local.map((s) => [s.roomSlug || s.id, s]));
      apiStreams.forEach((api) => {
        const slug = api.roomSlug || api.id;
        if (!slug) return;
        if (bySlug.has(slug)) {
          const existing = bySlug.get(slug);
          bySlug.set(slug, {
            ...existing,
            title: api.title || existing.title,
            status: api.status || existing.status,
            updatedAt: api.updatedAt || existing.updatedAt,
          });
        } else {
          bySlug.set(slug, {
            id: slug,
            roomSlug: slug,
            title: api.title || 'Untitled stream',
            subject: api.channel || 'General Research',
            status: api.status || 'draft',
            platforms: [],
            peakViewers: null,
            scheduledAt: null,
            updatedAt: api.updatedAt || api.createdAt || new Date().toISOString(),
            createdAt: api.createdAt || new Date().toISOString(),
            link: `${location.origin}/live-classes.html?stream=${encodeURIComponent(slug)}`,
          });
        }
      });
      return Array.from(bySlug.values());
    }

    function titleInitials(title) {
      const parts = String(title || '')
        .split(/[\s·\-–—]+/)
        .filter(Boolean);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return String(title || 'ST').slice(0, 2).toUpperCase();
    }

    function colorsFromTitle(title) {
      let h = 0;
      const t = String(title || '');
      for (let i = 0; i < t.length; i += 1) h = (h * 31 + t.charCodeAt(i)) >>> 0;
      return THUMB_GRADIENTS[h % THUMB_GRADIENTS.length];
    }

    function drawStreamThumb(canvas, title) {
      const [c1, c2] = colorsFromTitle(title);
      const ctx = canvas.getContext('2d');
      const w = 40;
      const h = 40;
      canvas.width = w;
      canvas.height = h;
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = 'bold 13px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(titleInitials(title), w / 2, h / 2 + 0.5);
    }

    function formatStreamListDate(stream) {
      const now = new Date();
      if (stream.status === 'scheduled' && stream.scheduledAt) {
        const d = new Date(stream.scheduledAt);
        const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        if (d.toDateString() === now.toDateString()) return `Today ${time}`;
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      }
      const ref = stream.endedAt || stream.updatedAt || stream.createdAt;
      if (!ref) return '—';
      const d = new Date(ref);
      const diffMs = now - d;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) {
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        if (hours < 1) return 'Just now';
        return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
      }
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    function streamStatusBadgeClass(status) {
      const s = String(status || 'draft').toLowerCase();
      if (s === 'live') return 'stream-status-badge stream-status-badge--live';
      if (s === 'scheduled') return 'stream-status-badge stream-status-badge--scheduled';
      if (s === 'ended') return 'stream-status-badge stream-status-badge--ended';
      return 'stream-status-badge stream-status-badge--draft';
    }

    function streamStatusLabel(status) {
      const s = String(status || 'draft').toLowerCase();
      if (s === 'live') return 'Live';
      if (s === 'scheduled') return 'Scheduled';
      if (s === 'ended') return 'Ended';
      return 'Draft';
    }

    function filterStreamsList(streams) {
      let list = streams.slice();
      if (streamsFilter !== 'all') {
        list = list.filter((s) => String(s.status || '').toLowerCase() === streamsFilter);
      }
      const q = streamsSearchQuery.trim().toLowerCase();
      if (q) {
        list = list.filter(
          (s) =>
            String(s.title || '').toLowerCase().includes(q) ||
            String(s.subject || '').toLowerCase().includes(q)
        );
      }
      return list;
    }

    function closeStreamActionsMenu() {
      openStreamMenuId = null;
      document.querySelectorAll('.stream-actions-menu').forEach((m) => m.remove());
      document.querySelectorAll('.stream-actions-btn[aria-expanded="true"]').forEach((b) => {
        b.setAttribute('aria-expanded', 'false');
      });
    }

    function openStreamActionsMenu(streamId, anchorBtn) {
      closeStreamActionsMenu();
      openStreamMenuId = streamId;
      anchorBtn.setAttribute('aria-expanded', 'true');
      const menu = document.createElement('div');
      menu.className = 'stream-actions-menu';
      menu.role = 'menu';
      const actions = [
        { key: 'edit', label: 'Edit' },
        { key: 'duplicate', label: 'Duplicate' },
        { key: 'copy', label: 'Copy link' },
        { key: 'delete', label: 'Delete', danger: true },
      ];
      actions.forEach((a) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = a.label;
        btn.role = 'menuitem';
        if (a.danger) btn.className = 'danger';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleStreamAction(streamId, a.key);
          closeStreamActionsMenu();
        });
        menu.appendChild(btn);
      });
      anchorBtn.closest('.stream-actions-wrap')?.appendChild(menu);
    }

    function handleStreamAction(streamId, action) {
      const streams = loadStreamsFromLs();
      const idx = streams.findIndex((s) => s.id === streamId);
      if (idx < 0) return;
      const stream = streams[idx];

      if (action === 'edit') {
        showToast(`Edit "${stream.title}" (coming soon).`);
        return;
      }
      if (action === 'duplicate') {
        const copy = {
          ...stream,
          id: `dup_${Date.now()}`,
          roomSlug: `${stream.roomSlug || stream.id}-copy`,
          title: `${stream.title} (copy)`,
          status: 'draft',
          peakViewers: null,
          scheduledAt: null,
          endedAt: null,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        streams.splice(idx + 1, 0, copy);
        saveStreamsToLs(streams);
        renderStreamsList(streams);
        showToast('Stream duplicated.');
        return;
      }
      if (action === 'copy') {
        const link = stream.link || `${location.origin}/live-classes.html`;
        copyText(link);
        showToast('Link copied.');
        return;
      }
      if (action === 'delete') {
        streams.splice(idx, 1);
        saveStreamsToLs(streams);
        renderStreamsList(streams);
        showToast('Stream deleted.');
      }
    }

    async function openStreamRow(stream) {
      if (!stream.roomSlug || stream.status === 'draft') {
        showToast('Open Go live to configure this draft stream.');
        showPanel('go-live');
        return;
      }
      try {
        const meeting = await dashboardApi.getMeeting(stream.roomSlug);
        auth.saveStudioSession(meeting);
        location.href = 'studio.html';
      } catch {
        showToast('Could not open this stream.', 'error');
      }
    }

    function renderStreamsList(allStreams) {
      const listEl = document.getElementById('streamsList');
      const emptyEl = document.getElementById('streamsEmpty');
      const filterEmptyEl = document.getElementById('streamsFilterEmpty');
      if (!listEl) return;

      const streams = Array.isArray(allStreams) ? allStreams : loadStreamsFromLs();
      const filtered = filterStreamsList(streams);

      closeStreamActionsMenu();
      listEl.innerHTML = '';

      if (!streams.length) {
        listEl.hidden = true;
        if (emptyEl) emptyEl.hidden = false;
        if (filterEmptyEl) filterEmptyEl.hidden = true;
        return;
      }

      if (emptyEl) emptyEl.hidden = true;
      listEl.hidden = false;

      if (!filtered.length) {
        if (filterEmptyEl) filterEmptyEl.hidden = false;
        return;
      }
      if (filterEmptyEl) filterEmptyEl.hidden = true;

      filtered.forEach((stream) => {
        const row = document.createElement('article');
        row.className = 'stream-row';
        row.role = 'listitem';
        row.dataset.streamId = stream.id;

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'stream-row-thumb';
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        drawStreamThumb(canvas, stream.title);
        thumbWrap.appendChild(canvas);

        const main = document.createElement('div');
        main.className = 'stream-row-main';
        const titleEl = document.createElement('div');
        titleEl.className = 'stream-row-title';
        titleEl.textContent = stream.title;
        const subjectEl = document.createElement('span');
        subjectEl.className = 'stream-row-subject';
        subjectEl.textContent = stream.subject || 'General Research';
        main.appendChild(titleEl);
        main.appendChild(subjectEl);

        const badge = document.createElement('span');
        badge.className = streamStatusBadgeClass(stream.status);
        badge.textContent = streamStatusLabel(stream.status);

        const platforms = document.createElement('div');
        platforms.className = 'stream-platforms';
        if (stream.platforms?.length) {
          stream.platforms.forEach((key) => {
            const meta = STREAM_PLATFORM_ICON[key] || STREAM_PLATFORM_ICON.custom;
            const icon = document.createElement('span');
            icon.className = `stream-platform-icon ${meta.cls}`;
            icon.title = key;
            icon.textContent = meta.label;
            platforms.appendChild(icon);
          });
        } else {
          platforms.className = 'stream-platforms stream-platforms--empty';
          platforms.textContent = '—';
        }

        const viewers = document.createElement('div');
        viewers.className = 'stream-viewers';
        if (stream.status === 'draft' || stream.peakViewers == null) {
          viewers.textContent = '—';
        } else {
          const peak = document.createElement('strong');
          peak.textContent = String(Number(stream.peakViewers) || 0);
          viewers.append(peak, document.createTextNode(' peak'));
        }

        const dateEl = document.createElement('div');
        dateEl.className = 'stream-date';
        dateEl.textContent = formatStreamListDate(stream);

        const actionsWrap = document.createElement('div');
        actionsWrap.className = 'stream-actions-wrap';
        const actionsBtn = document.createElement('button');
        actionsBtn.type = 'button';
        actionsBtn.className = 'stream-actions-btn';
        actionsBtn.setAttribute('aria-label', 'Stream actions');
        actionsBtn.setAttribute('aria-expanded', 'false');
        actionsBtn.textContent = '⋯';
        actionsBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (openStreamMenuId === stream.id) closeStreamActionsMenu();
          else openStreamActionsMenu(stream.id, actionsBtn);
        });
        actionsWrap.appendChild(actionsBtn);

        row.append(thumbWrap, main, badge, platforms, viewers, dateEl, actionsWrap);
        row.addEventListener('click', (e) => {
          if (e.target.closest('.stream-actions-wrap')) return;
          openStreamRow(stream);
        });
        listEl.appendChild(row);
      });
    }

    function bindStreamsToolbar() {
      document.querySelectorAll('[data-stream-filter]').forEach((tab) => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('[data-stream-filter]').forEach((t) => t.classList.remove('active'));
          tab.classList.add('active');
          streamsFilter = tab.dataset.streamFilter || 'all';
          renderStreamsList(loadStreamsFromLs());
        });
      });

      const search = document.getElementById('streamsSearchInput');
      search?.addEventListener('input', () => {
        streamsSearchQuery = search.value;
        renderStreamsList(loadStreamsFromLs());
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.stream-actions-wrap')) closeStreamActionsMenu();
      });
    }

    initDemoStreamsIfNeeded();
    bindStreamsToolbar();
    renderStreamsList(loadStreamsFromLs());

    let analyticsPollTimer = null;

    function applyAnalytics(data) {
      const controls = window.ResearchiumStudioControls;
      if (!controls || !data) return;
      document.getElementById('viewerCount').textContent = String(data.totalViewers ?? 0);
      controls.renderAnalyticsBar(data, null, document.getElementById('viewerBreakdown'));
    }

    function startDashboardAnalytics(roomSlug) {
      const controls = window.ResearchiumStudioControls;
      if (!controls || !roomSlug) return;
      clearInterval(analyticsPollTimer);
      const tick = () => controls.getAnalytics(roomSlug).then(applyAnalytics).catch(() => {});
      tick();
      analyticsPollTimer = setInterval(tick, 12000);
      controls.startAnalytics(roomSlug).catch(() => {});
    }

    function applyDashboard(data) {
      if (data?.user) applyUserToSidebar(data.user);
      const merged = mergeApiStreams(data?.streams);
      saveStreamsToLs(merged);
      renderStreamsList(merged);
      const active = data?.activeMeeting;
      if (active) {
        document.getElementById('pageTitle').textContent = active.title || 'Go live';
        const dot = document.getElementById('statusDot');
        const label = document.getElementById('statusLabel');
        if (active.status === 'live' || active.isLive) {
          dot?.classList.add('live');
          if (label) label.textContent = 'Live';
          startDashboardAnalytics(active.roomSlug);
        } else {
          clearInterval(analyticsPollTimer);
        }
        const raw = sessionStorage.getItem('researchium_studio_session');
        if (!raw && active.roomSlug) {
          dashboardApi.getMeeting(active.roomSlug).then((m) => auth.saveStudioSession(m)).catch(() => {});
        }
      }
    }

    async function loadDashboard() {
      const data = await dashboardApi.getDashboard();
      applyDashboard(data);
      return data;
    }

    // -----------------------------
    // Destinations (Restream-like mock)
    // -----------------------------
    const DEST_LS_CONNECTIONS = 'researchium_dest_connections_v1';
    const DEST_LS_TOGGLES = 'researchium_dest_toggles_v1';

    const DESTINATIONS = [
      { key: 'youtube', name: 'YouTube', icon: '▶', defaultRtmp: 'rtmp://a.rtmp.youtube.com/live2', username: '@YouTubeHost' },
      { key: 'twitch', name: 'Twitch', icon: '🎮', defaultRtmp: 'rtmp://live.twitch.tv/app', username: '@TwitchStreamer' },
      { key: 'facebook', name: 'Facebook Live', icon: 'FB', defaultRtmp: 'rtmp://live-api-s.facebook.com:80/rtmp/', username: '@FacebookHost' },
      { key: 'linkedin', name: 'LinkedIn', icon: 'IN', defaultRtmp: 'rtmp://rtmp.linkedin.com/live', username: '@LinkedInHost' },
      { key: 'twitter', name: 'Twitter/X', icon: '𝕏', defaultRtmp: 'rtmp://upload.twitter.com/live', username: '@XHost' },
      { key: 'tiktok', name: 'TikTok', icon: '♪', defaultRtmp: 'rtmp://webcast-api.tiktok.com/live', username: '@TikTokHost' },
      { key: 'instagram', name: 'Instagram Live', icon: '📸', defaultRtmp: 'rtmp://instagram-rtmp.example/live', username: '@InstagramHost' },
      { key: 'kick', name: 'Kick', icon: '⚡', defaultRtmp: 'rtmp://video.kick.com/app', username: '@KickHost' },
      { key: 'custom', name: 'Custom RTMP', icon: '⚙', defaultRtmp: 'rtmp://127.0.0.1:1935/live', username: '@CustomRTMP' },
    ];

    const destState = {
      connections: safeJsonParse(safeLsGet(DEST_LS_CONNECTIONS), {}),
      toggles: safeJsonParse(safeLsGet(DEST_LS_TOGGLES), {}),
    };

    function persistDestState() {
      safeLsSet(DEST_LS_CONNECTIONS, JSON.stringify(destState.connections));
      safeLsSet(DEST_LS_TOGGLES, JSON.stringify(destState.toggles));
    }

    function getDest(key) {
      return DESTINATIONS.find((d) => d.key === key) || null;
    }

    function computeEnabledPlatforms() {
      return DESTINATIONS.filter((d) => {
        const conn = destState.connections[d.key];
        return Boolean(destState.toggles[d.key]) && conn?.connected === true;
      });
    }

    function setGoLiveUI() {
      const btn = document.getElementById('btnGoLiveAll');
      const enabled = computeEnabledPlatforms();
      const count = enabled.length;
      if (btn) {
        btn.textContent = `● Go live to ${count} platform${count === 1 ? '' : 's'}`;
        btn.classList.toggle('is-ready', count >= 2);
      }
      renderActiveDestinationsRow();
    }

    // Modal state
    let modalPlatformKey = null;
    const destinationsModal = document.getElementById('destinationsConnectModal');
    const modalTitle = document.getElementById('destinationsConnectTitle');
    const modalClose = document.getElementById('destinationsConnectClose');
    const modalCancel = document.getElementById('destinationsConnectCancel');
    const modalSave = document.getElementById('destinationsConnectSave');
    const modalStreamKey = document.getElementById('destinationsStreamKey');
    const modalRtmpUrl = document.getElementById('destinationsRtmpUrl');

    function openConnectModal(platformKey) {
      const d = getDest(platformKey);
      if (!d) return;
      modalPlatformKey = platformKey;
      if (modalTitle) modalTitle.textContent = `Connect ${d.name}`;

      const conn = destState.connections[platformKey] || {};
      if (modalStreamKey) modalStreamKey.value = '';
      if (modalRtmpUrl) modalRtmpUrl.value = conn.rtmpUrl || d.defaultRtmp;

      if (destinationsModal) {
        destinationsModal.hidden = false;
        destinationsModal.setAttribute('aria-hidden', 'false');
      }
      document.body.style.overflow = 'hidden';
      modalStreamKey?.focus();
    }

    function closeConnectModal() {
      modalPlatformKey = null;
      if (destinationsModal) {
        destinationsModal.hidden = true;
        destinationsModal.setAttribute('aria-hidden', 'true');
      }
      document.body.style.overflow = '';
    }

    modalClose?.addEventListener('click', closeConnectModal);
    modalCancel?.addEventListener('click', closeConnectModal);
    destinationsModal?.addEventListener('click', (e) => {
      if (e.target === destinationsModal) closeConnectModal();
    });

    modalSave?.addEventListener('click', () => {
      if (!modalPlatformKey) return;
      const d = getDest(modalPlatformKey);
      if (!d) return;

      const streamKey = String(modalStreamKey?.value || '').trim();
      const rtmpUrl = String(modalRtmpUrl?.value || '').trim();

      // Mock validation: keys/URLs must not be empty.
      if (!streamKey || !rtmpUrl) {
        destState.connections[d.key] = {
          connected: false,
          error: true,
          errorMessage: 'Stream Key and RTMP URL are required.',
          rtmpUrl,
        };
        destState.toggles[d.key] = false;
        persistDestState();
        renderDestinationsMock();
        setGoLiveUI();
        showToast(`${d.name}: Please enter Stream Key and RTMP URL.`, 'error');
        return;
      }

      destState.connections[d.key] = {
        connected: true,
        error: false,
        errorMessage: '',
        username: d.username,
        streamKey,
        rtmpUrl,
      };
      // Connected platforms are enabled by default for the next stream.
      destState.toggles[d.key] = true;
      persistDestState();
      renderDestinationsMock();
      setGoLiveUI();
      closeConnectModal();
      showToast(`${d.name} connected.`, 'success');
    });

    function disconnectPlatform(platformKey) {
      if (!getDest(platformKey)) return;
      delete destState.connections[platformKey];
      destState.toggles[platformKey] = false;
      persistDestState();
      renderDestinationsMock();
      setGoLiveUI();
      showToast('Disconnected.', 'success');
    }

    function buildPlatformCard(d) {
      const conn = destState.connections[d.key];
      const connected = Boolean(conn?.connected);
      const error = Boolean(conn?.error);
      const username = conn?.username || d.username;

      const card = document.createElement('div');
      card.className = 'platform-card';
      // Fade only truly "Not connected" platforms (error stays visible).
      if (!connected && !error) card.classList.add('is-disabled');
      card.dataset.platformKey = d.key;

      // Header
      const head = document.createElement('div');
      head.className = 'platform-card-head platform-card-head';

      const logo = document.createElement('div');
      logo.className = 'platform-logo';
      logo.textContent = d.icon;

      const meta = document.createElement('div');
      meta.className = 'platform-meta';

      const nameRow = document.createElement('div');
      nameRow.className = 'platform-name';
      nameRow.textContent = d.name;

      const statusRow = document.createElement('div');
      statusRow.className = 'platform-status';

      const dot = document.createElement('span');
      dot.className = 'status-dot';
      if (connected) dot.classList.add('status-dot--connected');
      else if (error) dot.classList.add('status-dot--error');

      const statusText = connected ? 'Connected' : error ? 'Error' : 'Not connected';
      const statusSpan = document.createElement('span');
      statusSpan.textContent = statusText;

      statusRow.appendChild(dot);
      statusRow.appendChild(statusSpan);
      if (connected) {
        const user = document.createElement('span');
        user.className = 'platform-username';
        user.textContent = ` ${username}`;
        statusRow.appendChild(user);
      }

      meta.appendChild(nameRow);
      meta.appendChild(statusRow);

      head.appendChild(logo);
      head.appendChild(meta);

      // Toggle row
      const toggleRow = document.createElement('div');
      toggleRow.className = 'platform-toggle-row';

      const toggleLabel = document.createElement('div');
      toggleLabel.className = 'platform-toggle-label';
      toggleLabel.textContent = 'Use for next stream';

      const destSwitchLabel = document.createElement('label');
      destSwitchLabel.className = 'dest-switch';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'dest-toggle';
      input.dataset.platformKey = d.key;
      input.disabled = !connected;
      input.checked = Boolean(destState.toggles[d.key]) && connected;

      const slider = document.createElement('span');
      slider.className = 'dest-slider';

      destSwitchLabel.appendChild(input);
      destSwitchLabel.appendChild(slider);

      toggleRow.appendChild(toggleLabel);
      toggleRow.appendChild(destSwitchLabel);

      // Actions row
      const actions = document.createElement('div');
      actions.className = 'platform-actions';

      if (connected) {
        const disconnect = document.createElement('button');
        disconnect.type = 'button';
        disconnect.className = 'platform-disconnect-link';
        disconnect.textContent = 'Disconnect';
        disconnect.dataset.action = 'disconnect';
        disconnect.dataset.platformKey = d.key;
        actions.appendChild(disconnect);
      } else if (error) {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'platform-retry-btn';
        retry.textContent = 'Retry';
        retry.dataset.action = 'retry';
        retry.dataset.platformKey = d.key;
        actions.appendChild(retry);
      } else {
        const connect = document.createElement('button');
        connect.type = 'button';
        connect.className = 'btn btn-primary platform-connect-btn';
        connect.textContent = 'Connect';
        connect.dataset.action = 'connect';
        connect.dataset.platformKey = d.key;
        actions.appendChild(connect);
      }

      card.appendChild(head);
      card.appendChild(toggleRow);
      card.appendChild(actions);

      // Toggle listener (mock-only)
      input.addEventListener('change', () => {
        destState.toggles[d.key] = input.checked;
        persistDestState();
        setGoLiveUI();
        // Update card visual (faded/unchecked)
        // eslint-disable-next-line no-use-before-define
        renderDestinationsMock();
      });

      // Action listeners
      const connectBtn = actions.querySelector('[data-action="connect"]');
      connectBtn?.addEventListener('click', () => openConnectModal(d.key));
      const retryBtn = actions.querySelector('[data-action="retry"]');
      retryBtn?.addEventListener('click', () => openConnectModal(d.key));
      const disconnectBtn = actions.querySelector('[data-action="disconnect"]');
      disconnectBtn?.addEventListener('click', () => disconnectPlatform(d.key));

      return card;
    }

    function renderDestinationsMock() {
      const grid = document.getElementById('platformGrid');
      if (!grid) return;
      grid.innerHTML = '';
      DESTINATIONS.forEach((d) => {
        grid.appendChild(buildPlatformCard(d));
      });
    }

    document.getElementById('btnRefreshPlatforms')?.addEventListener('click', () => {
      renderDestinationsMock();
      setGoLiveUI();
    });

    document.getElementById('btnGoLiveAll')?.addEventListener('click', async () => {
      const enabled = computeEnabledPlatforms();
      const count = enabled.length;
      if (count < 2) {
        showToast('Select at least 2 connected platforms to go live everywhere.', 'error');
        return;
      }

      const box = document.getElementById('multistreamIngest');
      if (box) {
        box.hidden = false;
        box.textContent = JSON.stringify(
          enabled.map((d) => {
            const conn = destState.connections[d.key];
            return {
              platform: d.name,
              username: conn?.username || d.username,
              rtmpUrl: conn?.rtmpUrl || d.defaultRtmp,
            };
          }),
          null,
          2
        );
      }

      showToast(`Mock: Go live to ${count} platforms.`, 'success');
      // Keep UI button state synced.
      setGoLiveUI();
    });

    function mountReactComponents(activeSlug) {
      const loader = window.ResearchiumStreamComponentsLoader;
      if (!loader) return Promise.resolve(false);
      return loader.init({
        roomSlug: activeSlug,
        showGoLive: true,
        viewerEl: document.getElementById('reactViewerMount'),
        viewerCompact: true,
        intervalMs: 5000,
        onBundleMissing: showBuildBanner,
        onGoLiveResult: (result) => {
          lastBroadcastId = result.broadcastId;
          const box = document.getElementById('multistreamIngest');
          if (box) {
            box.hidden = false;
            box.textContent =
              JSON.stringify(result.ingest, null, 2) +
              '\n\n' +
              (result.targets || [])
                .map((t) =>
                  t.ok
                    ? `✓ ${t.platform}: ${t.playbackUrl || t.rtmpUrl || 'ready'}`
                    : `✗ ${t.platform}: ${t.error}`
                )
                .join('\n');
          }
          loadDashboard();
          showToast(result.status === 'live' ? 'Live on connected platforms!' : `Status: ${result.status}`);
        },
      });
    }

    async function bootstrapMeetingIfNeeded() {
      try {
        const raw = sessionStorage.getItem('researchium_studio_session');
        if (raw && JSON.parse(raw).roomSlug) return;
      } catch {
        /* ignore */
      }
      await auth.bootstrapMeeting();
    }

    auth
      .ensureSignedIn()
      .then(() => bootstrapMeetingIfNeeded())
      .then(async () => {
        const dash = await loadDashboard();
        const slug = dash?.activeMeeting?.roomSlug;
        const mounted = await mountReactComponents(slug);
        if (mounted) {
          document.getElementById('viewerCount')?.closest('span')?.setAttribute('hidden', '');
          document.getElementById('viewerBreakdown')?.setAttribute('hidden', '');
          // Ensure mock destinations UI is visible regardless of React bundle status.
          const grid = document.getElementById('platformGrid');
          if (grid) grid.hidden = false;
          renderDestinationsMock();
          setGoLiveUI();
        } else {
          showBuildBanner();
          const grid = document.getElementById('platformGrid');
          if (grid) grid.hidden = false;
          renderDestinationsMock();
          setGoLiveUI();
        }
      })
      .catch((err) => {
        if (err?.message === 'sign_in_required' || err?.status === 401) {
          location.replace('studio-lobby.html?manual=1');
          return;
        }
        const user = auth.getUser();
        if (user) applyDashboard({ user, streams: [], activeMeeting: null });
        showToast(
          'Dashboard could not load all data. Start the Stream API: cd Researchium_stream && npm run dev:api',
          'error'
        );
      });

    function showPanel(panelId) {
      document.querySelectorAll('.nav-item[data-panel]').forEach((n) => {
        n.classList.toggle('active', n.dataset.panel === panelId);
      });
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      document.getElementById('panel-' + panelId)?.classList.add('active');
      document.getElementById('pageTitle').textContent = titles[panelId] || 'Studio';
    }

    if (params.get('panel') === 'destinations') showPanel('destinations');
    if (params.get('oauth') === 'connected') {
      showPanel('destinations');
      renderDestinationsMock();
      setGoLiveUI();
    }

    const modal = document.getElementById('newStreamModal');
    const stepChoose = document.getElementById('modalStepChoose');
    const stepRtmp = document.getElementById('modalStepRtmp');
    const stepSoon = document.getElementById('modalStepSoon');
    const stepSchedule = document.getElementById('modalStepSchedule');

    function populateSchedulePlatformChecks() {
      const wrap = document.getElementById('schedulePlatformChecks');
      if (!wrap) return;
      wrap.innerHTML = '';
      const connected = DESTINATIONS.filter((d) => destState.connections[d.key]?.connected);
      const list = connected.length ? connected : DESTINATIONS.slice(0, 3);
      list.forEach((d) => {
        const label = document.createElement('label');
        label.className = 'schedule-platform-check';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = 'schedulePlatform';
        input.value = d.key;
        input.checked = Boolean(destState.connections[d.key]?.connected);
        label.appendChild(input);
        label.appendChild(document.createTextNode(` ${d.name}`));
        wrap.appendChild(label);
      });
    }

    function updateScheduleNotifyHint() {
      const hint = document.getElementById('scheduleNotifyHint');
      const checked = document.getElementById('scheduleNotify')?.checked;
      if (!hint) return;
      hint.classList.toggle('is-hidden', !checked);
    }

    function openScheduleModal(opts = {}) {
      populateSchedulePlatformChecks();
      const form = document.getElementById('scheduleForm');
      form?.reset();
      const dateEl = document.getElementById('scheduleDate');
      const timeEl = document.getElementById('scheduleTime');
      if (dateEl) dateEl.value = opts.date || formatScheduleDateInput(new Date());
      if (timeEl) timeEl.value = opts.time || '19:00';
      const notify = document.getElementById('scheduleNotify');
      if (notify) notify.checked = true;
      updateScheduleNotifyHint();
      showModalStep(stepSchedule);
      modal.hidden = false;
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      document.getElementById('scheduleTitle')?.focus();
    }

    function openModal() {
      stepChoose.classList.add('active');
      stepRtmp.classList.remove('active');
      stepSoon.classList.remove('active');
      stepSchedule?.classList.remove('active');
      modal.hidden = false;
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      document.getElementById('modalClose')?.focus();
    }

    function closeModal() {
      modal.classList.remove('open');
      modal.hidden = true;
      document.body.style.overflow = '';
    }

    function showModalStep(stepEl) {
      [stepChoose, stepRtmp, stepSoon, stepSchedule].forEach((s) => s?.classList.remove('active'));
      stepEl?.classList.add('active');
    }

    document.getElementById('btnSchedule')?.addEventListener('click', () => openScheduleModal());

    document.getElementById('btnNewStream')?.addEventListener('click', () => {
      auth
        .openBrowserStudio({ forceNew: true })
        .catch(() => showToast('Could not start studio. Is the stream API running?', 'error'));
    });
    document.getElementById('modalClose')?.addEventListener('click', closeModal);
    document.querySelectorAll('.modal-close-inner, .modal-close-schedule').forEach((btn) => {
      btn.addEventListener('click', closeModal);
    });
    document.getElementById('scheduleNotify')?.addEventListener('change', updateScheduleNotifyHint);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });

    document.getElementById('modalBack')?.addEventListener('click', () => showModalStep(stepChoose));
    document.querySelector('.modal-back-soon')?.addEventListener('click', () => showModalStep(stepChoose));

    document.querySelectorAll('.stream-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const choice = btn.dataset.choice;
        if (choice === 'rtmp') {
          showModalStep(stepRtmp);
        } else if (choice === 'prerecorded') {
          showModalStep(stepSoon);
        }
      });
    });

    document.getElementById('btnRtmpDone')?.addEventListener('click', () => {
      closeModal();
      showPanel('go-live');
    });

    document.getElementById('btnCreateFirstStream')?.addEventListener('click', openModal);

    if (params.get('new') === '1') {
      showPanel('streams');
      openModal();
    }

    function renderActiveDestinationsRow() {
      const row = document.getElementById('activeDestinationsRow');
      const total = document.getElementById('activeDestinationsTotal');
      if (!row || !total) return;
      row.innerHTML = '';

      const connected = DESTINATIONS.filter((d) => destState.connections[d.key]?.connected);
      if (!connected.length) {
        row.innerHTML = '<span class="empty-destination-note">No connected destinations yet. Open Destinations to connect platforms.</span>';
        total.textContent = 'Streaming to 0 platforms';
        return;
      }

      connected.forEach((d) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'destination-chip' + (destState.toggles[d.key] ? ' active' : '');
        chip.dataset.platformKey = d.key;
        chip.textContent = d.icon;
        chip.title = d.name;
        chip.setAttribute('aria-label', d.name);
        chip.addEventListener('click', () => {
          destState.toggles[d.key] = !destState.toggles[d.key];
          persistDestState();
          setGoLiveUI();
          renderDestinationsMock();
        });
        row.appendChild(chip);
      });

      const enabled = computeEnabledPlatforms().length;
      total.textContent = `Streaming to ${enabled} platform${enabled === 1 ? '' : 's'}`;
    }

    function setPermissionState() {
      const el = document.getElementById('browserPermissionStatus');
      if (!el || !studioMedia) return;
      if (studioMedia.isGranted()) {
        el.textContent = '🟢 Mic/camera allowed';
        return;
      }
      el.textContent = '🟠 Permission needed';
    }

    function initGoLiveSetup() {
      const drop = document.getElementById('thumbnailDropzone');
      const input = document.getElementById('thumbnailInput');
      const img = document.getElementById('thumbnailPreview');
      const hint = document.getElementById('thumbnailHint');
      const streamTitleInput = document.getElementById('streamTitleInput');

      function applyThumb(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => {
          img.src = reader.result;
          img.hidden = false;
          hint.hidden = true;
        };
        reader.readAsDataURL(file);
      }

      input?.addEventListener('change', () => applyThumb(input.files?.[0]));
      drop?.addEventListener('dragover', (e) => {
        e.preventDefault();
        drop.classList.add('drag-over');
      });
      drop?.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
      drop?.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.classList.remove('drag-over');
        applyThumb(e.dataTransfer?.files?.[0]);
      });

      if (params.get('studio') === '1') {
        showPanel('go-live');
        const raw = sessionStorage.getItem('researchium_studio_session');
        if (raw) {
          try {
            const s = JSON.parse(raw);
            const title = s.stream?.title || '';
            if (title && streamTitleInput) streamTitleInput.value = title;
            document.getElementById('pageTitle').textContent = title || 'Go live';
          } catch {
            /* ignore */
          }
        }
      }
    }

    function createStreamKey() {
      const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      const make = () =>
        Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
      return `${make()}-${make()}-${make()}-${make()}`;
    }

    const STREAM_KEY_LS = 'researchium_encoder_stream_key_v1';
    let currentStreamKey = safeLsGet(STREAM_KEY_LS) || createStreamKey();

    function updateStreamKeyUi(masked = true) {
      const keyEl = document.getElementById('streamKeyDisplay');
      const revealBtn = document.getElementById('btnRevealKey');
      if (!keyEl) return;
      if (masked) {
        keyEl.textContent = '••••-••••-••••-••••';
        if (revealBtn) revealBtn.textContent = 'Show';
      } else {
        keyEl.textContent = currentStreamKey;
        if (revealBtn) revealBtn.textContent = 'Hide';
      }
    }

    function bindEncoderActions() {
      updateStreamKeyUi(true);
      safeLsSet(STREAM_KEY_LS, currentStreamKey);

      document.getElementById('btnCopyRtmp')?.addEventListener('click', () => {
        copyText('rtmp://127.0.0.1:1935/live', document.getElementById('btnCopyRtmp'));
      });
      document.getElementById('btnRevealKey')?.addEventListener('click', () => {
        const reveal = document.getElementById('btnRevealKey');
        const nowMasked = reveal?.textContent === 'Hide';
        updateStreamKeyUi(!nowMasked);
      });
      document.getElementById('btnCopyStreamKey')?.addEventListener('click', () => {
        copyText(currentStreamKey, document.getElementById('btnCopyStreamKey'));
      });
      document.getElementById('btnRegenerateKey')?.addEventListener('click', () => {
        currentStreamKey = createStreamKey();
        safeLsSet(STREAM_KEY_LS, currentStreamKey);
        const reveal = document.getElementById('btnRevealKey');
        const shouldMask = reveal?.textContent !== 'Hide';
        updateStreamKeyUi(shouldMask);
        showToast('Stream key regenerated.');
      });
    }

    let goLiveIsLive = false;
    let liveSeconds = 0;
    let liveTicker = null;
    let bitrateTicker = null;

    function setLiveUi(nextLive) {
      goLiveIsLive = nextLive;
      const dot = document.getElementById('statusDot');
      const label = document.getElementById('statusLabel');
      const btn = document.getElementById('goLiveBtn');
      const endBtn = document.getElementById('btnEndStream');

      if (nextLive) {
        dot?.classList.add('live');
        if (label) label.textContent = 'LIVE';
        if (btn) {
          btn.textContent = '● Live now';
          btn.disabled = true;
        }
        if (endBtn) endBtn.hidden = false;
        liveSeconds = 0;
        document.getElementById('duration').textContent = '00:00:00';
        liveTicker = setInterval(() => {
          liveSeconds += 1;
          const h = String(Math.floor(liveSeconds / 3600)).padStart(2, '0');
          const m = String(Math.floor((liveSeconds % 3600) / 60)).padStart(2, '0');
          const s = String(liveSeconds % 60).padStart(2, '0');
          document.getElementById('duration').textContent = `${h}:${m}:${s}`;
        }, 1000);
        bitrateTicker = setInterval(() => {
          const next = 3200 + Math.floor(Math.random() * 1800);
          document.getElementById('bitrate').textContent = `${next} kbps`;
        }, 2500);
      } else {
        dot?.classList.remove('live');
        if (label) label.textContent = 'Offline';
        if (btn) {
          btn.textContent = '● Go live';
          btn.disabled = false;
        }
        if (endBtn) endBtn.hidden = true;
        clearInterval(liveTicker);
        clearInterval(bitrateTicker);
        document.getElementById('duration').textContent = '00:00:00';
        document.getElementById('bitrate').textContent = '— kbps';
      }
    }

    async function runCountdown() {
      const overlay = document.getElementById('goLiveCountdown');
      const text = document.getElementById('goLiveCountdownText');
      if (!overlay || !text) return;
      overlay.hidden = false;
      for (const step of ['3', '2', '1', 'LIVE!']) {
        text.textContent = step;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
      overlay.hidden = true;
    }

    async function initStudioPreview() {
      const video = document.getElementById('studioLiveVideo');
      const placeholder = document.getElementById('previewPlaceholder');
      setPermissionState();
      if (!video || !studioMedia) return;

      if (sessionStorage.getItem('researchium_media_granted') === '1') {
        try {
          await studioMedia.requestAccess(studioMedia.loadPrefs());
          studioMedia.attachPreview(video);
          video.hidden = false;
          if (placeholder) placeholder.hidden = true;
          setPermissionState();
        } catch {
          setPermissionState();
        }
      }
    }

    // -----------------------------
    // Unified Chat (Restream-like)
    // -----------------------------
    let unifiedChatInitialized = false;
    let unifiedChatSimTimer = null;
    let unifiedChatClockTimer = null;
    let pinnedDismissTimer = null;
    let chatCounts = {};
    let chatFilter = {}; // platformKey -> boolean (show)
    let lastPinnedMsg = null;

    const PLATFORM_BADGE = {
      youtube: { label: 'Y', cls: 'platform-badge--youtube' },
      twitch: { label: 'T', cls: 'platform-badge--twitch' },
      facebook: { label: 'F', cls: 'platform-badge--facebook' },
      linkedin: { label: 'L', cls: 'platform-badge--linkedin' },
      twitter: { label: 'X', cls: 'platform-badge--twitter' },
      tiktok: { label: '♪', cls: 'platform-badge--tiktok' },
      instagram: { label: 'IG', cls: 'platform-badge--instagram' },
      kick: { label: 'K', cls: 'platform-badge--kick' },
      custom: { label: 'C', cls: 'platform-badge--custom' },
    };

    const CHAT_NAMES = [
      'Aarav', 'Diya', 'Rahul', 'Priya', 'Amit', 'Neha', 'Rohan', 'Deepika', 'Sanya', 'Kabir',
      'Tara', 'Vikram', 'Meera', 'Arjun', 'Isha', 'Nikhil', 'Ananya', 'Aditya',
    ];

    const CHAT_TEXTS = [
      'Great explanation!',
      'Can you clarify the last step?',
      'This example helped a lot.',
      'What happens if we change the assumption?',
      'Sir/Maam, please repeat that part.',
      'Nice! Any resources for practice?',
      'Thanks for the live session.',
      'Does this work for edge cases too?',
      'That was super helpful.',
    ];

    function getConnectedPlatformKeys() {
      return DESTINATIONS.filter((d) => destState.connections[d.key]?.connected).map((d) => d.key);
    }

    function formatRelativeTime(ts) {
      const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
      if (s < 60) return `${s}s ago`;
      const m = Math.floor(s / 60);
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      return `${h}h ago`;
    }

    function updateChatTimeLabels() {
      const feed = document.getElementById('chatFeed');
      if (!feed) return;
      feed.querySelectorAll('.chat-message').forEach((node) => {
        const ts = Number(node.dataset.createdAt || '0');
        const timeEl = node.querySelector('.chat-time');
        if (timeEl && ts) timeEl.textContent = formatRelativeTime(ts);
      });
    }

    function applyChatFiltersToFeed() {
      const feed = document.getElementById('chatFeed');
      if (!feed) return;
      feed.querySelectorAll('.chat-message').forEach((node) => {
        const key = node.dataset.platformKey;
        const show = Boolean(chatFilter[key]);
        // Hidden messages stay in DOM so counts/pinning can still work.
        node.hidden = !show;
      });
    }

    function updateChatCountsUi(platformKey) {
      const el = document.getElementById(`chatCount_${platformKey}`);
      if (!el) return;
      el.textContent = String(chatCounts[platformKey] ?? 0);
    }

    function ensureChatPlatformListRendered() {
      const list = document.getElementById('chatPlatformList');
      if (!list) return;

      const connectedKeys = getConnectedPlatformKeys();
      const hasPlatforms = connectedKeys.length > 0;

      list.innerHTML = '';

      if (!hasPlatforms) {
        list.innerHTML = '<div class="chat-platform-empty">Connect destinations to enable unified chat.</div>';
        stopUnifiedChatSimulation();
        const allToggle = document.getElementById('chatAllPlatformsToggle');
        if (allToggle) allToggle.checked = false;
        // Disable per-platform filtering until platforms exist.
        const simToggle = document.getElementById('chatSimulateToggle');
        if (simToggle) simToggle.disabled = true;
        return;
      }

      const simToggle = document.getElementById('chatSimulateToggle');
      if (simToggle) simToggle.disabled = false;

      connectedKeys.forEach((key) => {
        if (chatCounts[key] == null) chatCounts[key] = 0;
        if (chatFilter[key] == null) chatFilter[key] = true;

        const row = document.createElement('label');
        row.className = 'chat-platform-item';

        const left = document.createElement('div');
        left.className = 'chat-platform-left';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.platformKey = key;
        checkbox.checked = Boolean(chatFilter[key]);
        checkbox.addEventListener('change', () => {
          chatFilter[key] = checkbox.checked;
          // Master toggle sync.
          const keys = getConnectedPlatformKeys();
          const allOn = keys.length > 0 && keys.every((k) => chatFilter[k]);
          const master = document.getElementById('chatAllPlatformsToggle');
          if (master) master.checked = allOn;
          applyChatFiltersToFeed();
        });

        const badge = document.createElement('span');
        const meta = PLATFORM_BADGE[key] || PLATFORM_BADGE.custom;
        badge.className = `platform-badge ${meta.cls}`;
        badge.textContent = meta.label;

        const name = getDest(key)?.name || key;
        const nameEl = document.createElement('span');
        nameEl.className = 'chat-platform-name';
        nameEl.textContent = name;

        left.appendChild(checkbox);
        left.appendChild(badge);
        left.appendChild(nameEl);

        const count = document.createElement('span');
        count.className = 'chat-count';
        count.id = `chatCount_${key}`;
        count.textContent = String(chatCounts[key] ?? 0);

        row.appendChild(left);
        row.appendChild(count);
        list.appendChild(row);
      });

      const master = document.getElementById('chatAllPlatformsToggle');
      if (master) master.checked = connectedKeys.every((k) => Boolean(chatFilter[k]));
    }

    function closePinnedMessage() {
      const overlay = document.getElementById('pinnedMessageOverlay');
      if (overlay) overlay.hidden = true;
      lastPinnedMsg = null;
      if (pinnedDismissTimer) clearTimeout(pinnedDismissTimer);
      pinnedDismissTimer = null;
    }

    function renderPinnedMessage(msg) {
      lastPinnedMsg = msg;
      const overlay = document.getElementById('pinnedMessageOverlay');
      const body = document.getElementById('pinnedMessageBody');
      if (!overlay || !body) return;

      const meta = PLATFORM_BADGE[msg.platformKey] || PLATFORM_BADGE.custom;
      body.innerHTML = '';

      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.gap = '8px';

      const head = document.createElement('div');
      head.style.display = 'flex';
      head.style.alignItems = 'center';
      head.style.gap = '10px';

      const badge = document.createElement('span');
      badge.className = `platform-badge ${meta.cls}`;
      badge.textContent = meta.label;

      const username = document.createElement('div');
      username.style.fontWeight = '900';
      username.style.color = '#fff';
      username.textContent = msg.username;

      head.appendChild(badge);
      head.appendChild(username);

      const text = document.createElement('div');
      text.className = 'chat-text';
      text.style.paddingRight = '0';
      text.textContent = msg.text;

      const time = document.createElement('div');
      time.className = 'chat-time';
      time.textContent = formatRelativeTime(msg.createdAt);

      wrapper.appendChild(head);
      wrapper.appendChild(text);
      wrapper.appendChild(time);
      body.appendChild(wrapper);

      overlay.hidden = false;
      if (pinnedDismissTimer) clearTimeout(pinnedDismissTimer);
      pinnedDismissTimer = setTimeout(closePinnedMessage, 30000);
    }

    function pinMessage(msg) {
      renderPinnedMessage(msg);
    }

    function renderChatMessage(msg) {
      const feed = document.getElementById('chatFeed');
      if (!feed) return;

      const msgEl = document.createElement('div');
      msgEl.className = 'chat-message';
      msgEl.dataset.platformKey = msg.platformKey;
      msgEl.dataset.createdAt = String(msg.createdAt);

      const meta = PLATFORM_BADGE[msg.platformKey] || PLATFORM_BADGE.custom;

      const head = document.createElement('div');
      head.className = 'chat-message-head';

      const badge = document.createElement('span');
      badge.className = `platform-badge ${meta.cls}`;
      badge.textContent = meta.label;

      const username = document.createElement('div');
      username.className = 'chat-username';
      username.textContent = msg.username;

      head.appendChild(badge);
      head.appendChild(username);

      const pinBtn = document.createElement('button');
      pinBtn.type = 'button';
      pinBtn.className = 'chat-pin-btn';
      pinBtn.textContent = 'Pin to screen';
      pinBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        pinMessage(msg);
      });

      const text = document.createElement('div');
      text.className = 'chat-text';
      text.textContent = msg.text;

      const time = document.createElement('div');
      time.className = 'chat-time';
      time.textContent = formatRelativeTime(msg.createdAt);

      msgEl.appendChild(head);
      msgEl.appendChild(pinBtn);
      msgEl.appendChild(text);
      msgEl.appendChild(time);

      const nearBottom = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 60;
      feed.appendChild(msgEl);
      if (!chatFilter[msg.platformKey]) msgEl.hidden = true;
      if (nearBottom) feed.scrollTop = feed.scrollHeight;
    }

    function simulateChatTick() {
      const simToggle = document.getElementById('chatSimulateToggle');
      if (!simToggle?.checked) return;

      const connectedKeys = getConnectedPlatformKeys();
      if (!connectedKeys.length) return;

      const platformKey = connectedKeys[Math.floor(Math.random() * connectedKeys.length)];
      const username = CHAT_NAMES[Math.floor(Math.random() * CHAT_NAMES.length)];
      const text = CHAT_TEXTS[Math.floor(Math.random() * CHAT_TEXTS.length)];

      const msg = {
        id: `m_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        platformKey,
        username,
        text,
        createdAt: Date.now(),
      };

      // Update counts regardless of platform filter.
      chatCounts[platformKey] = (chatCounts[platformKey] ?? 0) + 1;
      updateChatCountsUi(platformKey);

      renderChatMessage(msg);

      const nextDelay = 3000 + Math.random() * 2000;
      unifiedChatSimTimer = setTimeout(simulateChatTick, nextDelay);
    }

    function startUnifiedChatSimulation() {
      stopUnifiedChatSimulation();
      const simToggle = document.getElementById('chatSimulateToggle');
      if (!simToggle?.checked) return;
      unifiedChatSimTimer = setTimeout(simulateChatTick, 800);
    }

    function stopUnifiedChatSimulation() {
      if (unifiedChatSimTimer) clearTimeout(unifiedChatSimTimer);
      unifiedChatSimTimer = null;
    }

    function ensureChatControlsBound() {
      const simToggle = document.getElementById('chatSimulateToggle');
      const masterToggle = document.getElementById('chatAllPlatformsToggle');
      const replyInput = document.getElementById('chatReplyInput');
      const sendBtn = document.getElementById('chatSendBtn');
      const feed = document.getElementById('chatFeed');
      if (!simToggle || !masterToggle || !replyInput || !sendBtn || !feed) return;

      simToggle.addEventListener('change', () => {
        if (simToggle.checked) startUnifiedChatSimulation();
        else stopUnifiedChatSimulation();
      });

      masterToggle.addEventListener('change', () => {
        const keys = getConnectedPlatformKeys();
        keys.forEach((k) => {
          chatFilter[k] = masterToggle.checked;
        });
        // Reflect checkbox state in the current DOM.
        document.querySelectorAll('#chatPlatformList input[type="checkbox"][data-platform-key]').forEach((input) => {
          const k = input.dataset.platformKey;
          if (k) input.checked = Boolean(chatFilter[k]);
        });
        applyChatFiltersToFeed();
      });

      sendBtn.addEventListener('click', () => {
        const text = String(replyInput.value || '').trim();
        if (!text) return;
        replyInput.value = '';

        const sendKeys = getConnectedPlatformKeys();
        if (!sendKeys.length) {
          showToast('Select at least one platform to send.', 'error');
          return;
        }

        // Mock: send to all selected platforms.
        showToast('Sent to all platforms', 'success');

        sendKeys.forEach((platformKey) => {
          chatCounts[platformKey] = (chatCounts[platformKey] ?? 0) + 1;
          updateChatCountsUi(platformKey);
          renderChatMessage({
            id: `y_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            platformKey,
            username: 'You',
            text,
            createdAt: Date.now(),
          });
        });
      });

      replyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendBtn.click();
      });

      document.getElementById('pinnedMessageCloseBtn')?.addEventListener('click', closePinnedMessage);
    }

    function ensureUnifiedChat() {
      if (!unifiedChatInitialized) {
        unifiedChatInitialized = true;
        // Bind handlers.
        ensureChatControlsBound();
        // Relative clock updates.
        unifiedChatClockTimer = setInterval(updateChatTimeLabels, 1000);
      }

      // Always refresh sidebar in case destinations changed.
      ensureChatPlatformListRendered();
      applyChatFiltersToFeed();

      // Start simulation if enabled.
      const simToggle = document.getElementById('chatSimulateToggle');
      if (simToggle?.checked) startUnifiedChatSimulation();
    }

    // Expose for nav handler.
    window.ensureUnifiedChat = ensureUnifiedChat;

    // Initialize now (panel may be hidden).
    // (If the toggle is ON, this will start generating messages immediately.)

    document.querySelectorAll('.nav-item[data-panel]').forEach((btn) => {
      if (btn.dataset.panel === 'destinations') {
        btn.addEventListener('click', () => {
          renderDestinationsMock();
          setGoLiveUI();
        });
      }
      if (btn.dataset.panel === 'chat') {
        btn.addEventListener('click', () => {
          ensureUnifiedChat();
        });
      }
      if (btn.dataset.panel === 'analytics') {
        btn.addEventListener('click', () => initAnalyticsChart());
      }
      if (btn.dataset.panel === 'schedule') {
        btn.addEventListener('click', () => renderScheduleAll());
      }
      btn.addEventListener('click', () => showPanel(btn.dataset.panel));
    });

    document.getElementById('goLiveBtn')?.addEventListener('click', async () => {
      if (goLiveIsLive) return;
      const title = String(document.getElementById('streamTitleInput')?.value || '').trim();
      if (!title) {
        showToast('Please enter a stream title before going live.', 'error');
        document.getElementById('streamTitleInput')?.focus();
        return;
      }
      if (computeEnabledPlatforms().length < 1) {
        showToast('Select at least one active destination.', 'error');
        return;
      }
      await runCountdown();
      setLiveUi(true);
      showToast('You are now live.');
    });

    document.getElementById('btnEndStream')?.addEventListener('click', () => {
      setLiveUi(false);
      showToast('Stream ended.');
    });

    // -----------------------------
    // Analytics panel (mock chart)
    // -----------------------------
    const ANALYTICS_CHART = {
      labels: ['May 21', 'May 22', 'May 23', 'May 24', 'May 25', 'May 26', 'May 27'],
      youtube: [120, 165, 210, 190, 320, 280, 410],
      twitch: [42, 58, 55, 72, 95, 108, 128],
    };

    let analyticsChartBuilt = false;

    function buildBezierPath(points) {
      if (points.length < 2) return '';
      let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
      for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[i - 1] || points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] || p2;
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
      }
      return d;
    }

    function buildAreaPath(points, baselineY) {
      const line = buildBezierPath(points);
      if (!line || !points.length) return '';
      const last = points[points.length - 1];
      const first = points[0];
      return `${line} L ${last.x.toFixed(2)} ${baselineY} L ${first.x.toFixed(2)} ${baselineY} Z`;
    }

    function initAnalyticsChart() {
      if (analyticsChartBuilt) return;
      const svg = document.getElementById('analyticsChartSvg');
      const wrap = document.getElementById('analyticsChartWrap');
      const tooltip = document.getElementById('analyticsChartTooltip');
      if (!svg || !wrap) return;
      analyticsChartBuilt = true;

      const W = 720;
      const H = 280;
      const pad = { top: 24, right: 20, bottom: 40, left: 48 };
      const chartW = W - pad.left - pad.right;
      const chartH = H - pad.top - pad.bottom;
      const n = ANALYTICS_CHART.labels.length;

      const allVals = [...ANALYTICS_CHART.youtube, ...ANALYTICS_CHART.twitch];
      const maxY = Math.ceil((Math.max(...allVals) * 1.12) / 50) * 50 || 100;
      const ySteps = 4;

      const xAt = (i) => pad.left + (i / Math.max(n - 1, 1)) * chartW;
      const yAt = (v) => pad.top + chartH - (v / maxY) * chartH;
      const baseY = pad.top + chartH;

      const ns = 'http://www.w3.org/2000/svg';
      const mk = (tag, attrs) => {
        const el = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
      };

      svg.innerHTML = '';
      const dotsG = mk('g', { id: 'analyticsChartDots' });

      for (let i = 0; i <= ySteps; i += 1) {
        const val = Math.round((maxY / ySteps) * i);
        const y = yAt(val);
        svg.appendChild(
          mk('line', {
            class: 'analytics-chart-grid-line',
            x1: pad.left,
            x2: W - pad.right,
            y1: y,
            y2: y,
          })
        );
        const label = mk('text', {
          class: 'analytics-chart-y-label',
          x: pad.left - 8,
          y: y + 4,
          'text-anchor': 'end',
        });
        label.textContent = String(val);
        svg.appendChild(label);
      }

      ANALYTICS_CHART.labels.forEach((lbl, i) => {
        const text = mk('text', {
          class: 'analytics-chart-axis-label',
          x: xAt(i),
          y: H - 10,
          'text-anchor': 'middle',
        });
        text.textContent = lbl;
        svg.appendChild(text);
      });

      const ytPoints = ANALYTICS_CHART.youtube.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
      const twPoints = ANALYTICS_CHART.twitch.map((v, i) => ({ x: xAt(i), y: yAt(v) }));

      function addSeries(points, areaCls, lineCls) {
        svg.appendChild(mk('path', { class: `analytics-chart-area ${areaCls}`, d: buildAreaPath(points, baseY) }));
        svg.appendChild(mk('path', { class: `analytics-chart-line ${lineCls}`, d: buildBezierPath(points) }));
      }

      addSeries(ytPoints, 'analytics-chart-area--yt', 'analytics-chart-line--yt');
      addSeries(twPoints, 'analytics-chart-area--tw', 'analytics-chart-line--tw');
      svg.appendChild(dotsG);

      function hideTooltip() {
        if (tooltip) tooltip.hidden = true;
        dotsG.innerHTML = '';
      }

      function showTooltip(i) {
        if (!tooltip) return;
        const yt = ANALYTICS_CHART.youtube[i];
        const tw = ANALYTICS_CHART.twitch[i];
        tooltip.hidden = false;
        tooltip.innerHTML =
          `<strong>${escapeHtml(ANALYTICS_CHART.labels[i])}</strong>` +
          `<span>YouTube: <strong class="analytics-tooltip-yt">${escapeHtml(String(yt))}</strong> viewers</span>` +
          `<span>Twitch: <strong class="analytics-tooltip-tw">${escapeHtml(String(tw))}</strong> viewers</span>`;

        const svgRect = svg.getBoundingClientRect();
        const scaleX = svgRect.width / W;
        const scaleY = svgRect.height / H;
        tooltip.style.left = `${xAt(i) * scaleX}px`;
        tooltip.style.top = `${pad.top * scaleY}px`;

        dotsG.innerHTML = '';
        [
          [yt, 'analytics-chart-dot--yt'],
          [tw, 'analytics-chart-dot--tw'],
        ].forEach(([v, cls]) => {
          const c = mk('circle', {
            class: `analytics-chart-dot ${cls} analytics-chart-dot--visible`,
            cx: xAt(i),
            cy: yAt(v),
          });
          dotsG.appendChild(c);
        });
      }

      const bandW = chartW / Math.max(n - 1, 1);
      for (let i = 0; i < n; i += 1) {
        const bx = i === 0 ? pad.left : xAt(i) - bandW / 2;
        const width = i === 0 || i === n - 1 ? bandW / 2 + 2 : bandW;
        const band = mk('rect', {
          class: 'analytics-chart-hover-band',
          x: bx,
          y: pad.top,
          width,
          height: chartH,
        });
        band.addEventListener('mouseenter', () => showTooltip(i));
        band.addEventListener('mousemove', () => showTooltip(i));
        band.addEventListener('mouseleave', hideTooltip);
        svg.appendChild(band);
      }
    }

    if (params.get('panel') === 'analytics') {
      showPanel('analytics');
      initAnalyticsChart();
    }

    // -----------------------------
    // Schedule manager
    // -----------------------------
    const SCHEDULE_LS_KEY = 'researchium_schedule_v1';
    let scheduleViewMode = 'month';
    let scheduleCursor = new Date();
    scheduleCursor.setDate(1);
    scheduleCursor.setHours(0, 0, 0, 0);
    let selectedScheduleDayKey = null;

    function formatScheduleDateInput(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    function scheduleDateKey(d) {
      return formatScheduleDateInput(d);
    }

    function loadScheduleEvents() {
      return safeJsonParse(safeLsGet(SCHEDULE_LS_KEY), []);
    }

    function saveScheduleEvents(events) {
      safeLsSet(SCHEDULE_LS_KEY, JSON.stringify(events));
    }

    function initDemoScheduleIfNeeded() {
      if (safeLsGet(SCHEDULE_LS_KEY)) return;
      const now = new Date();
      const today7 = new Date(now);
      today7.setHours(19, 0, 0, 0);
      const tomorrow6 = new Date(now);
      tomorrow6.setDate(tomorrow6.getDate() + 1);
      tomorrow6.setHours(18, 0, 0, 0);

      saveScheduleEvents([
        {
          id: 'sch-demo-1',
          title: 'Real Analysis · Sequences',
          subject: 'Mathematics',
          startAt: today7.toISOString(),
          platforms: ['youtube', 'twitch'],
          repeat: 'none',
          description: '',
          notifyStudents: true,
        },
        {
          id: 'sch-demo-2',
          title: 'Molecular Biology · Central Dogma',
          subject: 'Biology',
          startAt: tomorrow6.toISOString(),
          platforms: ['youtube'],
          repeat: 'none',
          description: '',
          notifyStudents: true,
        },
      ]);
    }

    function isSameDay(a, b) {
      return a.toDateString() === b.toDateString();
    }

    function formatScheduleMonthLabel(d) {
      return d.toLocaleDateString([], { month: 'long', year: 'numeric' });
    }

    function formatScheduleDayHeading(d) {
      return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    }

    function formatScheduleTime(d) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    function formatUpcomingChip(startAt) {
      const d = new Date(startAt);
      const now = new Date();
      const time = formatScheduleTime(d).toUpperCase();
      if (isSameDay(d, now)) return `TODAY ${time}`;
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (isSameDay(d, tomorrow)) return `TOMORROW ${time}`;
      const day = d
        .toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
        .toUpperCase();
      return `${day} ${time}`;
    }

    function getMonthGridDays(cursor) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const first = new Date(year, month, 1);
      const start = new Date(first);
      start.setDate(first.getDate() - first.getDay());
      const days = [];
      for (let i = 0; i < 42; i += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        days.push(d);
      }
      return days;
    }

    function getWeekDays(cursor) {
      const today = new Date();
      const inMonth =
        today.getFullYear() === cursor.getFullYear() && today.getMonth() === cursor.getMonth();
      const ref = inMonth ? today : new Date(cursor.getFullYear(), cursor.getMonth(), 15);
      const start = new Date(ref);
      start.setDate(ref.getDate() - ref.getDay());
      const days = [];
      for (let i = 0; i < 7; i += 1) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        days.push(d);
      }
      return days;
    }

    function eventsOnDay(dayKey) {
      return loadScheduleEvents().filter((e) => scheduleDateKey(new Date(e.startAt)) === dayKey);
    }

    function renderPlatformIcons(container, platformKeys) {
      container.innerHTML = '';
      if (!platformKeys?.length) return;
      platformKeys.forEach((key) => {
        const meta = STREAM_PLATFORM_ICON[key] || STREAM_PLATFORM_ICON.custom;
        const icon = document.createElement('span');
        icon.className = `stream-platform-icon ${meta.cls}`;
        icon.textContent = meta.label;
        icon.title = key;
        container.appendChild(icon);
      });
    }

    function renderScheduleCalendar() {
      const grid = document.getElementById('scheduleCalendarGrid');
      const label = document.getElementById('scheduleMonthLabel');
      if (!grid) return;

      if (label) label.textContent = formatScheduleMonthLabel(scheduleCursor);

      const days = scheduleViewMode === 'week' ? getWeekDays(scheduleCursor) : getMonthGridDays(scheduleCursor);
      const today = new Date();
      const viewMonth = scheduleCursor.getMonth();
      const viewYear = scheduleCursor.getFullYear();

      grid.classList.toggle('schedule-calendar-grid--week', scheduleViewMode === 'week');
      grid.innerHTML = '';

      days.forEach((day) => {
        const key = scheduleDateKey(day);
        const events = eventsOnDay(key);
        const inMonth = day.getMonth() === viewMonth && day.getFullYear() === viewYear;

        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'schedule-day-cell';
        cell.setAttribute('role', 'gridcell');
        if (!inMonth && scheduleViewMode === 'month') cell.classList.add('schedule-day-cell--muted');
        if (isSameDay(day, today)) cell.classList.add('schedule-day-cell--today');
        if (key === selectedScheduleDayKey) cell.classList.add('schedule-day-cell--selected');

        const num = document.createElement('span');
        num.className = 'schedule-day-num';
        num.textContent = String(day.getDate());
        cell.appendChild(num);

        const eventsWrap = document.createElement('div');
        eventsWrap.className = 'schedule-day-events';
        events.slice(0, 2).forEach((ev) => {
          const row = document.createElement('div');
          row.className = 'schedule-day-event';
          const dot = document.createElement('span');
          dot.className = 'schedule-day-event-dot';
          row.appendChild(dot);
          const text = document.createElement('span');
          text.textContent = ev.title;
          row.appendChild(text);
          eventsWrap.appendChild(row);
        });
        if (events.length > 2) {
          const more = document.createElement('div');
          more.className = 'schedule-day-event';
          more.style.color = 'var(--text3)';
          more.textContent = `+${events.length - 2} more`;
          eventsWrap.appendChild(more);
        }
        cell.appendChild(eventsWrap);

        cell.addEventListener('click', () => {
          selectedScheduleDayKey = key;
          renderScheduleCalendar();
          openScheduleDaySidebar(day);
        });
        grid.appendChild(cell);
      });
    }

    function openScheduleDaySidebar(day) {
      const sidebar = document.getElementById('scheduleDaySidebar');
      const heading = document.getElementById('scheduleDayHeading');
      const list = document.getElementById('scheduleDayList');
      if (!sidebar || !list) return;

      const key = scheduleDateKey(day);
      const events = eventsOnDay(key).sort(
        (a, b) => new Date(a.startAt) - new Date(b.startAt)
      );

      if (heading) heading.textContent = formatScheduleDayHeading(day);
      list.innerHTML = '';

      if (!events.length) {
        list.innerHTML = '<p class="schedule-day-empty">No streams scheduled for this day.</p>';
      } else {
        events.forEach((ev) => {
          const card = document.createElement('div');
          card.className = 'schedule-day-card';
          const time = document.createElement('div');
          time.className = 'schedule-day-card-time';
          time.textContent = formatScheduleTime(new Date(ev.startAt));
          const title = document.createElement('div');
          title.className = 'schedule-day-card-title';
          title.textContent = ev.title;
          const plats = document.createElement('div');
          plats.className = 'schedule-day-card-platforms';
          renderPlatformIcons(plats, ev.platforms);
          card.append(time, title, plats);
          list.appendChild(card);
        });
      }

      sidebar.hidden = false;
      sidebar.dataset.selectedDate = key;
    }

    function closeScheduleDaySidebar() {
      const sidebar = document.getElementById('scheduleDaySidebar');
      if (sidebar) sidebar.hidden = true;
      selectedScheduleDayKey = null;
      renderScheduleCalendar();
    }

    function renderScheduleUpcoming() {
      const list = document.getElementById('scheduleUpcomingList');
      if (!list) return;
      const now = new Date();
      const upcoming = loadScheduleEvents()
        .filter((e) => new Date(e.startAt) >= now)
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
        .slice(0, 5);

      list.innerHTML = '';
      if (!upcoming.length) {
        list.innerHTML = '<p class="schedule-upcoming-empty">No upcoming streams scheduled.</p>';
        return;
      }

      const today = new Date();
      upcoming.forEach((ev) => {
        const row = document.createElement('div');
        row.className = 'schedule-upcoming-row';

        const chip = document.createElement('div');
        chip.className = 'schedule-time-chip';
        if (isSameDay(new Date(ev.startAt), today)) chip.classList.add('schedule-time-chip--today');
        chip.textContent = formatUpcomingChip(ev.startAt);

        const main = document.createElement('div');
        main.className = 'schedule-upcoming-main';
        const title = document.createElement('div');
        title.className = 'schedule-upcoming-title-text';
        title.textContent = ev.title;
        const subject = document.createElement('div');
        subject.className = 'schedule-upcoming-subject';
        subject.textContent = ev.subject;
        const plats = document.createElement('div');
        plats.className = 'schedule-upcoming-platforms';
        renderPlatformIcons(plats, ev.platforms);
        main.append(title, subject, plats);

        const actions = document.createElement('div');
        actions.className = 'schedule-upcoming-actions';
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-ghost btn-small';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const d = new Date(ev.startAt);
          openScheduleModal({
            date: formatScheduleDateInput(d),
            time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
          });
          document.getElementById('scheduleTitle').value = ev.title;
          document.getElementById('scheduleSubject').value = ev.subject;
          document.getElementById('scheduleDescription').value = ev.description || '';
          document.getElementById('scheduleRepeat').value = ev.repeat || 'none';
          document.getElementById('scheduleNotify').checked = Boolean(ev.notifyStudents);
          updateScheduleNotifyHint();
          document.querySelectorAll('#schedulePlatformChecks input').forEach((input) => {
            input.checked = (ev.platforms || []).includes(input.value);
          });
        });
        const liveBtn = document.createElement('button');
        liveBtn.type = 'button';
        liveBtn.className = 'btn btn-primary btn-small';
        liveBtn.textContent = 'Go live now';
        liveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showPanel('go-live');
          const titleInput = document.getElementById('streamTitleInput');
          if (titleInput) titleInput.value = ev.title;
          showToast('Stream setup opened. Click Go live when ready.');
        });
        actions.append(editBtn, liveBtn);

        row.append(chip, main, actions);
        list.appendChild(row);
      });
    }

    function renderScheduleAll() {
      renderScheduleCalendar();
      renderScheduleUpcoming();
    }

    function saveScheduleFromForm(e) {
      e.preventDefault();
      const title = String(document.getElementById('scheduleTitle')?.value || '').trim();
      const subject = document.getElementById('scheduleSubject')?.value || 'General Research';
      const date = document.getElementById('scheduleDate')?.value;
      const time = document.getElementById('scheduleTime')?.value;
      if (!title || !date || !time) {
        showToast('Please fill in title, date, and time.', 'error');
        return;
      }

      const [hh, mm] = time.split(':').map(Number);
      const start = new Date(`${date}T00:00:00`);
      start.setHours(hh, mm || 0, 0, 0);

      const platforms = [];
      document.querySelectorAll('#schedulePlatformChecks input:checked').forEach((input) => {
        platforms.push(input.value);
      });

      const events = loadScheduleEvents();
      events.push({
        id: `sch_${Date.now()}`,
        title,
        subject,
        startAt: start.toISOString(),
        platforms,
        repeat: document.getElementById('scheduleRepeat')?.value || 'none',
        description: document.getElementById('scheduleDescription')?.value || '',
        notifyStudents: Boolean(document.getElementById('scheduleNotify')?.checked),
      });
      saveScheduleEvents(events);

      closeModal();
      renderScheduleAll();
      const key = scheduleDateKey(start);
      selectedScheduleDayKey = key;
      openScheduleDaySidebar(start);
      showToast(
        document.getElementById('scheduleNotify')?.checked
          ? 'Class scheduled. Email notification will be sent.'
          : 'Class scheduled.'
      );
    }

    function bindScheduleUi() {
      document.querySelectorAll('[data-schedule-view]').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-schedule-view]').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          scheduleViewMode = btn.dataset.scheduleView || 'month';
          renderScheduleCalendar();
        });
      });

      document.getElementById('schedulePrevMonth')?.addEventListener('click', () => {
        scheduleCursor.setMonth(scheduleCursor.getMonth() - 1);
        renderScheduleCalendar();
      });
      document.getElementById('scheduleNextMonth')?.addEventListener('click', () => {
        scheduleCursor.setMonth(scheduleCursor.getMonth() + 1);
        renderScheduleCalendar();
      });
      document.getElementById('btnSchedulePanel')?.addEventListener('click', () => openScheduleModal());
      document.getElementById('scheduleSidebarClose')?.addEventListener('click', closeScheduleDaySidebar);
      document.getElementById('scheduleAddForDay')?.addEventListener('click', () => {
        const sidebar = document.getElementById('scheduleDaySidebar');
        const date = sidebar?.dataset.selectedDate || formatScheduleDateInput(new Date());
        openScheduleModal({ date, time: '19:00' });
      });
      document.getElementById('scheduleForm')?.addEventListener('submit', saveScheduleFromForm);
    }

    initDemoScheduleIfNeeded();
    bindScheduleUi();
    renderScheduleAll();

    initGoLiveSetup();
    bindEncoderActions();
    renderActiveDestinationsRow();
    initStudioPreview();
    ensureUnifiedChat();
    initAnalyticsChart();
})();


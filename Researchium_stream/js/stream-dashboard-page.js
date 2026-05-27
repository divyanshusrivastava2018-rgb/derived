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
    document.getElementById('btnStudioSignOut')?.addEventListener('click', () => {
      sessionStorage.removeItem('studio_token');
      window.location.href = 'studio-lobby.html';
    });

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
    let toastFadeTimer = null;
    function showToast(message, type) {
      const el = document.getElementById('streamDashToast');
      if (!el) return;
      el.textContent = message;
      el.className = 'stream-dash-toast';
      if (type === 'error') el.classList.add('stream-dash-toast--error');
      else if (type === 'success') el.classList.add('stream-dash-toast--success');
      else el.classList.add('stream-dash-toast--info');
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('is-visible'));
      clearTimeout(toastTimer);
      clearTimeout(toastFadeTimer);
      toastTimer = setTimeout(() => {
        el.classList.remove('is-visible');
        toastFadeTimer = setTimeout(() => {
          el.hidden = true;
        }, 250);
      }, 3000);
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
    // My streams (API-backed list)
    // -----------------------------
    let streamsFilter = 'all';
    let streamsSearchQuery = '';
    let openStreamMenuId = null;
    let streamsData = [];
    let streamsSearchTimer = null;

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

    function streamApi(path, options = {}) {
      const token = sessionStorage.getItem('studio_token');
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetch(`/api/stream${path}`, { ...options, headers });
    }

    function subjectInitial(subject) {
      return String(subject || 'S').trim().charAt(0).toUpperCase() || 'S';
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

    function updateStreamFilterTabCounts(streams) {
      const totals = { all: streams.length, draft: 0, scheduled: 0, live: 0, ended: 0 };
      streams.forEach((s) => {
        const key = String(s.status || 'draft').toLowerCase();
        if (totals[key] != null) totals[key] += 1;
      });
      document.querySelectorAll('[data-stream-filter]').forEach((tab) => {
        const key = tab.dataset.streamFilter || 'all';
        const base = tab.dataset.label || tab.textContent.replace(/\s*\(\d+\)\s*$/, '');
        tab.dataset.label = base;
        tab.textContent = `${base} (${totals[key] || 0})`;
      });
    }

    async function refreshStreamsFromApi() {
      try {
        const res = await streamApi('/streams');
        const data = await res.json().catch(() => []);
        streamsData = Array.isArray(data) ? data : [];
      } catch {
        streamsData = [];
      }
      updateStreamFilterTabCounts(streamsData);
      renderStreamsList(streamsData);
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

    async function handleStreamAction(streamId, action) {
      const streams = streamsData.slice();
      const idx = streams.findIndex((s) => s.id === streamId);
      if (idx < 0) return;
      const stream = streams[idx];

      if (action === 'edit') {
        showToast(`Edit "${stream.title}" (coming soon).`);
        return;
      }
      if (action === 'duplicate') {
        try {
          const res = await streamApi('/streams', {
            method: 'POST',
            body: JSON.stringify({
              title: `Copy of ${stream.title}`,
              subject: stream.subject || 'General Research',
              privacy: stream.privacy || 'public',
              status: 'draft',
              platforms: Array.isArray(stream.platforms) ? stream.platforms : [],
              thumbnailColor: stream.thumbnailColor || '#7c3aed',
            }),
          });
          if (!res.ok) throw new Error('duplicate_failed');
          await refreshStreamsFromApi();
          showToast('Stream duplicated.');
        } catch {
          showToast('Could not duplicate stream.', 'error');
        }
        return;
      }
      if (action === 'copy') {
        const link = stream.link || `${location.origin}/live-classes.html`;
        copyText(link);
        showToast('Link copied.');
        return;
      }
      if (action === 'delete') {
        try {
          const res = await streamApi(`/streams/${encodeURIComponent(stream.id)}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('delete_failed');
          await refreshStreamsFromApi();
          showToast('Stream deleted');
        } catch {
          showToast('Could not delete stream.', 'error');
        }
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

      const streams = Array.isArray(allStreams) ? allStreams : streamsData;
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
        thumbWrap.style.background = stream.thumbnailColor || '#7c3aed';
        thumbWrap.textContent = subjectInitial(stream.subject);

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
        if (String(stream.status || '').toLowerCase() === 'draft' || stream.viewerPeak == null) {
          viewers.textContent = '—';
        } else {
          const peak = document.createElement('strong');
          peak.textContent = String(Number(stream.viewerPeak) || 0);
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
          renderStreamsList(streamsData);
        });
      });

      const search = document.getElementById('streamsSearchInput');
      search?.addEventListener('input', () => {
        streamsSearchQuery = search.value;
        if (streamsSearchTimer) clearTimeout(streamsSearchTimer);
        streamsSearchTimer = setTimeout(() => {
          renderStreamsList(streamsData);
        }, 300);
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.stream-actions-wrap')) closeStreamActionsMenu();
      });
    }

    bindStreamsToolbar();
    refreshStreamsFromApi();

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
    // Destinations (API-backed)
    // -----------------------------
    const DESTINATIONS = (multistreamApi?.platforms || []).map((p) => ({
      key: p.id,
      id: p.id,
      name: p.name,
      color: p.color,
      defaultRtmp: p.rtmpBase,
      icon: String(p.name || '?').trim().charAt(0).toUpperCase(),
    }));

    const destState = {
      connections: {}, // key -> { id, connected, enabled, error, streamKey, rtmpUrl, ... }
      toggles: {},     // key -> bool
    };

    function getDest(key) {
      return DESTINATIONS.find((d) => d.key === key) || null;
    }

    function computeEnabledPlatforms() {
      return DESTINATIONS.filter((d) => {
        const conn = destState.connections[d.key];
        return Boolean(conn?.connected) && Boolean(destState.toggles[d.key]);
      });
    }

    function setGoLiveUI() {
      const btn = document.getElementById('btnGoLiveAll');
      const count = computeEnabledPlatforms().length;
      if (!btn) return;
      btn.textContent = `● Go live to ${count} platform${count === 1 ? '' : 's'}`;
      btn.classList.toggle('is-ready', count > 0);
      btn.disabled = count < 1;
      renderActiveDestinationsRow();
    }

    let modalPlatformKey = null;
    const destinationsModal = document.getElementById('destinationsConnectModal');
    const modalTitle = document.getElementById('destinationsConnectTitle');
    const modalClose = document.getElementById('destinationsConnectClose');
    const modalCancel = document.getElementById('destinationsConnectCancel');
    const modalSave = document.getElementById('destinationsConnectSave');
    const modalStreamKey = document.getElementById('destinationsStreamKey');
    const modalRtmpUrl = document.getElementById('destinationsRtmpUrl');
    let modalKeyRevealBtn = null;

    function normalizeDestinations(rows) {
      destState.connections = {};
      destState.toggles = {};
      DESTINATIONS.forEach((platform) => {
        const row = (rows || []).find((r) => String(r.platform || '').toLowerCase() === platform.key);
        if (!row) return;
        const connected = true;
        const enabled = Boolean(row.enabled);
        destState.connections[platform.key] = {
          id: row.id,
          connected,
          enabled,
          error: false,
          name: row.name || platform.name,
          streamKey: row.streamKey || '',
          rtmpUrl: row.rtmpUrl || platform.defaultRtmp,
          platform: platform.key,
        };
        destState.toggles[platform.key] = enabled;
      });
    }

    async function refreshDestinationsFromApi() {
      if (!multistreamApi) return;
      try {
        const rows = await multistreamApi.listDestinations();
        normalizeDestinations(Array.isArray(rows) ? rows : []);
      } catch {
        // Keep the panel interactive and mark unknown cards as disconnected.
        normalizeDestinations([]);
      }
      renderDestinationsMock();
      setGoLiveUI();
    }

    function ensureModalKeyToggle() {
      if (!modalStreamKey || modalKeyRevealBtn) return;
      modalKeyRevealBtn = document.createElement('button');
      modalKeyRevealBtn.type = 'button';
      modalKeyRevealBtn.className = 'btn btn-ghost btn-small destinations-key-toggle';
      modalKeyRevealBtn.textContent = 'Show';
      modalKeyRevealBtn.addEventListener('click', () => {
        const reveal = modalStreamKey.type === 'password';
        modalStreamKey.type = reveal ? 'text' : 'password';
        modalKeyRevealBtn.textContent = reveal ? 'Hide' : 'Show';
      });
      modalStreamKey.insertAdjacentElement('afterend', modalKeyRevealBtn);
    }

    function openConnectModal(platformKey) {
      const d = getDest(platformKey);
      if (!d) return;
      modalPlatformKey = platformKey;
      if (modalTitle) modalTitle.textContent = `Connect ${d.name}`;
      const existing = destState.connections[d.key];
      if (modalRtmpUrl) modalRtmpUrl.value = existing?.rtmpUrl || d.defaultRtmp || '';
      if (modalStreamKey) {
        modalStreamKey.value = existing?.streamKey || '';
        modalStreamKey.type = 'password';
      }
      if (modalKeyRevealBtn) modalKeyRevealBtn.textContent = 'Show';
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

    async function saveConnectionFromModal() {
      if (!modalPlatformKey || !multistreamApi) return;
      const d = getDest(modalPlatformKey);
      if (!d) return;
      const streamKey = String(modalStreamKey?.value || '').trim();
      const rtmpUrl = String(modalRtmpUrl?.value || '').trim();
      const existing = destState.connections[d.key];
      if (!streamKey || !rtmpUrl) {
        showToast('Stream key and RTMP URL are required.', 'error');
        return;
      }
      try {
        if (existing?.id) {
          await multistreamApi.updateDestination(existing.id, {
            rtmpUrl,
            streamKey,
            enabled: true,
          });
        } else {
          await multistreamApi.createDestination({
            name: d.name,
            platform: d.key,
            rtmpUrl,
            streamKey,
            enabled: true,
          });
        }
        closeConnectModal();
        await refreshDestinationsFromApi();
        showToast(`${d.name} connected!`, 'success');
      } catch (err) {
        showToast(err?.message || 'Failed to connect destination.', 'error');
      }
    }

    async function disconnectPlatform(platformKey) {
      const conn = destState.connections[platformKey];
      if (!conn?.id || !multistreamApi) return;
      try {
        await multistreamApi.deleteDestination(conn.id);
        await refreshDestinationsFromApi();
      } catch {
        showToast('Failed to disconnect destination.', 'error');
      }
    }

    async function updateDestinationToggle(platformKey, enabled) {
      const conn = destState.connections[platformKey];
      if (!conn?.id || !multistreamApi) return;
      try {
        await multistreamApi.updateDestination(conn.id, { enabled });
        destState.toggles[platformKey] = Boolean(enabled);
        if (destState.connections[platformKey]) {
          destState.connections[platformKey].enabled = Boolean(enabled);
        }
        setGoLiveUI();
      } catch {
        showToast('Failed to update destination.', 'error');
      }
    }

    function platformCircleSvg(d) {
      return `
        <svg viewBox="0 0 44 44" aria-hidden="true" focusable="false">
          <circle cx="22" cy="22" r="22" fill="${escapeHtml(d.color || '#6366f1')}"></circle>
          <text x="22" y="27" text-anchor="middle" font-size="17" font-weight="800" fill="#fff" font-family="Plus Jakarta Sans,system-ui,sans-serif">${escapeHtml(d.icon)}</text>
        </svg>
      `;
    }

    function buildPlatformCard(d) {
      const conn = destState.connections[d.key];
      const connected = Boolean(conn?.connected);
      const error = Boolean(conn?.error);
      const enabled = Boolean(destState.toggles[d.key]);

      const card = document.createElement('article');
      card.className = 'platform-card';
      if (connected) card.classList.add('is-connected');

      const statusClass = connected ? 'platform-status--connected' : error ? 'platform-status--error' : 'platform-status--idle';
      const statusLabel = connected ? 'Connected' : error ? 'Error' : 'Not connected';

      card.innerHTML = `
        <div class="platform-card-head">
          <div class="platform-logo">${platformCircleSvg(d)}</div>
          <div class="platform-meta">
            <div class="platform-name">${escapeHtml(d.name)}</div>
            <div class="platform-status ${statusClass}">
              <span class="platform-status-dot"></span>
              <span>${statusLabel}</span>
            </div>
          </div>
        </div>
        ${connected ? `
          <div class="platform-toggle-row">
            <span class="platform-toggle-label">Include in next stream</span>
            <label class="dest-switch">
              <input type="checkbox" class="dest-toggle" ${enabled ? 'checked' : ''}/>
              <span class="dest-slider"></span>
            </label>
          </div>
          <div class="platform-actions">
            <button type="button" class="btn btn-ghost btn-small js-edit">Edit</button>
            <button type="button" class="btn btn-ghost btn-small js-disconnect">Disconnect</button>
          </div>
        ` : `
          <div class="platform-actions platform-actions--single">
            <button type="button" class="btn btn-primary platform-connect-btn js-connect" style="background:${escapeHtml(d.color || '#6366f1')}">${escapeHtml('Connect')}</button>
          </div>
        `}
      `;

      if (connected) {
        card.querySelector('.dest-toggle')?.addEventListener('change', (e) => {
          updateDestinationToggle(d.key, e.target.checked);
        });
        card.querySelector('.js-edit')?.addEventListener('click', () => openConnectModal(d.key));
        card.querySelector('.js-disconnect')?.addEventListener('click', () => disconnectPlatform(d.key));
      } else {
        card.querySelector('.js-connect')?.addEventListener('click', () => openConnectModal(d.key));
      }
      return card;
    }

    function renderDestinationsMock() {
      const grid = document.getElementById('platformGrid');
      if (!grid) return;
      grid.innerHTML = '';
      DESTINATIONS.forEach((d) => grid.appendChild(buildPlatformCard(d)));
    }

    ensureModalKeyToggle();
    modalClose?.addEventListener('click', closeConnectModal);
    modalCancel?.addEventListener('click', closeConnectModal);
    destinationsModal?.addEventListener('click', (e) => {
      if (e.target === destinationsModal) closeConnectModal();
    });
    modalSave?.addEventListener('click', saveConnectionFromModal);

    document.getElementById('btnRefreshPlatforms')?.addEventListener('click', () => {
      refreshDestinationsFromApi();
    });

    document.getElementById('btnGoLiveAll')?.addEventListener('click', async () => {
      const count = computeEnabledPlatforms().length;
      if (!count) {
        showToast('Add a destination first', 'error');
        return;
      }
      showPanel('go-live');
      await document.getElementById('goLiveBtn')?.click();
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
          // Ensure destinations UI is visible regardless of React bundle status.
          const grid = document.getElementById('platformGrid');
          if (grid) grid.hidden = false;
          refreshDestinationsFromApi();
        } else {
          showBuildBanner();
          const grid = document.getElementById('platformGrid');
          if (grid) grid.hidden = false;
          refreshDestinationsFromApi();
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
      refreshDestinationsFromApi();
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

    let editingScheduleId = null;

    function openScheduleModal(opts = {}) {
      editingScheduleId = opts.editId || null;
      const modalTitle = document.getElementById('scheduleModalTitle');
      if (modalTitle) {
        modalTitle.textContent = editingScheduleId ? 'Edit scheduled class' : 'Schedule class';
      }
      const deleteBtn = document.getElementById('scheduleDeleteBtn');
      if (deleteBtn) deleteBtn.hidden = !editingScheduleId;

      populateSchedulePlatformChecks();
      const form = document.getElementById('scheduleForm');
      form?.reset();
      const dateEl = document.getElementById('scheduleDate');
      const timeEl = document.getElementById('scheduleTime');
      if (dateEl) dateEl.value = opts.date || formatScheduleDateInput(new Date());
      if (timeEl) timeEl.value = opts.time || '19:00';
      const notify = document.getElementById('scheduleNotify');
      if (notify) notify.checked = opts.notifyStudents !== false;
      if (opts.title) document.getElementById('scheduleTitle').value = opts.title;
      if (opts.subject) document.getElementById('scheduleSubject').value = opts.subject;
      if (opts.description != null) document.getElementById('scheduleDescription').value = opts.description;
      if (opts.repeat) document.getElementById('scheduleRepeat').value = opts.repeat;
      updateScheduleNotifyHint();
      if (opts.platforms) {
        document.querySelectorAll('#schedulePlatformChecks input').forEach((input) => {
          input.checked = opts.platforms.includes(input.value);
        });
      }
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

    document.getElementById('btnNewStream')?.addEventListener('click', openModal);
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

    document.getElementById('btnRtmpDone')?.addEventListener('click', async () => {
      const title = String(document.getElementById('streamTitleInput')?.value || '').trim();
      const subject = String(document.getElementById('streamCategorySelect')?.value || 'General Research');
      const privacy = document.querySelector('input[name="streamPrivacy"]:checked')?.value || 'public';
      if (!title) {
        showToast('Enter stream title first', 'error');
      closeModal();
      showPanel('go-live');
        document.getElementById('streamTitleInput')?.focus();
        return;
      }
      try {
        const res = await streamApi('/streams', {
          method: 'POST',
          body: JSON.stringify({
            title,
            subject,
            privacy,
            status: 'draft',
            platforms: [],
            thumbnailColor: '#7c3aed',
          }),
        });
        if (!res.ok) throw new Error('create_failed');
        await refreshStreamsFromApi();
        showToast('Stream created');
      } catch {
        showToast('Could not create stream.', 'error');
      }
      closeModal();
      showPanel('streams');
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
          updateDestinationToggle(d.key, Boolean(destState.toggles[d.key]));
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

      // Persist Go Live stream setup across panel switches.
      const STREAM_SETUP_LS = 'researchium_stream_setup_v1';
      const streamCategorySelect = document.getElementById('streamCategorySelect');
      const privacyRadios = document.querySelectorAll('input[name="streamPrivacy"]');

      function readStreamSetup() {
        const title = String(streamTitleInput?.value || '').trim();
        const subject = String(streamCategorySelect?.value || 'General Research');
        const privacy =
          document.querySelector('input[name="streamPrivacy"]:checked')?.value || 'public';
        return { title, subject, privacy };
      }

      function saveStreamSetup() {
        try {
          sessionStorage.setItem(STREAM_SETUP_LS, JSON.stringify(readStreamSetup()));
        } catch {
          /* ignore */
        }
      }

      function restoreStreamSetup() {
        const saved = safeJsonParse(sessionStorage.getItem(STREAM_SETUP_LS), null);
        if (!saved) return;
        if (streamTitleInput && typeof saved.title === 'string') streamTitleInput.value = saved.title;
        if (streamCategorySelect && typeof saved.subject === 'string') streamCategorySelect.value = saved.subject;
        if (saved.privacy) {
          privacyRadios.forEach((r) => {
            if (r.value === saved.privacy) r.checked = true;
          });
        }
      }

      restoreStreamSetup();
      streamTitleInput?.addEventListener('input', saveStreamSetup);
      streamCategorySelect?.addEventListener('change', saveStreamSetup);
      privacyRadios.forEach((r) => r.addEventListener('change', saveStreamSetup));

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

    const TOKEN = () => sessionStorage.getItem('studio_token');
    const API = (path, options = {}) => {
      const headers = { ...(options.headers || {}) };
      const token = TOKEN();
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetch(`/api/stream${path}`, { ...options, headers });
    };

    const STREAM_KEY_MASK_UI = '••••-••••-••••-••••';
    let streamKeyValue = null; // real stream key from backend
    let streamKeyRevealed = false;
    let rtmpUrlValue = null;

    let goLiveIsLive = false;
    let liveSeconds = 0;
    let liveTicker = null;
    let statusPollTimer = null;

    function formatDurationHMS(totalSeconds) {
      const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
      const h = String(Math.floor(s / 3600)).padStart(2, '0');
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      const rem = String(s % 60).padStart(2, '0');
      return `${h}:${m}:${rem}`;
    }

    function updateStreamKeyUi() {
      const revealBtn = document.getElementById('btnRevealKey');
      const keyEl = document.getElementById('streamKeyDisplay');
      const modalKeyEl = document.getElementById('rtmpKey');
      if (revealBtn) revealBtn.textContent = streamKeyRevealed ? 'Hide' : 'Show';
      const shown = streamKeyRevealed ? String(streamKeyValue || '') : STREAM_KEY_MASK_UI;
      if (keyEl) keyEl.textContent = shown;
      if (modalKeyEl) modalKeyEl.textContent = shown;
    }

    function setRtmpUrlUi(url) {
      const el = document.getElementById('rtmpUrl');
      if (!el) return;
      el.textContent = String(url || '');
    }

    function clearLiveIntervals() {
      if (liveTicker) clearInterval(liveTicker);
      if (statusPollTimer) clearInterval(statusPollTimer);
      liveTicker = null;
      statusPollTimer = null;
    }

    function setLiveUi(nextLive, status = {}) {
      goLiveIsLive = nextLive;
      const dot = document.getElementById('statusDot');
      const label = document.getElementById('statusLabel');
      const btn = document.getElementById('goLiveBtn');
      const endBtn = document.getElementById('btnEndStream');
      const viewerEl = document.getElementById('viewerCount');
      const bitrateEl = document.getElementById('bitrate');

      if (nextLive) {
        dot?.classList.add('live');
        if (label) label.textContent = 'LIVE';
        if (btn) {
          btn.textContent = '● Live now';
          btn.disabled = true;
        }
        if (endBtn) endBtn.hidden = false;

        liveSeconds = Number(status.durationSeconds) || 0;
        document.getElementById('duration').textContent = formatDurationHMS(liveSeconds);

        if (viewerEl) viewerEl.textContent = String(status.viewers ?? 0);
        if (bitrateEl) bitrateEl.textContent = `${Number(status.bitrate ?? 0) || 0} kbps`;

        clearLiveIntervals();
        liveTicker = setInterval(() => {
          liveSeconds += 1;
          document.getElementById('duration').textContent = formatDurationHMS(liveSeconds);
        }, 1000);

        statusPollTimer = setInterval(async () => {
          try {
            const res = await fetch('/api/stream/status', { cache: 'no-store' });
            const s = await res.json().catch(() => null);
            if (!s) return;
            if (!s.live) {
              setLiveUi(false);
              return;
            }
            if (viewerEl) viewerEl.textContent = String(s.viewers ?? 0);
            if (bitrateEl) bitrateEl.textContent = `${Number(s.bitrate ?? 0) || 0} kbps`;
          } catch {
            /* ignore poll errors */
          }
        }, 10000);
      } else {
        dot?.classList.remove('live');
        if (label) label.textContent = 'Offline';
        if (btn) {
          btn.textContent = '● Go live';
          btn.disabled = false;
        }
        if (endBtn) endBtn.hidden = true;
        clearLiveIntervals();
        document.getElementById('duration').textContent = '00:00:00';
        document.getElementById('bitrate').textContent = '— kbps';
        if (viewerEl) viewerEl.textContent = '0';
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
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      overlay.hidden = true;
    }

    async function loadGoLiveFromApi() {
      // Stream key + RTMP URL
      try {
        const keyRes = await API('/key', { method: 'GET' });
        const keyData = await keyRes.json().catch(() => null);
        if (keyRes.ok && keyData?.streamKey && keyData?.rtmpUrl) {
          streamKeyValue = keyData.streamKey;
          rtmpUrlValue = keyData.rtmpUrl;
          setRtmpUrlUi(rtmpUrlValue);
          streamKeyRevealed = false;
          updateStreamKeyUi();
        }
      } catch {
        /* ignore — UI will stay masked */
      }

      // Stream status
      try {
        const res = await fetch('/api/stream/status', { cache: 'no-store' });
        const status = await res.json().catch(() => null);
        if (status) {
          setLiveUi(Boolean(status.live), status);
          const viewerEl = document.getElementById('viewerCount');
          const durationEl = document.getElementById('duration');
          const bitrateEl = document.getElementById('bitrate');
          if (viewerEl) viewerEl.textContent = String(status.viewers ?? 0);
          if (durationEl) durationEl.textContent = formatDurationHMS(status.durationSeconds);
          if (bitrateEl) bitrateEl.textContent = `${Number(status.bitrate ?? 0) || 0} kbps`;
        }
      } catch {
        // default UI already indicates offline
      }
    }

    function bindEncoderActions() {
      streamKeyRevealed = false;
      streamKeyValue = streamKeyValue || null;
      updateStreamKeyUi();

      // RTMP URL copy
      document.getElementById('btnCopyRtmp')?.addEventListener('click', () => {
        const el = document.getElementById('rtmpUrl');
        const url = el?.textContent || rtmpUrlValue || '';
        copyText(url, document.getElementById('btnCopyRtmp'));
        showToast('Copied!', 'success');
      });

      // Show/Hide key
      document.getElementById('btnRevealKey')?.addEventListener('click', () => {
        streamKeyRevealed = !streamKeyRevealed;
        updateStreamKeyUi();
      });

      // Copy key
      document.getElementById('btnCopyStreamKey')?.addEventListener('click', () => {
        const real = String(streamKeyValue || '');
        if (!real) {
          showToast('Stream key not loaded yet.', 'error');
          return;
        }
        copyText(real, document.getElementById('btnCopyStreamKey'));
        showToast('Copied!', 'success');
      });

      // Regenerate key
      document.getElementById('btnRegenerateKey')?.addEventListener('click', async () => {
        try {
          const res = await API('/key/regenerate', { method: 'POST' });
          const data = await res.json().catch(() => null);
          if (res.ok && data?.streamKey) {
            streamKeyValue = data.streamKey;
            rtmpUrlValue = data.rtmpUrl || rtmpUrlValue;
            setRtmpUrlUi(rtmpUrlValue);
            // keep current reveal mode
            updateStreamKeyUi();
            showToast('New stream key generated', 'success');
          } else {
            showToast(data?.error || 'Failed to regenerate stream key.', 'error');
          }
        } catch {
          showToast('Cannot regenerate right now.', 'error');
        }
      });

      // Load RTMP key + status once authenticated.
      void loadGoLiveFromApi();
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
      youtube: { label: 'YT', cls: 'platform-badge--youtube' },
      twitch: { label: 'TW', cls: 'platform-badge--twitch' },
      facebook: { label: 'FB', cls: 'platform-badge--facebook' },
      linkedin: { label: 'LI', cls: 'platform-badge--linkedin' },
      all: { label: 'ALL', cls: 'platform-badge--all' },
    };

    const CHAT_NAMES = [
      'Aarav', 'Diya', 'Rahul', 'Priya', 'Amit', 'Neha', 'Rohan', 'Sanya', 'Kabir', 'Tara',
      'Vikram', 'Meera', 'Arjun', 'Isha', 'Nikhil', 'Ananya', 'Aditya', 'Simran', 'Kunal', 'Ritika',
    ];

    const CHAT_TEXTS = [
      'Great explanation!',
      'Can you repeat that?',
      "What's the formula for this case?",
      'Amazing class 🔥',
      'Can you share notes?',
      'Subscribed!',
      'How do we derive this step?',
      'Please show one more example.',
      'Is this in the syllabus?',
      'What is the intuition behind it?',
      'Can you go a bit slower?',
      'Got it, thank you!',
      'Will this come in the exam?',
      'Can you confirm the final answer?',
      'What if the boundary condition changes?',
      'Where can we practice more?',
      'Can you explain the graph?',
      'This trick is really useful.',
      'Any shortcut for calculations?',
      'How to avoid common mistakes here?',
      'Can you summarize the steps?',
      'Which chapter is this from?',
      'Please pin the key formula.',
      'Doubt: why is this negative?',
      'Is there an alternate method?',
      'Nice! ✅',
      'Can you share the PDF?',
      'That makes sense now.',
      'Could you recap the previous point?',
      'Thanks sir/maam 🙏',
    ];

    function getConnectedPlatformKeys() {
      const keys = DESTINATIONS.filter((d) => destState.connections[d.key]?.connected).map((d) => d.key);
      // Fallback platforms for chat demo if none connected.
      return keys.length ? keys : ['youtube', 'twitch', 'facebook', 'linkedin'];
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
      feed.querySelectorAll('.chat-msg').forEach((node) => {
        const ts = Number(node.dataset.createdAt || '0');
        const timeEl = node.querySelector('.msg-time');
        if (timeEl && ts) timeEl.textContent = formatRelativeTime(ts);
      });
    }

    function applyChatFiltersToFeed() {
      const feed = document.getElementById('chatFeed');
      if (!feed) return;
      feed.querySelectorAll('.chat-msg').forEach((node) => {
        const key = node.dataset.platformKey;
        const show = key === 'all' ? true : Boolean(chatFilter[key]);
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

      // Always allow chat simulation; when no destinations are connected, we use fallback platforms.
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
        const meta = PLATFORM_BADGE[key] || PLATFORM_BADGE.youtube;
        badge.className = `platform-badge ${meta.cls}`;
        badge.textContent = meta.label;
        badge.dataset.platform = key;

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

    let pinnedProgressTimer = null;
    function closePinnedMessage() {
      const overlay = document.getElementById('pinnedMessageOverlay');
      if (overlay) overlay.hidden = true;
      lastPinnedMsg = null;
      if (pinnedDismissTimer) clearTimeout(pinnedDismissTimer);
      pinnedDismissTimer = null;
      if (pinnedProgressTimer) clearInterval(pinnedProgressTimer);
      pinnedProgressTimer = null;
    }

    function renderPinnedMessage(msg) {
      lastPinnedMsg = msg;
      const overlay = document.getElementById('pinnedMessageOverlay');
      const body = document.getElementById('pinnedMessageBody');
      if (!overlay || !body) return;

      const meta = PLATFORM_BADGE[msg.platformKey] || PLATFORM_BADGE.youtube;
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
      badge.dataset.platform = msg.platformKey;

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

      const progressWrap = document.createElement('div');
      progressWrap.className = 'pinned-progress';
      const progressBar = document.createElement('div');
      progressBar.className = 'pinned-progress-bar';
      progressWrap.appendChild(progressBar);

      wrapper.appendChild(head);
      wrapper.appendChild(text);
      wrapper.appendChild(time);
      wrapper.appendChild(progressWrap);
      body.appendChild(wrapper);

      overlay.hidden = false;
      if (pinnedDismissTimer) clearTimeout(pinnedDismissTimer);
      if (pinnedProgressTimer) clearInterval(pinnedProgressTimer);
      const startedAt = Date.now();
      pinnedProgressTimer = setInterval(() => {
        const t = Date.now() - startedAt;
        const pct = Math.max(0, Math.min(1, t / 30000));
        progressBar.style.width = `${Math.round((1 - pct) * 100)}%`;
      }, 200);
      pinnedDismissTimer = setTimeout(closePinnedMessage, 30000);
    }

    function pinMessage(msg) {
      renderPinnedMessage(msg);
    }

    function renderChatMessage(msg) {
      const feed = document.getElementById('chatFeed');
      if (!feed) return;

      const msgEl = document.createElement('div');
      msgEl.className = 'chat-msg';
      msgEl.dataset.platformKey = msg.platformKey;
      msgEl.dataset.createdAt = String(msg.createdAt);

      const meta = PLATFORM_BADGE[msg.platformKey] || PLATFORM_BADGE.youtube;

      const badge = document.createElement('span');
      badge.className = `platform-badge ${meta.cls}`;
      badge.dataset.platform = msg.platformKey;
      badge.textContent = meta.label;

      const username = document.createElement('span');
      username.className = 'msg-user';
      username.textContent = msg.username;

      const text = document.createElement('span');
      text.className = 'msg-text';
      text.textContent = msg.text;

      const time = document.createElement('span');
      time.className = 'msg-time';
      time.textContent = formatRelativeTime(msg.createdAt);

      const pinBtn = document.createElement('button');
      pinBtn.type = 'button';
      pinBtn.className = 'msg-pin';
      pinBtn.title = 'Pin';
      pinBtn.textContent = '📌';
      pinBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        pinMessage(msg);
      });

      msgEl.appendChild(badge);
      msgEl.appendChild(username);
      msgEl.appendChild(text);
      msgEl.appendChild(time);
      msgEl.appendChild(pinBtn);

      const nearBottom = feed.scrollTop + feed.clientHeight >= feed.scrollHeight - 60;
      feed.appendChild(msgEl);
      if (msg.platformKey !== 'all' && !chatFilter[msg.platformKey]) msgEl.hidden = true;
      // Spec: always auto-scroll to bottom on new message.
      if (nearBottom || true) feed.scrollTop = feed.scrollHeight;
    }

    function simulateChatTick() {
      const simToggle = document.getElementById('chatSimulateToggle');
      if (!simToggle?.checked) return;

      const connectedKeys = getConnectedPlatformKeys();

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

      const nextDelay = 2000 + Math.random() * 3000;
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

        showToast('Sent to all platforms (mock)', 'success');
        renderChatMessage({
          id: `y_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          platformKey: 'all',
          username: 'You',
          text,
          createdAt: Date.now(),
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
          refreshDestinationsFromApi();
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
        btn.addEventListener('click', () => refreshScheduleFromApi());
      }
      btn.addEventListener('click', () => showPanel(btn.dataset.panel));
    });

    document.getElementById('goLiveBtn')?.addEventListener('click', async () => {
      if (goLiveIsLive) return;
      const titleInput = document.getElementById('streamTitleInput');
      const title = String(titleInput?.value || '').trim();
      if (!title) {
        titleInput?.focus();
        titleInput?.animate(
          [
            { transform: 'translateX(-8px)' },
            { transform: 'translateX(8px)' },
            { transform: 'translateX(-6px)' },
            { transform: 'translateX(6px)' },
            { transform: 'translateX(0)' },
          ],
          { duration: 420 }
        );
        return;
      }

      const enabled = computeEnabledPlatforms();
      if (!enabled || enabled.length < 1) {
        showToast('Add a destination first', 'error');
        return;
      }

      // Countdown overlay (3 → 2 → 1 → LIVE!)
      await runCountdown();

      const subject = String(document.getElementById('streamCategorySelect')?.value || 'General Research');
      const privacy =
        document.querySelector('input[name="streamPrivacy"]:checked')?.value || 'public';
      const platforms = enabled.map((d) => d.key);

      try {
        await API('/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            live: true,
            title,
            viewers: 0,
            bitrate: 0,
            durationSeconds: 0,
          }),
        });

        // Save stream entry.
        await API('/streams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            subject,
            privacy,
            status: 'live',
            platforms,
            thumbnailColor: '#7c3aed',
          }),
        });
      } catch {
        showToast('Failed to start stream. Try again.', 'error');
        setLiveUi(false);
        return;
      }

      setLiveUi(true, { viewers: 0, bitrate: 0, durationSeconds: 0 });
    });

    document.getElementById('btnEndStream')?.addEventListener('click', () => {
      // Fire-and-forget (UI updates immediately, but backend will persist live:false).
      API('/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ live: false }),
      }).catch(() => {});
      setLiveUi(false);
      showToast('Stream ended', 'success');
    });

    // -----------------------------
    // Analytics panel (API-driven)
    // -----------------------------
    const ANALYTICS_RANGE = {
      '7d': { label: 'Last 7 days', days: 7 },
      '30d': { label: 'Last 30 days', days: 30 },
      all: { label: 'All time', days: null },
    };

    const CHART_SIZE = { w: 700, h: 200 };
    const CHART_PAD = { top: 18, right: 18, bottom: 38, left: 56 };
    const CHART_COLORS = {
      youtube: '#8b5cf6',
      twitch: '#f59e0b',
    };

    let analyticsUiInitialized = false;
    let analyticsRangeKey = '7d';
    let analyticsCachedStreams = null;
    let analyticsCachedDestinations = null;

    let analyticsCanvas = null;
    let analyticsCtx = null;
    let analyticsTooltip = null;
    let analyticsResizeObserver = null;
    let analyticsChartPointerBound = false;

    let analyticsChartPoints = null; // { labels, yt, tw, xs, yts, tws, maxY }

    let analyticsPlatformRowsForCsv = [];

    function formatCompactDate(d) {
      if (!(d instanceof Date) || Number.isNaN(d.valueOf())) return '';
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} ${d.getDate()}`;
    }

    function formatTopStreamDate(createdAtIso, subject) {
      const d = new Date(createdAtIso || Date.now());
      const date = formatCompactDate(d);
      const subj = String(subject || 'General Research').trim();
      return `${date} · ${subj}`;
    }

    function randomBetweenInt(min, maxInclusive) {
      return Math.floor(min + Math.random() * (maxInclusive - min + 1));
    }

    function getPlatformMeta(key) {
      const normalized = String(key || '').toLowerCase();
      const map = {
        youtube: { icon: 'Y', name: 'YouTube' },
        twitch: { icon: 'T', name: 'Twitch' },
        facebook: { icon: 'F', name: 'Facebook' },
        linkedin: { icon: 'L', name: 'LinkedIn' },
        twitter: { icon: 'X', name: 'X (Twitter)' },
        tiktok: { icon: '♪', name: 'TikTok' },
        instagram: { icon: 'IG', name: 'Instagram' },
        kick: { icon: 'K', name: 'Kick' },
        custom: { icon: 'C', name: 'Custom' },
      };
      return map[normalized] || { icon: '?', name: normalized || 'Custom' };
    }

    function ensureAnalyticsUi() {
      if (analyticsUiInitialized) return;
      analyticsUiInitialized = true;

      const chartWrap = document.getElementById('analyticsChartWrap');
      const existingSvg = document.getElementById('analyticsChartSvg');
      analyticsTooltip = document.getElementById('analyticsChartTooltip');
      if (!chartWrap || !analyticsTooltip) return;

      if (existingSvg) existingSvg.hidden = true;

      analyticsCanvas = document.createElement('canvas');
      analyticsCanvas.id = 'analyticsChartCanvas';
      analyticsCanvas.width = CHART_SIZE.w;
      analyticsCanvas.height = CHART_SIZE.h;
      analyticsCanvas.className = 'analytics-chart-canvas';
      chartWrap.insertBefore(analyticsCanvas, analyticsTooltip);
      analyticsCtx = analyticsCanvas.getContext('2d', { alpha: true });

      // Range controls (above chart)
      const chartCard = chartWrap.closest('.analytics-chart-card');
      const head = chartCard?.querySelector('.analytics-card-head');
      if (head && !document.getElementById('analyticsRangeControls')) {
        const controls = document.createElement('div');
        controls.id = 'analyticsRangeControls';
        controls.className = 'analytics-range-controls';
        Object.entries(ANALYTICS_RANGE).forEach(([key, meta]) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `btn btn-ghost btn-small analytics-range-btn${key === analyticsRangeKey ? ' active' : ''}`;
          btn.dataset.analyticsRange = key;
          btn.textContent = meta.label;
          btn.addEventListener('click', () => {
            if (analyticsRangeKey === key) return;
            analyticsRangeKey = key;
            controls.querySelectorAll('.analytics-range-btn').forEach((b) => b.classList.toggle('active', b.dataset.analyticsRange === key));
            renderAnalyticsChartFromCache().catch(() => {});
          });
          controls.appendChild(btn);
        });
        head.appendChild(controls);
      }

      // Export CSV button (above per-platform table)
      const panelEl = document.getElementById('panel-analytics');
      const perPlatformCard = panelEl?.querySelector('.analytics-card-title')?.closest('.analytics-card');
      // Only target the card titled exactly "Per-platform breakdown"
      const perPlatformTitle = perPlatformCard?.querySelector('.analytics-card-title');
      const perPlatformSection = panelEl?.querySelector('.analytics-card')?.closest ? panelEl : panelEl;
      const perPlatformCards = panelEl?.querySelectorAll('.analytics-card');
      const breakdownCard = Array.from(perPlatformCards || []).find((c) => c.querySelector('.analytics-card-title')?.textContent?.trim() === 'Per-platform breakdown');
      const tableWrap = breakdownCard?.querySelector('.analytics-table-wrap');
      const headingEl = breakdownCard?.querySelector('.analytics-card-title');
      if (headingEl && tableWrap && !document.getElementById('analyticsExportCsvBtn')) {
        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.id = 'analyticsExportCsvBtn';
        exportBtn.className = 'btn btn-ghost btn-small';
        exportBtn.textContent = 'Export CSV';
        exportBtn.addEventListener('click', () => exportAnalyticsPlatformCsv());
        headingEl.insertAdjacentElement('afterend', exportBtn);
      }

      if (analyticsResizeObserver) analyticsResizeObserver.disconnect();
      analyticsResizeObserver = new ResizeObserver(() => {
        // Redraw on resize and keep tooltip positioning correct.
        void renderAnalyticsChartFromCache(true);
      });
      analyticsResizeObserver.observe(chartWrap);

      // Initial visible state
      tooltipHide();
    }

    function tooltipHide() {
      if (analyticsTooltip) analyticsTooltip.hidden = true;
    }

    function computeRangeFilteredStreams(rangeKey, streams) {
      const meta = ANALYTICS_RANGE[rangeKey] || ANALYTICS_RANGE['7d'];
      if (meta.days == null) return streams.slice().sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      const now = Date.now();
      const cutoff = now - meta.days * 24 * 60 * 60 * 1000;
      return streams
        .filter((s) => {
          const t = new Date(s.createdAt || 0).valueOf();
          return t && t >= cutoff;
        })
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    }

    function choose7Points(rangeKey, filteredStreams) {
      // Always output exactly 7 points for the chart.
      const n = 7;
      const streamsSorted = (filteredStreams || []).slice();
      if (streamsSorted.length === 0) {
        const base = [
          { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), yt: 0, tw: 0 },
          { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), yt: 0, tw: 0 },
          { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), yt: 0, tw: 0 },
          { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), yt: 0, tw: 0 },
          { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), yt: 0, tw: 0 },
          { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), yt: 0, tw: 0 },
          { date: new Date(), yt: 0, tw: 0 },
        ];
        return base;
      }

      const count = streamsSorted.length;
      const pickStreamToPoint = (s) => {
        const d = new Date(s.createdAt || Date.now());
        const yt = Array.isArray(s.platforms) && s.platforms.includes('youtube') ? Number(s.viewerPeak || 0) : 0;
        const tw = Array.isArray(s.platforms) && s.platforms.includes('twitch') ? Number(s.viewerPeak || 0) : 0;
        return { date: d, yt, tw };
      };

      // Match the spec: use the last 7 streams when available.
      if (count >= n) {
        return streamsSorted.slice(count - n).map(pickStreamToPoint);
      }

      const chosen = [];
      for (let i = 0; i < n; i += 1) {
        const idx = count === 1 ? 0 : Math.floor((i * (count - 1)) / (n - 1));
        const s = streamsSorted[idx] || streamsSorted[count - 1];
        chosen.push(pickStreamToPoint(s));
      }

      // If density is low, add a bit of mock variation.
      if (count < n) {
        const jitter = rangeKey === '7d' ? 0.18 : rangeKey === '30d' ? 0.26 : 0.32;
        return chosen.map((p, i) => {
          const factor = 1 + (Math.random() - 0.5) * jitter;
          const trending = 1 + (i - (n - 1) / 2) * (jitter / 5);
          return { ...p, yt: Math.max(0, Math.round(p.yt * factor * trending)), tw: Math.max(0, Math.round(p.tw * factor)) };
        });
      }

      return chosen;
    }

    function drawAnalyticsChart(series) {
      if (!analyticsCanvas || !analyticsCtx) return;

      const ctx = analyticsCtx;
      const W = CHART_SIZE.w;
      const H = CHART_SIZE.h;
      const pad = CHART_PAD;

      const chartW = W - pad.left - pad.right;
      const chartH = H - pad.top - pad.bottom;
      const n = series.labels.length;

      const maxY = Math.max(1, Math.ceil((Math.max(...series.yt, ...series.tw) * 1.12) / 10) * 10);

      const xAt = (i) => pad.left + (i / Math.max(n - 1, 1)) * chartW;
      const yAt = (v) => pad.top + chartH - (v / maxY) * chartH;
      const baselineY = pad.top + chartH;

      // Handle DPR for crispness; draw in fixed 700x200 coordinates.
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(W * dpr);
      const targetH = Math.round(H * dpr);
      if (analyticsCanvas.width !== targetW) analyticsCanvas.width = targetW;
      if (analyticsCanvas.height !== targetH) analyticsCanvas.height = targetH;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      ctx.save();

      // Background is already from wrapper; we only draw chart elements.

      // Grid lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      const gridSteps = 4;
      for (let i = 0; i <= gridSteps; i += 1) {
        const y = pad.top + (i / gridSteps) * chartH;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(W - pad.right, y);
        ctx.stroke();
      }

      // Vertical grid lines
      for (let i = 0; i < n; i += 1) {
        if (i === 0 || i === n - 1) continue;
        const x = xAt(i);
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, baselineY);
        ctx.stroke();
      }

      function buildSmoothPath(points) {
        // Cubic "Catmull-Rom like" smoothing.
        ctx.beginPath();
        if (!points.length) return;
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length - 1; i += 1) {
          const p0 = points[i - 1] || points[i];
          const p1 = points[i];
          const p2 = points[i + 1];
          const p3 = points[i + 2] || p2;
          const cp1x = p1.x + (p2.x - p0.x) / 6;
          const cp1y = p1.y + (p2.y - p0.y) / 6;
          const cp2x = p2.x - (p3.x - p1.x) / 6;
          const cp2y = p2.y - (p3.y - p1.y) / 6;
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
      }

      function fillUnderLine(points, color) {
        // Fill gradient under the curve.
        const grad = ctx.createLinearGradient(0, pad.top, 0, baselineY);
        grad.addColorStop(0, color.replace(')', ', 0.28)').replace('rgba', 'rgba'));
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        buildSmoothPath(points);
        const last = points[points.length - 1];
        const first = points[0];
        ctx.lineTo(last.x, baselineY);
        ctx.lineTo(first.x, baselineY);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }

      function strokeLine(points, color) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        buildSmoothPath(points);
        ctx.stroke();
      }

      // Points
      const ytPoints = series.yt.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
      const twPoints = series.tw.map((v, i) => ({ x: xAt(i), y: yAt(v) }));

      // Area fills
      // Convert hex to rgba-ish by drawing gradients via CSS-like colors; we use fixed alpha stops.
      const ytColor = 'rgba(139, 92, 246, 0.90)';
      const twColor = 'rgba(245, 158, 11, 0.90)';

      // YouTube fill
      {
        const grad = ctx.createLinearGradient(0, pad.top, 0, baselineY);
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.28)');
        grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
        ctx.save();
        buildSmoothPath(ytPoints);
        ctx.lineTo(ytPoints[ytPoints.length - 1].x, baselineY);
        ctx.lineTo(ytPoints[0].x, baselineY);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }

      // Twitch fill
      {
        const grad = ctx.createLinearGradient(0, pad.top, 0, baselineY);
        grad.addColorStop(0, 'rgba(245, 158, 11, 0.26)');
        grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.save();
        buildSmoothPath(twPoints);
        ctx.lineTo(twPoints[twPoints.length - 1].x, baselineY);
        ctx.lineTo(twPoints[0].x, baselineY);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }

      // Lines
      strokeLine(ytPoints, ytColor);
      strokeLine(twPoints, twColor);

      // Dots
      const drawDots = (pts, fillColor) => {
        ctx.fillStyle = fillColor;
        pts.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      };
      drawDots(ytPoints, 'rgba(139, 92, 246, 1)');
      drawDots(twPoints, 'rgba(245, 158, 11, 1)');

      // X labels
      ctx.font = '700 11px var(--font)';
      ctx.fillStyle = 'rgba(92, 101, 120, 0.95)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      series.labels.forEach((lbl, i) => {
        ctx.fillText(String(lbl), xAt(i), baselineY + 8);
      });

      ctx.restore();

      analyticsChartPoints = {
        labels: series.labels,
        yt: series.yt,
        tw: series.tw,
        xs: series.labels.map((_, i) => xAt(i)),
        yts: ytPoints.map((p) => p.y),
        tws: twPoints.map((p) => p.y),
        maxY,
        baselineY,
        pad,
      };
    }

    function renderTooltipAtIndex(i, clientY = null) {
      if (!analyticsChartPoints || !analyticsTooltip) return;
      const wrap = document.getElementById('analyticsChartWrap');
      if (!wrap) return;

      const rect = analyticsCanvas.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const cssW = rect.width || CHART_SIZE.w;
      const cssH = rect.height || CHART_SIZE.h;
      const sx = cssW / CHART_SIZE.w;
      const sy = cssH / CHART_SIZE.h;

      const xCss = wrapRect.left + analyticsChartPoints.xs[i] * sx - wrapRect.left;
      const yCss = clientY != null ? clientY - wrapRect.top : analyticsChartPoints.yts[i] * sy; // position above mouse

      const ytVal = analyticsChartPoints.yt[i] ?? 0;
      const twVal = analyticsChartPoints.tw[i] ?? 0;
      analyticsTooltip.hidden = false;
      analyticsTooltip.innerHTML =
        `<strong>${escapeHtml(String(analyticsChartPoints.labels[i]))}</strong>` +
        `<span>YouTube: <strong class="analytics-tooltip-yt">${escapeHtml(String(ytVal))}</strong> viewers</span>` +
        `<span>Twitch: <strong class="analytics-tooltip-tw">${escapeHtml(String(twVal))}</strong> viewers</span>`;
      analyticsTooltip.style.left = `${xCss}px`;
      analyticsTooltip.style.top = `${Math.max(0, yCss)}px`;
    }

    function bindChartPointerInteractions() {
      if (!analyticsCanvas) return;
      if (analyticsChartPointerBound) return;
      analyticsChartPointerBound = true;
      analyticsCanvas.addEventListener('mousemove', (e) => {
        if (!analyticsChartPoints) return;
        const rect = analyticsCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const sx = x / (rect.width || 1);
        const idx = Math.round(sx * (analyticsChartPoints.labels.length - 1));
        const i = Math.max(0, Math.min(analyticsChartPoints.labels.length - 1, idx));
        renderTooltipAtIndex(i, e.clientY);
      });
      analyticsCanvas.addEventListener('mouseleave', () => tooltipHide());
    }

    function computeChartSeries(rangeKey, streams) {
      const filtered = computeRangeFilteredStreams(rangeKey, streams || []);
      const chosen = choose7Points(rangeKey, filtered);
      const labels = chosen.map((p) => formatCompactDate(p.date));
      const yt = chosen.map((p) => p.yt);
      const tw = chosen.map((p) => p.tw);
      return { labels, yt, tw };
    }

    async function renderAnalyticsChartFromCache(force = false) {
      if (!analyticsUiInitialized) ensureAnalyticsUi();
      const streams = analyticsCachedStreams;
      if (!streams) {
        // If there's no cache yet, refresh everything.
        await refreshAnalyticsPanel().catch(() => {});
        return;
      }

      const series = computeChartSeries(analyticsRangeKey, streams);
      drawAnalyticsChart(series);
      // Bind interactions once.
      bindChartPointerInteractions();
    }

    function getPanelAnalyticsEls() {
      const panelEl = document.getElementById('panel-analytics');
      if (!panelEl) return null;
      return {
        panelEl,
        statGrid: panelEl.querySelector('.analytics-stat-grid'),
        topGrid: panelEl.querySelector('.analytics-top-grid'),
        perPlatformCards: Array.from(panelEl.querySelectorAll('.analytics-card')).filter((c) => c.querySelector('.analytics-card-title')),
        breakdownCard: Array.from(panelEl.querySelectorAll('.analytics-card')).find((c) => c.querySelector('.analytics-card-title')?.textContent?.trim() === 'Per-platform breakdown'),
      };
    }

    function updateStatCards({ totalStreams, endedCount, peakViewers, platformsConnected }) {
      const panelEl = document.getElementById('panel-analytics');
      if (!panelEl) return;

      const cards = Array.from(panelEl.querySelectorAll('.analytics-stat-card'));
      const setByLabel = (needle, valueHtml) => {
        const card = cards.find((c) => c.querySelector('.analytics-stat-label')?.textContent?.trim() === needle);
        const valEl = card?.querySelector('.analytics-stat-value');
        if (valEl) valEl.textContent = valueHtml;
      };

      // "Total Hours Streamed" is based on ended streams (mock: streams * 1.5hrs).
      const hoursStreamed = endedCount * 1.5;
      setByLabel('Total Hours Streamed', `${hoursStreamed.toFixed(1)} hrs`);
      setByLabel('Peak Viewers (all time)', new Intl.NumberFormat().format(peakViewers || 0));
      setByLabel('Total Streams', String(totalStreams || 0));
      setByLabel('Platforms Connected', String(platformsConnected || 0));
    }

    function updateTopStreams(streams) {
      const panelEl = document.getElementById('panel-analytics');
      const topGrid = panelEl?.querySelector('.analytics-top-grid');
      if (!topGrid) return;

      const ended = (streams || []).filter((s) => String(s.status || '').toLowerCase() === 'ended');
      const sorted = ended.length ? ended : (streams || []);
      sorted.sort((a, b) => Number(b.viewerPeak || 0) - Number(a.viewerPeak || 0));
      const top3 = sorted.slice(0, 3);

      const cards = Array.from(topGrid.querySelectorAll('.analytics-top-card'));
      for (let i = 0; i < cards.length; i += 1) {
        const card = cards[i];
        const stream = top3[i];
        if (!stream) {
          card.hidden = true;
          continue;
        }
        card.hidden = false;

        const title = card.querySelector('.analytics-top-title');
        const date = card.querySelector('.analytics-top-date');
        const peak = card.querySelector('.analytics-top-peak strong');
        const platformsWrap = card.querySelector('.analytics-top-platforms');
        const engagementBar = card.querySelector('.analytics-engagement-bar');
        const engagementLabel = card.querySelector('.analytics-engagement-label');

        const subj = stream.subject || 'General Research';
        title.textContent = String(stream.title || 'Untitled');
        date.textContent = formatTopStreamDate(stream.createdAt, subj);
        peak.textContent = new Intl.NumberFormat().format(Number(stream.viewerPeak || 0));

        const platformKeys = Array.isArray(stream.platforms) ? stream.platforms : [];
        platformsWrap.innerHTML = '';
        platformKeys.forEach((pk) => {
          const meta = getPlatformMeta(pk);
          const span = document.createElement('span');
          span.className = `stream-platform-icon stream-platform-icon--${String(pk).toLowerCase()}`;
          span.textContent = meta.icon;
          platformsWrap.appendChild(span);
        });
        if (platformKeys.length === 0) {
          platformsWrap.textContent = '—';
        }

        if (String(stream.status || '').toLowerCase() === 'ended') {
          const engagement = randomBetweenInt(50, 98);
          if (engagementBar) engagementBar.style.width = `${engagement}%`;
          if (engagementLabel) engagementLabel.textContent = `${engagement}% engagement score`;
        } else {
          if (engagementBar) engagementBar.style.width = `0%`;
          if (engagementLabel) engagementLabel.textContent = '—';
        }
      }
    }

    function updatePlatformBreakdown(destinations, streams) {
      const panelEl = document.getElementById('panel-analytics');
      const breakdownCard = Array.from(panelEl?.querySelectorAll('.analytics-card') || []).find(
        (c) => c.querySelector('.analytics-card-title')?.textContent?.trim() === 'Per-platform breakdown'
      );
      const tbody = breakdownCard?.querySelector('tbody');
      if (!tbody) return;

      const enabled = (destinations || []).filter((d) => Boolean(d.enabled));
      const streamsArr = streams || [];

      const rows = enabled.map((d) => {
        const platformKey = String(d.platform || 'custom').toLowerCase();
        const related = streamsArr.filter((s) => Array.isArray(s.platforms) && s.platforms.includes(platformKey));
        const streamCount = related.length;
        const peak = related.reduce((mx, s) => Math.max(mx, Number(s.viewerPeak || 0)), 0);

        // Avg viewers: mock computed from peak.
        const avg = Math.max(0, Math.round(peak * (0.18 + Math.random() * 0.28)));
        const totalWatchTimeHours = (avg * streamCount) / 1800; // mock

        return {
          platformKey,
          streamCount,
          avg,
          peak,
          totalWatchTimeHours,
          status: 'Connected',
        };
      });

      const maxAvg = Math.max(1, ...rows.map((r) => r.avg));
      analyticsPlatformRowsForCsv = rows.map((r) => ({
        platform: getPlatformMeta(r.platformKey).name,
        streams: r.streamCount,
        avgViewers: r.avg,
        peak: r.peak,
        totalWatchTimeHours: r.totalWatchTimeHours,
        status: r.status,
      }));

      // Render table
      tbody.innerHTML = '';
      if (rows.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="color:var(--text2);padding:18px">No connected destinations yet.</td>`;
        tbody.appendChild(tr);
        return;
      }

      rows.forEach((r) => {
        const meta = getPlatformMeta(r.platformKey);
        const pct = Math.round((r.avg / maxAvg) * 100);
        const barHtml = `
          <div class="analytics-avg-viewers">
            <div style="font-weight:900;color:#fff">${new Intl.NumberFormat().format(r.avg)}</div>
            <div class="analytics-avg-viewers-bartrack" aria-hidden="true">
              <div class="analytics-avg-viewers-barfill" style="width:${pct}%;"></div>
            </div>
          </div>
        `;
        const watchTime = `${r.totalWatchTimeHours.toFixed(1)} hrs`;
        const statusHtml =
          r.status === 'Connected'
            ? '<span class="analytics-status analytics-status--connected">Connected</span>'
            : '<span class="analytics-status">—</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <span class="analytics-platform-cell">
              <span class="stream-platform-icon stream-platform-icon--${escapeHtml(r.platformKey)}">${escapeHtml(meta.icon)}</span>
              ${escapeHtml(meta.name)}
            </span>
          </td>
          <td>${r.streamCount}</td>
          <td>${barHtml}</td>
          <td>${new Intl.NumberFormat().format(r.peak)}</td>
          <td>${watchTime}</td>
          <td>${statusHtml}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    function updateStatsAndLists(streams, destinations) {
      const totalStreams = (streams || []).length;
      const ended = (streams || []).filter((s) => String(s.status || '').toLowerCase() === 'ended');
      const endedCount = ended.length;
      const peakViewers = Math.max(0, ...streams.map((s) => Number(s.viewerPeak || 0)));
      const platformsConnected = (destinations || []).filter((d) => Boolean(d.enabled)).length;

      updateStatCards({ totalStreams, endedCount, peakViewers, platformsConnected });
      updateTopStreams(streams);
      updatePlatformBreakdown(destinations, streams);
    }

    function exportAnalyticsPlatformCsv() {
      // Use the cached breakdown rows from the last render.
      const rows = analyticsPlatformRowsForCsv || [];
      if (!rows.length) {
        showToast('No platform breakdown data to export.', 'error');
        return;
      }

      const header = ['Platform', 'Streams', 'Avg Viewers', 'Peak', 'Total Watch Time (hrs)', 'Status'];
      const lines = [header.join(',')];
      rows.forEach((r) => {
        const line = [
          escapeCsv(r.platform),
          String(r.streams ?? 0),
          String(r.avgViewers ?? 0),
          String(r.peak ?? 0),
          String((r.totalWatchTimeHours ?? 0).toFixed(1)),
          escapeCsv(r.status),
        ].join(',');
        lines.push(line);
      });

      const csv = lines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'researchium_platform_breakdown.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function escapeCsv(value) {
      const s = String(value ?? '');
      // Quote if it contains special chars
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }

    async function refreshAnalyticsPanel() {
      ensureAnalyticsUi();
      try {
        const [streams, destinations] = await Promise.all([
          API('/streams').then((r) => r.json()),
          API('/destinations').then((r) => r.json()),
        ]);
        const safeStreams = Array.isArray(streams) ? streams : [];
        const safeDestinations = Array.isArray(destinations) ? destinations : [];

        analyticsCachedStreams = safeStreams;
        analyticsCachedDestinations = safeDestinations;

        updateStatsAndLists(safeStreams, safeDestinations);
        await renderAnalyticsChartFromCache(true);
      } catch {
        showToast('Failed to load analytics.', 'error');
      }
    }

    function initAnalyticsChart() {
      // Keep the old entrypoint name: it is called by nav + page init.
      void refreshAnalyticsPanel();
    }

    if (params.get('panel') === 'analytics') {
      showPanel('analytics');
      initAnalyticsChart();
    }

    // -----------------------------
    // Schedule manager (API-backed)
    // -----------------------------
    let scheduleData = [];
    let scheduleViewMode = 'month';
    let scheduleCursor = new Date();
    scheduleCursor.setDate(1);
    scheduleCursor.setHours(0, 0, 0, 0);
    let selectedScheduleDayKey = null;

    const SCHEDULE_PLATFORM_COLORS = {
      youtube: '#FF0000',
      twitch: '#9146FF',
      facebook: '#1877F2',
      linkedin: '#0A66C2',
      twitter: '#000000',
      tiktok: '#010101',
      kick: '#53FC18',
      instagram: '#E1306C',
      custom: '#6366f1',
    };

    function formatScheduleDateInput(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    function scheduleDateKey(d) {
      return formatScheduleDateInput(d);
    }

    function getScheduleEntryDate(entry) {
      if (entry?.scheduledAt) return new Date(entry.scheduledAt);
      if (entry?.date && entry?.time) {
        const t = String(entry.time).length === 5 ? `${entry.time}:00` : String(entry.time);
        return new Date(`${entry.date}T${t}`);
      }
      if (entry?.startAt) return new Date(entry.startAt);
      return new Date();
    }

    function scheduleEntryDayKey(entry) {
      return scheduleDateKey(getScheduleEntryDate(entry));
    }

    async function refreshScheduleFromApi() {
      try {
        const res = await API('/schedule');
        const data = await res.json().catch(() => []);
        scheduleData = Array.isArray(data) ? data : [];
      } catch {
        scheduleData = [];
        showToast('Failed to load schedule.', 'error');
      }
      renderScheduleAll();
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
      return scheduleData.filter((e) => scheduleEntryDayKey(e) === dayKey);
    }

    function getScheduleDotColor(entry) {
      const key = Array.isArray(entry.platforms) && entry.platforms[0];
      return SCHEDULE_PLATFORM_COLORS[key] || SCHEDULE_PLATFORM_COLORS.custom;
    }

    function fillScheduleModalFromEntry(entry) {
      const d = getScheduleEntryDate(entry);
      openScheduleModal({
        editId: entry.id,
        date: entry.date || formatScheduleDateInput(d),
        time: entry.time || `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        title: entry.title,
        subject: entry.subject,
        description: entry.description || '',
        repeat: entry.repeat || 'none',
        notifyStudents: Boolean(entry.notifyStudents),
        platforms: entry.platforms || [],
      });
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
          dot.style.background = getScheduleDotColor(ev);
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
      const backdrop = document.getElementById('scheduleDrawerBackdrop');
      const heading = document.getElementById('scheduleDayHeading');
      const list = document.getElementById('scheduleDayList');
      if (!sidebar || !list) return;

      const key = scheduleDateKey(day);
      const events = eventsOnDay(key).sort(
        (a, b) => getScheduleEntryDate(a) - getScheduleEntryDate(b)
      );

      if (heading) heading.textContent = formatScheduleDayHeading(day);
      list.innerHTML = '';

      if (!events.length) {
        list.innerHTML = '<p class="schedule-day-empty">No streams scheduled for this day.</p>';
      } else {
        events.forEach((ev) => {
          const card = document.createElement('div');
          card.className = 'schedule-day-card';

          const head = document.createElement('div');
          head.className = 'schedule-day-card-head';

          const chip = document.createElement('span');
          chip.className = 'schedule-time-chip schedule-day-card-chip';
          chip.textContent = formatScheduleTime(getScheduleEntryDate(ev)).toUpperCase();

          const editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'btn btn-ghost btn-small';
          editBtn.textContent = 'Edit';
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fillScheduleModalFromEntry(ev);
          });

          head.append(chip, editBtn);

          const title = document.createElement('div');
          title.className = 'schedule-day-card-title';
          title.textContent = ev.title;

          const subject = document.createElement('div');
          subject.className = 'schedule-day-card-subject';
          subject.textContent = ev.subject || 'General Research';

          const plats = document.createElement('div');
          plats.className = 'schedule-day-card-platforms';
          renderPlatformIcons(plats, ev.platforms);

          card.append(head, title, subject, plats);
          list.appendChild(card);
        });
      }

      sidebar.classList.add('is-open');
      sidebar.setAttribute('aria-hidden', 'false');
      if (backdrop) {
        backdrop.hidden = false;
        backdrop.classList.add('is-open');
        backdrop.setAttribute('aria-hidden', 'false');
      }
      sidebar.dataset.selectedDate = key;
    }

    function closeScheduleDaySidebar() {
      const sidebar = document.getElementById('scheduleDaySidebar');
      const backdrop = document.getElementById('scheduleDrawerBackdrop');
      if (sidebar) {
        sidebar.classList.remove('is-open');
        sidebar.setAttribute('aria-hidden', 'true');
      }
      if (backdrop) {
        backdrop.classList.remove('is-open');
        backdrop.hidden = true;
        backdrop.setAttribute('aria-hidden', 'true');
      }
      selectedScheduleDayKey = null;
      renderScheduleCalendar();
    }

    function renderScheduleUpcoming() {
      const list = document.getElementById('scheduleUpcomingList');
      if (!list) return;
      const now = new Date();
      const upcoming = scheduleData
        .filter((e) => getScheduleEntryDate(e) >= now)
        .sort((a, b) => getScheduleEntryDate(a) - getScheduleEntryDate(b))
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
        if (isSameDay(getScheduleEntryDate(ev), today)) chip.classList.add('schedule-time-chip--today');
        chip.textContent = formatUpcomingChip(getScheduleEntryDate(ev).toISOString());

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
          fillScheduleModalFromEntry(ev);
        });
        const liveBtn = document.createElement('button');
        liveBtn.type = 'button';
        liveBtn.className = 'btn btn-primary btn-small';
        liveBtn.textContent = 'Go live now';
        liveBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          void goLiveFromSchedule(ev);
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

    async function deleteScheduleItem(id) {
      if (!id) return;
      try {
        const res = await API(`/schedule/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          showToast(data.error || 'Failed to delete schedule item.', 'error');
          return;
        }
        editingScheduleId = null;
        closeModal();
        closeScheduleDaySidebar();
        await refreshScheduleFromApi();
        showToast('Schedule item removed.', 'success');
      } catch {
        showToast('Failed to delete schedule item.', 'error');
      }
    }

    async function goLiveFromSchedule(entry) {
      const title = String(entry?.title || '').trim() || 'Live stream';
      try {
        await API('/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            live: true,
            title,
            viewers: 0,
            bitrate: 0,
            durationSeconds: 0,
          }),
        });
      } catch {
        showToast('Failed to set live status.', 'error');
        return;
      }

      const titleInput = document.getElementById('streamTitleInput');
      if (titleInput) titleInput.value = title;
      const category = document.getElementById('streamCategorySelect');
      if (category && entry?.subject) category.value = entry.subject;
      showToast('You are live! Open Go Live to manage your stream.', 'success');
      showPanel('go-live');
      setLiveUi(true, { viewers: 0, bitrate: 0, durationSeconds: 0 });
    }

    async function saveScheduleFromForm(e) {
      e.preventDefault();
      const title = String(document.getElementById('scheduleTitle')?.value || '').trim();
      const subject = document.getElementById('scheduleSubject')?.value || 'General Research';
      const date = document.getElementById('scheduleDate')?.value;
      const time = document.getElementById('scheduleTime')?.value;
      if (!title || !date || !time) {
        showToast('Please fill in title, date, and time.', 'error');
        return;
      }

      const platforms = [];
      document.querySelectorAll('#schedulePlatformChecks input:checked').forEach((input) => {
        platforms.push(input.value);
      });

      const payload = {
        title,
        subject,
        date,
        time,
        repeat: document.getElementById('scheduleRepeat')?.value || 'none',
        description: document.getElementById('scheduleDescription')?.value || '',
        platforms,
        notifyStudents: Boolean(document.getElementById('scheduleNotify')?.checked),
      };

      try {
        if (editingScheduleId) {
          await API(`/schedule/${encodeURIComponent(editingScheduleId)}`, { method: 'DELETE' });
        }
        const res = await API('/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          showToast(data.error || 'Failed to save schedule.', 'error');
          return;
        }

        editingScheduleId = null;
        closeModal();
        await refreshScheduleFromApi();

        const start = getScheduleEntryDate({ date, time, scheduledAt: `${date}T${time.length === 5 ? `${time}:00` : time}` });
        const key = scheduleDateKey(start);
        selectedScheduleDayKey = key;
        openScheduleDaySidebar(start);

        const dateLabel = start.toLocaleDateString([], {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
        showToast(`Class scheduled for ${dateLabel}!`, 'success');
      } catch {
        showToast('Failed to save schedule.', 'error');
      }
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
      document.getElementById('scheduleForm')?.addEventListener('submit', (ev) => {
        void saveScheduleFromForm(ev);
      });
      document.getElementById('scheduleDeleteBtn')?.addEventListener('click', () => {
        if (editingScheduleId) void deleteScheduleItem(editingScheduleId);
      });
      document.getElementById('scheduleDrawerBackdrop')?.addEventListener('click', closeScheduleDaySidebar);
    }

    bindScheduleUi();
    void refreshScheduleFromApi();

    initGoLiveSetup();
    bindEncoderActions();
    renderActiveDestinationsRow();
    initStudioPreview();
    ensureUnifiedChat();
    initAnalyticsChart();
})();


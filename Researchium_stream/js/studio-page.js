/**
 * Studio page controller — wires UI to API + signaling.
 */
(function () {
  const auth = window.ResearchiumStudio;
  const api = window.ResearchiumStudioApi;
  const signaling = window.ResearchiumStudioSignaling;
  const webrtc = window.ResearchiumWebRTC;
  const room = window.ResearchiumStudioRoom;
  const safe = window.ResearchiumSafe;
  const media = room.media;
  const params = new URLSearchParams(location.search);
  const isGuest = params.get('guest') === '1';

  const session = room.loadSession();
  const profile = room.loadProfile();
  const slug = room.roomSlug();

  if (!slug || (!auth.getToken() && !isGuest)) {
    location.replace('studio-lobby.html');
    return;
  }

  let studioState = null;
  let live = false;
  let liveTimer = null;
  let liveSeconds = 0;
  let screenStream = null;
  let activeDrawer = null;
  let chatSince = null;
  let chatPollTimer = null;
  let notesSaveTimer = null;
  let lastGuestInviteUrl = '';
  let meetMode = false;
  let clockTimer = null;
  let myPeerId = session?.peerId || null;
  let sceneMode = 'browser';
  let obsScenes = [];
  let obsCurrentScene = '';
  const controls = window.ResearchiumStudioControls;

  const hostName = profile.name || 'Host';

  document.getElementById('meetCode').textContent = slug;

  document.getElementById('hostLabel').textContent = profile.title
    ? `${hostName} · ${profile.title}`
    : hostName;
  document.getElementById('avatarPortrait').textContent = room.initials(hostName);
  document.getElementById('avatarLandscape').textContent = room.initials(hostName);

  function setCtrlState(btn, on) {
    btn.classList.toggle('off', !on);
  }

  function updatePreviews() {
    const hasVideo =
      media.isGranted() && media.videoEnabled && media.getStream()?.getVideoTracks().length;
    const vP = document.getElementById('videoPortrait');
    const vL = document.getElementById('videoLandscape');
    const aP = document.getElementById('avatarPortrait');
    const aL = document.getElementById('avatarLandscape');

    if (hasVideo && !screenStream) {
      media.attachPreview(vP);
      vL.srcObject = media.getStream();
      vL.play?.().catch(() => {});
      vP.style.display = vL.style.display = 'block';
      aP.style.display = aL.style.display = 'none';
    } else if (!screenStream) {
      vP.style.display = vL.style.display = 'none';
      aP.style.display = aL.style.display = 'flex';
    }
    setCtrlState(document.getElementById('ctrlMic'), media.isGranted() && media.audioEnabled);
    setCtrlState(document.getElementById('ctrlCam'), hasVideo);
    checkMediaAlert();
    webrtc.refreshLocalTracks();
  }

  function updateMeetGridCount() {
    const grid = document.getElementById('meetGrid');
    if (!grid) return;
    const count = Math.min(9, Math.max(1, webrtc.peerCount));
    grid.className = 'meet-grid count-' + count;
  }

  function setViewMode(meet) {
    meetMode = meet;
    document.getElementById('meetView')?.classList.toggle('hidden', !meet);
    document.getElementById('broadcastView')?.classList.toggle('hidden', meet);
    document.getElementById('layoutRow')?.classList.toggle('hidden', meet);
    if (meet) {
      const grid = document.getElementById('meetGrid');
      webrtc.mountLocal(grid, hostName);
      updateMeetGridCount();
    }
  }

  function startClock() {
    const el = document.getElementById('meetClock');
    if (!el) return;
    const tick = () => {
      const d = new Date();
      el.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    tick();
    clockTimer = setInterval(tick, 30_000);
  }

  function checkMediaAlert() {
    const el = document.getElementById('mediaAlert');
    if (!media.isGranted()) {
      el.textContent = 'Allow mic/cam from the lobby or use the controls below.';
      el.classList.add('show');
      return;
    }
    if (!media.audioEnabled) {
      el.textContent =
        "Can't access microphone with selected settings. Turn the mic on or change device in Settings.";
      el.classList.add('show');
      return;
    }
    el.classList.remove('show');
  }

  function renderScenes() {
    const list = document.getElementById('sceneList');
    const hint = document.getElementById('obsSceneHint');
    if (!list) return;
    list.innerHTML = '';

    if (sceneMode === 'obs') {
      if (hint) hint.style.display = obsScenes.length ? 'none' : 'block';
      obsScenes.forEach((name) => {
        const el = document.createElement('div');
        el.className = 'scene-item' + (name === obsCurrentScene ? ' active' : '');
        el.dataset.obsScene = name;
        const thumb = document.createElement('div');
        thumb.className = 'scene-thumb';
        thumb.textContent = '🎬';
        const label = document.createElement('span');
        label.className = 'scene-name';
        label.textContent = name;
        el.appendChild(thumb);
        el.appendChild(label);
        el.addEventListener('click', () => selectObsScene(name));
        list.appendChild(el);
      });
      return;
    }

    if (hint) hint.style.display = 'none';
    if (!studioState?.scenes) return;
    studioState.scenes.forEach((s) => {
      const el = document.createElement('div');
      el.className = 'scene-item' + (s.isActive ? ' active' : '');
      el.dataset.sceneId = s.id;
      el.dataset.sceneSlug = s.slug;
      const thumb = document.createElement('div');
      thumb.className = 'scene-thumb';
      thumb.textContent = s.slug === 'demo' ? '📊' : '👤';
      const name = document.createElement('span');
      name.className = 'scene-name';
      name.textContent = s.name || '';
      el.appendChild(thumb);
      el.appendChild(name);
      el.addEventListener('click', () => selectScene(s.id, s.slug));
      list.appendChild(el);
    });
  }

  async function refreshObsScenes() {
    if (!controls || isGuest) return;
    try {
      const data = await controls.obsScenes();
      obsScenes = (data.scenes || []).map((s) => s.sceneName || s.name).filter(Boolean);
      obsCurrentScene = data.currentProgramScene || '';
      if (sceneMode === 'obs') renderScenes();
    } catch {
      obsScenes = [];
    }
  }

  async function selectObsScene(sceneName) {
    if (isGuest || !controls) return;
    try {
      await controls.switchObsScene(sceneName);
      obsCurrentScene = sceneName;
      renderScenes();
      const socket = signaling.getSocket?.();
      socket?.emit('studio-scene-switch', { roomId: slug, source: 'obs', sceneName });
      signaling.emitState({ obsScene: sceneName });
    } catch (e) {
      alert(e.message || 'OBS scene switch failed');
    }
  }

  async function selectScene(sceneId, sceneSlug) {
    if (isGuest) return;
    try {
      await api.activateScene(slug, sceneId);
      studioState.scenes.forEach((s) => {
        s.isActive = s.id === sceneId;
      });
      renderScenes();
      if (sceneSlug === 'demo') {
        document.getElementById('stageLandscape').style.background =
          'linear-gradient(135deg,#1e3a5f,#312e81)';
      } else {
        document.getElementById('stageLandscape').style.background = '#0f1117';
      }
      signaling.emitState({ activeSceneId: sceneId });
      const layout =
        document.querySelector('.layout-btn.active')?.dataset.layout || 'side';
      const socket = signaling.getSocket?.();
      socket?.emit('studio-scene-switch', { roomId: slug, sceneId, layout });
      controls?.switchBrowserScene(slug, { sceneId, layout }).catch(() => {});
    } catch (e) {
      console.warn('[studio] scene', e.message);
    }
  }

  function setSceneMode(mode) {
    sceneMode = mode;
    document.getElementById('sceneModeBrowser')?.classList.toggle('active', mode === 'browser');
    document.getElementById('sceneModeObs')?.classList.toggle('active', mode === 'obs');
    document.getElementById('btnAddScene').style.display = mode === 'obs' ? 'none' : '';
    renderScenes();
    if (mode === 'obs') refreshObsScenes();
  }

  function mountReactStudio(socket) {
    if (isGuest) return;
    const loader = window.ResearchiumStreamComponentsLoader;
    if (!loader) return;
    loader
      .init({
        roomSlug: slug,
        viewerEl: document.getElementById('reactViewerTopbar'),
        viewerCompact: true,
        intervalMs: 5000,
        controlsEl: document.getElementById('reactStreamControls'),
        title: studioState?.stream?.title || 'Studio',
        onLiveChange: ({ live }) => {
          live = !!live;
          const btn = document.getElementById('btnGoLive');
          if (btn && live !== undefined) {
            if (live) {
              btn.textContent = '■ END STREAM';
              btn.classList.add('is-live');
            } else {
              btn.textContent = 'GO LIVE';
              btn.classList.remove('is-live');
            }
          }
        },
      })
      .then((ok) => {
        if (ok) {
          document.getElementById('layoutRow')?.classList.add('hidden');
        }
      });
  }

  let reactChatMounted = false;

  function mountReactChatDrawer() {
    if (isGuest || reactChatMounted) return;
    const body = document.getElementById('drawerBody');
    const loader = window.ResearchiumStreamComponentsLoader;
    if (!loader || !body) return;
    body.innerHTML = '<div id="reactChatMount" style="height:min(420px,60vh)"></div>';
    loader.init({
      roomSlug: slug,
      chatEl: document.getElementById('reactChatMount'),
      authorName: hostName,
      chatHeight: 380,
    });
    document.getElementById('drawerFooter').style.display = 'none';
    reactChatMounted = true;
  }

  function initStudioControls(socket) {
    if (!controls || isGuest) return;
    controls.mountOverlayLayer();
    controls.bindSignaling(socket, slug, {
      onAnalytics(data) {
        controls.renderAnalyticsBar(
          data,
          document.getElementById('totalViewers'),
          document.getElementById('platformViewers')
        );
      },
      onObsScene(name) {
        obsCurrentScene = name;
        if (sceneMode === 'obs') renderScenes();
      },
    });
    controls.subscribeAnalytics(socket, slug);
    controls.startAnalytics(slug).catch(() => {});
    refreshObsScenes();
  }

  function renderGraphicsPanel(body) {
    body.innerHTML = `
      <div class="controls-section">
        <h4>OBS WEBSOCKET</h4>
        <div class="controls-row">
          <input id="obsHost" placeholder="Host" value="127.0.0.1"/>
          <input id="obsPort" placeholder="Port" value="4455"/>
        </div>
        <div class="controls-row">
          <input id="obsPass" type="password" placeholder="Password (optional)"/>
        </div>
        <div class="controls-row">
          <button type="button" class="btn-studio-sm primary" id="btnObsConnect">Connect OBS</button>
          <button type="button" class="btn-studio-sm" id="btnObsDisconnect">Disconnect</button>
        </div>
        <p id="obsStatusText" style="font-size:12px;color:var(--text2);margin-top:8px">Not connected</p>
      </div>
      <div class="controls-section">
        <h4>OVERLAYS</h4>
        <div class="controls-row">
          <button type="button" class="btn-studio-sm" data-overlay="alert">Test alert</button>
          <button type="button" class="btn-studio-sm" data-overlay="donation">Test donation</button>
          <button type="button" class="btn-studio-sm" data-overlay="follower">Test follower</button>
        </div>
        <ul class="follower-list" id="recentFollowers"></ul>
      </div>`;

    body.querySelector('#btnObsConnect')?.addEventListener('click', async () => {
      const host = body.querySelector('#obsHost')?.value.trim();
      const port = body.querySelector('#obsPort')?.value.trim();
      const password = body.querySelector('#obsPass')?.value;
      try {
        await controls.connectObs({ host, port, password });
        body.querySelector('#obsStatusText').textContent = 'Connected to OBS';
        setSceneMode('obs');
        await refreshObsScenes();
      } catch (e) {
        body.querySelector('#obsStatusText').textContent = e.message;
      }
    });

    body.querySelector('#btnObsDisconnect')?.addEventListener('click', async () => {
      await controls.disconnectObs().catch(() => {});
      body.querySelector('#obsStatusText').textContent = 'Disconnected';
      obsScenes = [];
      setSceneMode('browser');
    });

    body.querySelectorAll('[data-overlay]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const type = btn.dataset.overlay;
        const samples = {
          alert: { title: 'New research question', subtitle: 'From unified chat' },
          donation: { title: 'Supporter', amount: '25', subtitle: 'Thanks for supporting research!' },
          follower: { title: 'New follower', user: 'Alex R.', platform: 'twitch' },
        };
        try {
          await controls.triggerOverlay(slug, type, samples[type] || {});
        } catch (e) {
          alert(e.message);
        }
      });
    });

    controls.getOverlays(slug).then((state) => {
      const ul = body.querySelector('#recentFollowers');
      if (!ul) return;
      ul.innerHTML = (state.recentFollowers || [])
        .map((f) => `<li>${f.name || 'Follower'} · ${f.platform || 'studio'}</li>`)
        .join('') || '<li style="opacity:.6">No recent followers yet</li>';
    });

    controls.obsStatus().then((st) => {
      if (st.connected) {
        body.querySelector('#obsStatusText').textContent = `OBS ${st.obsVersion || ''} connected`;
        refreshObsScenes();
      }
    });
  }

  function renderChatMessages(messages, box) {
    if (!box) return;
    box.innerHTML = '';
    (messages || []).forEach((m) => {
      if (activeDrawer === 'chat' && m.isPrivate) return;
      const div = safe.appendChatMessage(box, m.authorName || m.author_name, m.body);
      div.dataset.id = m.id;
    });
    box.scrollTop = box.scrollHeight;
  }

  async function refreshChat() {
    try {
      const { messages } = await api.getChat(slug, { since: chatSince || undefined });
      if (!messages?.length) return;
      chatSince = messages[messages.length - 1].createdAt || messages[messages.length - 1].created_at;
      const box = document.getElementById('chatMessages');
      if (box) {
        messages.forEach((m) => {
          if (box.querySelector(`[data-id="${m.id}"]`)) return;
          const div = safe.appendChatMessage(box, m.authorName || m.author_name, m.body);
          div.dataset.id = m.id;
        });
        box.scrollTop = box.scrollHeight;
      }
    } catch {
      /* API offline */
    }
  }

  function applyStudioUI() {
    if (!studioState) return;
    document.title = (studioState.stream?.title || 'Studio') + ' – Researchium';
    live = studioState.isLive;
    const btn = document.getElementById('btnGoLive');
    const rec = document.getElementById('recStatus');
    document.getElementById('streamQuality').textContent =
      studioState.session?.streamQuality || '720p';
    rec.textContent = studioState.session?.recordingEnabled ? 'ON' : 'OFF';
    if (live) {
      btn.textContent = '■ END STREAM';
      btn.classList.add('is-live');
    }
    const layout = studioState.session?.layout || 'side';
    document.querySelectorAll('.layout-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.layout === layout);
    });
    setViewMode(layout === 'grid' || layout === 'solo');
    renderScenes();
  }

  function setupWebRTC(peerId) {
    myPeerId = peerId;
    webrtc.init({
      peerId,
      name: hostName,
      getStream: () => media.getStream(),
      onSignal: (target, payload) => signaling.sendSignal(target, payload),
      onPeersChanged: updateMeetGridCount,
    });
  }

  function connectSignaling(url, token, peerId) {
    setupWebRTC(peerId);
    signaling.connect({
      url: url || api.getSignalingBase(),
      token,
      handlers: {
        onConnect() {
          const grid = document.getElementById('meetGrid');
          if (meetMode && grid) webrtc.mountLocal(grid, hostName);
        },
        onPeers(peerIds) {
          webrtc.syncPeers(peerIds);
        },
        onPeerJoined({ peerId: pid }) {
          webrtc.onPeerJoined(pid);
          playJoinSound();
        },
        onPeerLeft({ peerId: pid }) {
          webrtc.onPeerLeft(pid);
        },
        onSignal({ fromPeerId, payload }) {
          webrtc.handleSignal(fromPeerId, payload);
        },
        onChat(msg) {
          const box = document.getElementById('chatMessages');
          if (!box || !msg?.body) return;
          safe.appendChatMessage(box, msg.authorName || 'Guest', msg.body);
          box.scrollTop = box.scrollHeight;
        },
        onState(patch) {
          if (patch?.layout) {
            document.querySelectorAll('.layout-btn').forEach((b) => {
              b.classList.toggle('active', b.dataset.layout === patch.layout);
            });
            setViewMode(patch.layout === 'grid' || patch.layout === 'solo');
          }
          if (patch?.obsScene) {
            obsCurrentScene = patch.obsScene;
            if (sceneMode === 'obs') renderScenes();
          }
        },
      },
    });
    if (!isGuest) {
      initStudioControls(signaling.getSocket?.());
      mountReactStudio(signaling.getSocket?.());
    }
  }

  function playJoinSound() {
    /* optional participant-joined cue — no external assets */
  }

  async function loadStudio() {
    try {
      if (isGuest) {
        const data = await api.getRoom(slug);
        studioState = data.studio;
        if (session.signalingToken) {
          connectSignaling(session.signalingUrl, session.signalingToken, session.peerId);
        }
      } else {
        const data = await api.getRoomHost(slug);
        studioState = data.studio;
        room.saveSession({ ...session, roomSlug: slug, studio: studioState, ...data });
        connectSignaling(data.signalingUrl, data.signalingToken, data.peerId);
      }
      applyStudioUI();
      if (!chatPollTimer) {
        chatPollTimer = setInterval(refreshChat, 3000);
      }
    } catch (e) {
      document.getElementById('mediaAlert').textContent =
        'Could not load studio from API. Is npm run dev:api running on port 4000?';
      document.getElementById('mediaAlert').classList.add('show');
    }
  }

  async function initMedia() {
    const noCam = room.noCamera();
    if (sessionStorage.getItem('researchium_media_granted') !== '1') {
      updatePreviews();
      return;
    }
    try {
      const prefs = media.loadPrefs();
      if (noCam) {
        await media.ensureAccess({ video: false, audio: true });
        media.setVideoEnabled(false);
      } else {
        await media.requestAccess(prefs);
      }
      updatePreviews();
    } catch (err) {
      document.getElementById('mediaAlert').textContent = media.getErrorMessage(err);
      document.getElementById('mediaAlert').classList.add('show');
    }
  }

  async function openDrawer(panel) {
    const drawer = document.getElementById('drawer');
    const title = document.getElementById('drawerTitle');
    const body = document.getElementById('drawerBody');
    const footer = document.getElementById('drawerFooter');
    document.querySelectorAll('.tool-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.panel === panel)
    );
    activeDrawer = panel;
    footer.style.display =
      panel === 'notes' || (panel === 'chat' && !window.ResearchiumStreamComponentsLoader)
        ? 'flex'
        : 'none';
    if (panel === 'people') footer.style.display = 'none';

    if (panel === 'people') {
      title.textContent = 'People';
      const ids = webrtc.listParticipantIds();
      body.innerHTML = `<div class="people-list" id="peopleList"></div>`;
      const list = document.getElementById('peopleList');
      ids.forEach((id) => {
        const row = document.createElement('div');
        row.className = 'people-row';
        const label = id === myPeerId ? `${hostName} (You)` : id.slice(0, 8);
        const dot = document.createElement('span');
        dot.className = 'dot-live';
        const span = document.createElement('span');
        span.textContent = label;
        row.appendChild(dot);
        row.appendChild(span);
        list.appendChild(row);
      });
      if (!ids.length) {
        body.innerHTML = '<p style="color:var(--text2);font-size:13px">No participants yet.</p>';
      }
    } else if (panel === 'chat') {
      title.textContent = 'Unified stream chat';
      reactChatMounted = false;
      if (window.ResearchiumStreamComponentsLoader) {
        mountReactChatDrawer();
      } else {
        body.innerHTML =
          '<p style="color:var(--text2);font-size:12px;margin-bottom:10px;line-height:1.5">Messages from YouTube, Twitch, and Facebook appear here. Connect platforms in the <a href="stream-dashboard.html?panel=destinations" style="color:var(--accent-soft)">Destinations</a> dashboard.</p><div class="chat-messages" id="unifiedChatMessages" style="max-height:50vh;overflow-y:auto"></div><div class="chat-messages" id="chatMessages" style="display:none"></div>';
        const ucBox = document.getElementById('unifiedChatMessages');
        if (window.ResearchiumUnifiedChat && ucBox) {
          window.ResearchiumUnifiedChat.mount(ucBox, {
            roomId: slug,
            name: hostName,
            isHost: !isGuest,
          });
        }
        renderChatMessages(studioState?.messages, document.getElementById('chatMessages'));
        await refreshChat();
        footer.style.display = 'flex';
      }
    } else if (panel === 'guests' && !isGuest) {
      title.textContent = 'Invite guest';
      body.innerHTML =
        '<div class="guest-card"><strong>Invite link</strong><p id="guestLinkText">Generating…</p><button type="button" class="btn-sm" id="copyGuestLink">Copy link</button></div><div id="guestList"></div>';
      try {
        const { guest } = await api.createGuestInvite(slug);
        lastGuestInviteUrl = guest.inviteUrl;
        document.getElementById('guestLinkText').textContent = lastGuestInviteUrl;
        document.getElementById('copyGuestLink')?.addEventListener('click', () => {
          navigator.clipboard?.writeText(lastGuestInviteUrl);
        });
        const list = document.getElementById('guestList');
        (studioState.guests || []).forEach((g) => {
          const card = document.createElement('div');
          card.className = 'guest-card';
          const title = document.createElement('strong');
          title.textContent = g.displayName || 'Invited guest';
          const status = document.createElement('p');
          status.textContent = `Status: ${g.status || 'pending'}`;
          card.appendChild(title);
          card.appendChild(status);
          list.appendChild(card);
        });
      } catch {
        document.getElementById('guestLinkText').textContent = `${location.origin}/join.html?room=${slug}`;
      }
    } else if (panel === 'notes' && !isGuest) {
      title.textContent = 'Presenter notes';
      body.innerHTML =
        '<textarea id="presenterNotes" style="width:100%;min-height:200px;padding:12px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--text);font-family:inherit;font-size:13px"></textarea>';
      const notes = document.getElementById('presenterNotes');
      try {
        const { notes: content } = await api.getNotes(slug);
        notes.value = content || studioState?.notes || '';
      } catch {
        notes.value = studioState?.notes || '';
      }
      notes.addEventListener('input', () => {
        clearTimeout(notesSaveTimer);
        notesSaveTimer = setTimeout(() => api.saveNotes(slug, notes.value).catch(() => {}), 800);
      });
    } else if (panel === 'graphics' && !isGuest && controls) {
      title.textContent = 'Studio controls';
      renderGraphicsPanel(body);
    } else {
      const titles = {
        graphics: 'Graphics',
        captions: 'Captions',
        music: 'Music',
        theme: 'Theme',
        help: 'Help',
      };
      title.textContent = titles[panel] || 'Panel';
      body.innerHTML =
        '<p style="color:var(--text2);font-size:13px;line-height:1.6">This section is connected to the studio API. Advanced overlays and assets will appear here in a future release.</p>';
    }

    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawer').setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
    activeDrawer = null;
  }

  async function sendChat() {
    const input = document.getElementById('chatInput');
    const text = input?.value.trim();
    if (!text) return;
    input.value = '';
    try {
      if (isGuest) {
        const inviteToken = session?.inviteToken;
        if (!inviteToken) throw new Error('missing_invite');
        await auth.api(`/api/studio/room/${encodeURIComponent(slug)}/chat/guest`, {
          method: 'POST',
          body: JSON.stringify({ authorName: hostName, body: text, inviteToken }),
        });
      } else {
        await api.postChat(slug, text, false);
      }
      signaling.emitChat({ authorName: hostName, body: text });
      if (!isGuest && window.ResearchiumUnifiedChat) {
        window.ResearchiumUnifiedChat.send(slug, text, hostName);
      }
      await refreshChat();
    } catch {
      const box = document.getElementById('chatMessages');
      if (box) safe.appendChatMessage(box, hostName, text);
    }
  }

  document.querySelectorAll('.tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (activeDrawer === btn.dataset.panel) closeDrawer();
      else openDrawer(btn.dataset.panel);
    });
  });
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  document.getElementById('btnPrivateChat').addEventListener('click', () => openDrawer('chat'));
  document.getElementById('ctrlGuest').addEventListener('click', () => openDrawer('guests'));
  document.getElementById('ctrlPeople')?.addEventListener('click', () => {
    setViewMode(true);
    openDrawer('people');
  });
  document.querySelector('.tool-btn[data-panel="people"]')?.addEventListener('click', () => {
    setViewMode(true);
  });

  async function leaveCall() {
    if (!isGuest && live) {
      try {
        await api.setLive(slug, false);
      } catch {
        /* ignore */
      }
    }
    webrtc.destroy();
    signaling.disconnect();
    media.stop();
    clearInterval(liveTimer);
    clearInterval(chatPollTimer);
    clearInterval(clockTimer);
    sessionStorage.removeItem('researchium_media_granted');
    location.href = `meeting-end.html?room=${encodeURIComponent(slug)}`;
  }

  document.getElementById('ctrlLeave')?.addEventListener('click', leaveCall);
  document.addEventListener('click', (e) => {
    if (e.target.id === 'chatSend') sendChat();
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.id === 'chatInput' && e.key === 'Enter') sendChat();
  });

  document.getElementById('ctrlMic').addEventListener('click', async () => {
    try {
      if (!media.isGranted() || !media.getStream()?.getAudioTracks().length) {
        await media.ensureAccess({ audio: true, video: media.videoEnabled });
      } else {
        media.setAudioEnabled(!media.audioEnabled);
      }
      updatePreviews();
    } catch (err) {
      document.getElementById('mediaAlert').textContent = media.getErrorMessage(err);
      document.getElementById('mediaAlert').classList.add('show');
    }
  });

  document.getElementById('ctrlCam').addEventListener('click', async () => {
    try {
      if (!media.getStream()?.getVideoTracks().length) {
        await media.ensureAccess({ video: true, audio: media.audioEnabled || true });
        sessionStorage.setItem('researchium_studio_no_camera', '0');
      } else {
        media.setVideoEnabled(!media.videoEnabled);
      }
      updatePreviews();
    } catch (err) {
      document.getElementById('mediaAlert').textContent = media.getErrorMessage(err);
      document.getElementById('mediaAlert').classList.add('show');
    }
  });

  document.getElementById('ctrlScreen').addEventListener('click', async () => {
    try {
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
        screenStream = null;
        updatePreviews();
        return;
      }
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const vL = document.getElementById('videoLandscape');
      vL.srcObject = screenStream;
      vL.style.display = 'block';
      document.getElementById('avatarLandscape').style.display = 'none';
      if (!isGuest) {
        await api.addSource(slug, 'screen', 'Screen share', {});
      }
      screenStream.getVideoTracks()[0].onended = () => {
        screenStream = null;
        updatePreviews();
      };
    } catch {
      /* cancelled */
    }
  });

  document.getElementById('ctrlSettings').addEventListener('click', () => {
    location.href = 'studio-lobby.html';
  });

  document.getElementById('ctrlAdd').addEventListener('click', async () => {
    const label = prompt('Source name', 'Camera 2');
    if (!label || isGuest) return;
    try {
      await api.addSource(slug, 'media', label, {});
      alert('Source added to studio.');
    } catch {
      alert('Could not add source.');
    }
  });

  document.getElementById('btnGoLive').addEventListener('click', async () => {
    if (isGuest) return;
    const btn = document.getElementById('btnGoLive');
    btn.disabled = true;
    try {
      const next = !live;
      const data = await api.setLive(slug, next);
      studioState = data.studio;
      live = studioState.isLive;
      const rec = document.getElementById('recStatus');
      if (live) {
        btn.textContent = '■ END STREAM';
        btn.classList.add('is-live');
        rec.textContent = studioState.session?.recordingEnabled ? 'ON' : 'OFF';
        liveSeconds = 0;
        liveTimer = setInterval(() => {
          liveSeconds++;
          document.title = `● LIVE ${room.formatDuration(liveSeconds)} – Researchium`;
        }, 1000);
        signaling.emitState({ isLive: true });
        const socket = signaling.getSocket?.();
        controls?.subscribeAnalytics(socket, slug);
        controls?.startAnalytics(slug).catch(() => {});
      } else {
        btn.textContent = 'GO LIVE';
        btn.classList.remove('is-live');
        clearInterval(liveTimer);
        document.title = (studioState.stream?.title || 'Studio') + ' – Researchium';
        signaling.emitState({ isLive: false });
        controls?.stopAnalytics(slug).catch(() => {});
        const socket = signaling.getSocket?.();
        controls?.unsubscribeAnalytics(socket, slug);
      }
    } catch {
      alert('Go live failed. Check API is running.');
    } finally {
      btn.disabled = false;
    }
  });

  document.querySelectorAll('.layout-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.layout-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const layout = btn.dataset.layout;
      setViewMode(layout === 'grid' || layout === 'solo');
      if (isGuest) return;
      try {
        await api.updateRoom(slug, { layout });
        signaling.emitState({ layout });
        const socket = signaling.getSocket?.();
        const sceneConfig = { layout, sources: [] };
        socket?.emit('scene-update', { roomId: slug, sceneConfig });
      } catch {
        /* offline */
      }
    });
  });

  document.getElementById('sceneModeBrowser')?.addEventListener('click', () => setSceneMode('browser'));
  document.getElementById('sceneModeObs')?.addEventListener('click', () => setSceneMode('obs'));

  document.getElementById('btnAddScene').addEventListener('click', async () => {
    if (isGuest) return;
    const name = prompt('Scene name', 'New scene');
    if (!name) return;
    try {
      await api.createScene(slug, name);
      const data = await api.getRoomHost(slug);
      studioState = data.studio;
      renderScenes();
    } catch {
      alert('Could not add scene.');
    }
  });

  document.getElementById('btnSchedule').addEventListener('click', () => {
    const when = prompt('Schedule (ISO date/time)', '');
    if (!when || isGuest) {
      location.href = 'stream-dashboard.html';
      return;
    }
    api.updateRoom(slug, { scheduledAt: when }).finally(() => {
      location.href = 'stream-dashboard.html';
    });
  });

  startClock();
  loadStudio();
  initMedia();
})();

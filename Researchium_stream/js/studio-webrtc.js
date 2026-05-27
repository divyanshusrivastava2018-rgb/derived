/**
 * Mesh WebRTC for studio rooms (uses Socket.IO signaling relay).
 */
window.ResearchiumWebRTC = (function () {
  const ICE = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  let localPeerId = null;
  let localName = 'You';
  let getLocalStream = () => null;
  let sendSignal = () => {};
  let onTileUpdate = () => {};
  const peers = new Map();

  function createTile(peerId, name, isLocal) {
    const tile = document.createElement('div');
    tile.className = 'meet-tile' + (isLocal ? ' local' : '');
    tile.dataset.peerId = peerId;
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = isLocal;
    const avatar = document.createElement('div');
    avatar.className = 'meet-tile-avatar';
    avatar.textContent = (name || '?')
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const label = document.createElement('span');
    label.className = 'meet-tile-name';
    label.textContent = isLocal ? `${name} (You)` : name;
    const badge = document.createElement('span');
    badge.className = 'meet-tile-badge';
    tile.appendChild(video);
    tile.appendChild(avatar);
    tile.appendChild(label);
    tile.appendChild(badge);
    return { tile, video, avatar, badge, label };
  }

  function showVideo(ui, stream) {
    if (!ui) return;
    const hasVideo = stream?.getVideoTracks().some((t) => t.enabled);
    if (hasVideo) {
      ui.video.srcObject = stream;
      ui.video.style.display = 'block';
      ui.avatar.style.display = 'none';
    } else {
      ui.video.style.display = 'none';
      ui.avatar.style.display = 'flex';
    }
    const micOn = stream?.getAudioTracks().some((t) => t.enabled);
    ui.badge.textContent = micOn ? '' : '🔇';
  }

  function shouldInitiate(remotePeerId) {
    return !!localPeerId && localPeerId < remotePeerId;
  }

  async function createPc(remotePeerId, isInitiator) {
    if (peers.has(remotePeerId)) return peers.get(remotePeerId);
    const initiate = isInitiator ?? shouldInitiate(remotePeerId);

    const pc = new RTCPeerConnection(ICE);
    const stream = getLocalStream();
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    const ui = createTile(remotePeerId, remotePeerId.slice(0, 8), false);
    const entry = { pc, ui, remoteStream: null };

    pc.ontrack = (ev) => {
      const [remoteStream] = ev.streams;
      entry.remoteStream = remoteStream;
      showVideo(ui, remoteStream);
      onTileUpdate();
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        sendSignal(remotePeerId, { type: 'candidate', candidate: ev.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        removePeer(remotePeerId);
      }
    };

    peers.set(remotePeerId, entry);
    const grid = document.getElementById('meetGrid');
    if (grid) grid.appendChild(ui.tile);
    onTileUpdate();

    if (initiate) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(remotePeerId, { type: 'offer', sdp: offer });
    }

    return entry;
  }

  async function handleSignal(fromPeerId, payload) {
    if (!payload?.type || fromPeerId === localPeerId) return;
    let entry = peers.get(fromPeerId);
    if (!entry && payload.type !== 'offer') return;

    if (payload.type === 'offer') {
      entry = await createPc(fromPeerId, false);
      await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(answer);
      sendSignal(fromPeerId, { type: 'answer', sdp: answer });
    } else if (payload.type === 'answer' && entry) {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    } else if (payload.type === 'candidate' && entry?.pc.remoteDescription) {
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        /* ignore stale candidates */
      }
    }
  }

  function removePeer(peerId) {
    const entry = peers.get(peerId);
    if (!entry) return;
    entry.pc.close();
    entry.ui.tile.remove();
    peers.delete(peerId);
    onTileUpdate();
  }

  function syncPeers(peerIds) {
    const list = Array.isArray(peerIds) ? peerIds : [];
    list.forEach((id) => {
      if (id !== localPeerId && !peers.has(id)) createPc(id, shouldInitiate(id));
    });
    peers.forEach((_, id) => {
      if (!list.includes(id)) removePeer(id);
    });
    onTileUpdate();
  }

  function refreshLocalTracks() {
    const stream = getLocalStream();
    peers.forEach((entry) => {
      const senders = entry.pc.getSenders();
      stream?.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track?.kind === track.kind);
        if (sender) sender.replaceTrack(track);
        else entry.pc.addTrack(track, stream);
      });
    });
    const local = document.querySelector('.meet-tile.local');
    if (local) {
      const video = local.querySelector('video');
      const avatar = local.querySelector('.meet-tile-avatar');
      showVideo({ video, avatar, badge: local.querySelector('.meet-tile-badge') }, stream);
    }
  }

  function mountLocal(container, name) {
    localName = name || 'You';
    let local = container.querySelector('.meet-tile.local');
    if (!local) {
      const ui = createTile(localPeerId || 'local', localName, true);
      ui.tile.classList.add('local');
      container.prepend(ui.tile);
      local = ui.tile;
      showVideo(ui, getLocalStream());
    }
    onTileUpdate();
  }

  function getTiles() {
    return [...peers.values()].map((e) => e.ui.tile);
  }

  function listParticipantIds() {
    const ids = [localPeerId, ...peers.keys()].filter(Boolean);
    return [...new Set(ids)];
  }

  function destroy() {
    peers.forEach((_, id) => removePeer(id));
    peers.clear();
  }

  return {
    init({ peerId, name, getStream, onSignal, onPeersChanged }) {
      localPeerId = peerId;
      localName = name || 'You';
      getLocalStream = getStream;
      sendSignal = onSignal;
      onTileUpdate = onPeersChanged || (() => {});
    },
    handleSignal,
    syncPeers,
    onPeerJoined(peerId) {
      if (peerId !== localPeerId) createPc(peerId, shouldInitiate(peerId));
    },
    onPeerLeft(peerId) {
      removePeer(peerId);
    },
    removePeer,
    refreshLocalTracks,
    mountLocal,
    getTiles,
    listParticipantIds,
    destroy,
    get peerCount() {
      return peers.size + 1;
    },
  };
})();

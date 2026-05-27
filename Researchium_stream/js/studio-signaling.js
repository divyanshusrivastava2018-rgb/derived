/**
 * Socket.IO signaling for studio rooms (chat sync + WebRTC relay).
 */
window.ResearchiumStudioSignaling = (function () {
  let socket = null;

  function connect({ url, token, handlers = {} }) {
    if (typeof io === 'undefined') {
      console.warn('[signaling] socket.io client not loaded');
      return null;
    }
    if (socket) socket.disconnect();
    socket = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => handlers.onConnect?.());
    socket.on('disconnect', () => handlers.onDisconnect?.());
    socket.on('room-peers', (data) => handlers.onPeers?.(data));
    socket.on('peer-joined', (data) => handlers.onPeerJoined?.(data));
    socket.on('peer-left', (data) => handlers.onPeerLeft?.(data));
    socket.on('studio-chat', (msg) => handlers.onChat?.(msg));
    socket.on('studio-state', (state) => handlers.onState?.(state));
    socket.on('overlay-show', (ev) => handlers.onOverlay?.(ev));
    socket.on('analytics-update', (data) => handlers.onAnalytics?.(data));
    socket.on('signal', (data) => handlers.onSignal?.(data));
    socket.on('error', (err) => handlers.onError?.(err));
    return socket;
  }

  function sendSignal(targetPeerId, payload) {
    socket?.emit('signal', { targetPeerId, payload });
  }

  function emitChat(message) {
    socket?.emit('studio-chat', message);
  }

  function emitState(patch) {
    socket?.emit('studio-state', patch);
  }

  function disconnect() {
    socket?.disconnect();
    socket = null;
  }

  return { connect, emitChat, emitState, sendSignal, disconnect, getSocket: () => socket };
})();

/**
 * Unified cross-platform chat (YouTube, Twitch, Facebook) via studio backend Socket.IO.
 */
window.ResearchiumUnifiedChat = (function () {
  const signaling = window.ResearchiumStudioSignaling;
  const safe = window.ResearchiumSafe;

  const PLATFORM_STYLES = {
    youtube: { label: 'YT', color: '#ff0000' },
    twitch: { label: 'TW', color: '#9146ff' },
    facebook: { label: 'FB', color: '#1877f2' },
    studio: { label: 'RS', color: '#8b5cf6' },
  };

  let messagesEl = null;
  let onStatusChange = null;
  let hostName = 'Host';

  function platformBadge(platform) {
    const p = PLATFORM_STYLES[platform] || { label: '?', color: '#666' };
    return `<span class="uc-badge" style="background:${p.color}">${p.label}</span>`;
  }

  function renderMessage(msg) {
    if (!messagesEl || msg.isDeleted) return;
    const row = document.createElement('div');
    row.className = 'uc-msg';
    row.dataset.messageId = msg.id;
    row.dataset.externalId = msg.externalId || '';
    row.dataset.platform = msg.platform;
    row.dataset.authorId = msg.authorId || '';
    row.dataset.authorName = msg.authorName || '';
    row.innerHTML = `
      <div class="uc-msg-head">${platformBadge(msg.platform)}
        <strong>${safe.escapeHtml(msg.authorName)}</strong>
        <span class="uc-time">${new Date(msg.at).toLocaleTimeString()}</span>
      </div>
      <div class="uc-body"></div>
      <div class="uc-mod" hidden>
        <button type="button" data-action="timeout" data-sec="600">Timeout 10m</button>
        <button type="button" data-action="ban">Ban</button>
        <button type="button" data-action="delete">Delete</button>
      </div>`;
    row.querySelector('.uc-body').textContent = msg.body;
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      row.querySelector('.uc-mod').hidden = false;
    });
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function wireModeration(socket, roomId) {
    messagesEl?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const row = btn.closest('.uc-msg');
      if (!row) return;
      socket.emit('unified-chat-moderate', {
        roomId,
        action: btn.dataset.action,
        target: {
          platform: row.dataset.platform,
          userId: row.dataset.authorId,
          username: row.dataset.authorName,
          messageId: row.dataset.messageId,
          externalMessageId: row.dataset.externalId,
          durationSec: Number(btn.dataset.sec) || 600,
        },
      });
      row.querySelector('.uc-mod').hidden = true;
    });
  }

  function attachSocketHandlers(socket, roomId) {
    socket.on('unified-chat-message', (msg) => renderMessage(msg));
    socket.on('unified-chat-moderation', (data) => {
      if (data.action === 'delete' && data.target?.messageId) {
        const row = messagesEl?.querySelector(`[data-message-id="${data.target.messageId}"]`);
        if (row) row.remove();
      }
    });
    socket.on('unified-chat-status', (s) => onStatusChange?.(s));
    socket.on('unified-chat-error', (e) => alert(e.error || 'Chat error'));
    wireModeration(socket, roomId);
  }

  function start(roomId, config = {}) {
    const socket = signaling.getSocket();
    if (!socket) return;
    attachSocketHandlers(socket, roomId);
    socket.emit('unified-chat-start', { roomId, config });
  }

  function stop(roomId) {
    signaling.getSocket()?.emit('unified-chat-stop', { roomId });
  }

  function send(roomId, body, name) {
    signaling.getSocket()?.emit('unified-chat-send', {
      roomId,
      body,
      authorName: name || hostName,
    });
  }

  function mount(container, { roomId, name, isHost }) {
    messagesEl = container;
    hostName = name || 'Host';
    container.innerHTML = '';
    if (!container.querySelector('.uc-style')) {
      const style = document.createElement('style');
      style.className = 'uc-style';
      style.textContent = `
        .uc-msg { padding:8px 0; border-bottom:1px solid rgba(255,255,255,.06); font-size:13px; }
        .uc-msg-head { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
        .uc-badge { font-size:10px; font-weight:700; color:#fff; padding:2px 6px; border-radius:4px; }
        .uc-time { margin-left:auto; font-size:11px; opacity:.5; }
        .uc-mod { display:flex; gap:6px; margin-top:6px; flex-wrap:wrap; }
        .uc-mod button { font-size:11px; padding:4px 8px; cursor:pointer; }
        .uc-toolbar { display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap; }
        .uc-toolbar button { font-size:12px; padding:6px 10px; cursor:pointer; }
      `;
      document.head.appendChild(style);
    }

    const toolbar = document.createElement('div');
    toolbar.className = 'uc-toolbar';
    if (isHost) {
      const startBtn = document.createElement('button');
      startBtn.type = 'button';
      startBtn.textContent = 'Sync platform chat';
      startBtn.addEventListener('click', () => start(roomId, {}));
      toolbar.appendChild(startBtn);
    }
    container.parentElement?.insertBefore(toolbar, container);

    const socket = signaling.getSocket();
    if (socket) attachSocketHandlers(socket, roomId);
  }

  return {
    mount,
    start,
    stop,
    send,
    onStatus(cb) {
      onStatusChange = cb;
    },
  };
})();

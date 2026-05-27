import { useCallback, useEffect, useRef, useState } from 'react';
import { streamV1 } from '../api/streamApi';

const PLATFORM_STYLES = {
  youtube: { label: 'YT', color: '#ff0000' },
  twitch: { label: 'TW', color: '#9146ff' },
  facebook: { label: 'FB', color: '#1877f2' },
  linkedin: { label: 'LI', color: '#0a66c2' },
  studio: { label: 'RS', color: '#8b5cf6' },
};

function getSocket() {
  return window.ResearchiumStudioSignaling?.getSocket?.() || null;
}

export function UnifiedChatRoom({
  roomSlug,
  authorName = 'Host',
  autoStartRelay = true,
  height = 400,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [relayOn, setRelayOn] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const appendMessage = useCallback((msg) => {
    if (!msg?.body || msg.isDeleted) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg].slice(-300);
    });
  }, []);

  useEffect(() => {
    if (!roomSlug) return;
    let cancelled = false;

    (async () => {
      try {
        const { messages: history } = await streamV1.getChatMessages(roomSlug, { limit: 80 });
        if (!cancelled) setMessages(history || []);
      } catch {
        /* empty */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomSlug]);

  useEffect(() => {
    if (!roomSlug || !autoStartRelay) return;
    streamV1
      .startChatRelay(roomSlug, {})
      .then(() => setRelayOn(true))
      .catch(() => setRelayOn(false));
    return () => {
      streamV1.stopChatRelay(roomSlug).catch(() => {});
    };
  }, [roomSlug, autoStartRelay]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !roomSlug) return;

    socket.emit('chat-relay-join', { roomId: roomSlug });

    const onMessage = (msg) => {
      if (msg.roomSlug && msg.roomSlug !== roomSlug) return;
      appendMessage(msg);
    };

    socket.on('chat-relay-message', onMessage);
    socket.on('unified-chat-message', onMessage);

    return () => {
      socket.off('chat-relay-message', onMessage);
      socket.off('unified-chat-message', onMessage);
      socket.emit('chat-relay-leave');
    };
  }, [roomSlug, appendMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !roomSlug) return;
    setSending(true);
    setError(null);
    try {
      const socket = getSocket();
      if (socket) {
        socket.emit('chat-relay-send', {
          roomId: roomSlug,
          body: text,
          authorName,
          platform: 'studio',
        });
      } else {
        const { message } = await streamV1.sendChat(roomSlug, text, authorName);
        appendMessage(message);
      }
      setInput('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function toggleRelay() {
    if (!roomSlug) return;
    try {
      if (relayOn) {
        await streamV1.stopChatRelay(roomSlug);
        setRelayOn(false);
      } else {
        await streamV1.startChatRelay(roomSlug, {});
        setRelayOn(true);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="rs-root rs-chat" style={{ height }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="rs-muted">Unified chat · {roomSlug || '—'}</span>
        <button type="button" className="rs-btn" onClick={toggleRelay}>
          {relayOn ? 'Stop relay' : 'Start relay'}
        </button>
      </div>
      {error && <p className="rs-error">{error}</p>}
      <div className="rs-chat-messages">
        {messages.map((m) => {
          const p = PLATFORM_STYLES[m.platform] || { label: '?', color: '#666' };
          return (
            <div key={m.id} className="rs-chat-msg">
              <div className="rs-chat-msg-head">
                <span className="rs-badge" style={{ background: p.color }}>
                  {p.label}
                </span>
                <strong>{m.authorName}</strong>
                <span className="rs-muted">
                  {new Date(m.at || m.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <div>{m.body}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form className="rs-chat-input-row" onSubmit={send}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message all platforms…"
          disabled={sending}
        />
        <button type="submit" className="rs-btn rs-btn-primary" disabled={sending}>
          Send
        </button>
      </form>
    </div>
  );
}

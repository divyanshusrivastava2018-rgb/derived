import { useEffect, useState } from 'react';
import { streamV1 } from '../api/streamApi';

const LABELS = { youtube: 'YT', twitch: 'TW', facebook: 'FB', linkedin: 'LI' };

function getSocket() {
  return window.ResearchiumStudioSignaling?.getSocket?.() || null;
}

export function ViewerCounter({ roomSlug, intervalMs = 5000, compact = false }) {
  const [total, setTotal] = useState(0);
  const [breakdown, setBreakdown] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roomSlug) return;

    let timer;
    let cancelled = false;

    const apply = (data) => {
      if (cancelled || !data) return;
      setTotal(data.totalViewers ?? 0);
      setBreakdown(data.breakdown || {});
    };

    const poll = async () => {
      try {
        const data = await streamV1.getAnalytics(roomSlug);
        apply(data);
        setError(null);
      } catch (e) {
        setError(e.message);
      }
    };

    streamV1.startAnalytics(roomSlug).catch(() => {});

    const socket = getSocket();
    if (socket) {
      socket.emit('analytics-subscribe', { roomId: roomSlug, intervalMs });
      const onUpdate = (data) => {
        if (data.roomSlug === roomSlug) apply(data);
      };
      socket.on('analytics-update', onUpdate);
      timer = setInterval(poll, intervalMs);
      poll();

      return () => {
        cancelled = true;
        clearInterval(timer);
        socket.off('analytics-update', onUpdate);
        socket.emit('analytics-unsubscribe', { roomId: roomSlug });
        streamV1.stopAnalytics(roomSlug).catch(() => {});
      };
    }

    timer = setInterval(poll, intervalMs);
    poll();

    return () => {
      cancelled = true;
      clearInterval(timer);
      streamV1.stopAnalytics(roomSlug).catch(() => {});
    };
  }, [roomSlug, intervalMs]);

  if (compact) {
    return (
      <div className="rs-root rs-viewer-counter" style={{ gap: 12 }}>
        <span className="rs-viewer-total">
          {total}
          <span>viewers</span>
        </span>
        {Object.keys(LABELS).map((p) => (
          <span
            key={p}
            className={`rs-plat-pill${breakdown[p]?.live ? ' live' : ''}`}
          >
            {LABELS[p]}
            <strong>{breakdown[p]?.viewers ?? 0}</strong>
          </span>
        ))}
        {error && <span className="rs-error" style={{ fontSize: 11 }}>—</span>}
      </div>
    );
  }

  return (
    <div className="rs-root rs-card">
      <div className="rs-viewer-counter">
        <div>
          <div className="rs-muted" style={{ fontSize: 11, fontWeight: 700 }}>
            LIVE VIEWERS
          </div>
          <div className="rs-viewer-total">
            {total}
            <span>total</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.keys(LABELS).map((p) => (
            <span
              key={p}
              className={`rs-plat-pill${breakdown[p]?.live ? ' live' : ''}`}
            >
              {LABELS[p]}
              <strong>{breakdown[p]?.viewers ?? 0}</strong>
            </span>
          ))}
        </div>
      </div>
      <p className="rs-muted" style={{ marginTop: 8, fontSize: 11 }}>
        Updates every {intervalMs / 1000}s
        {error ? ` · ${error}` : ''}
      </p>
    </div>
  );
}

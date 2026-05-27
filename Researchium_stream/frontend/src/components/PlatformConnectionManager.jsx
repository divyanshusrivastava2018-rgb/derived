import { useCallback, useEffect, useState } from 'react';
import { PLATFORM_ICONS, streamV1 } from '../api/streamApi';

export function PlatformConnectionManager({ onConnectionsChange, showGoLive, onGoLiveResult }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { connections: list } = await streamV1.getConnections();
      setConnections(list || []);
      onConnectionsChange?.(list);
    } catch (e) {
      setError(e.message);
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [onConnectionsChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function connect(platform) {
    setBusy(platform);
    try {
      const { authUrl } = await streamV1.startOAuth(platform);
      if (authUrl) window.location.href = authUrl;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(platform) {
    setBusy(platform);
    try {
      await streamV1.disconnect(platform);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function goLiveEverywhere() {
    setBusy('go-live');
    try {
      const title =
        document.getElementById('pageTitle')?.textContent?.trim() || 'Researchium Live';
      const session = JSON.parse(sessionStorage.getItem('researchium_studio_session') || '{}');
      const result = await streamV1.goLiveAll({
        title,
        roomSlug: session.roomSlug,
        description: 'Live from Researchium',
      });
      onGoLiveResult?.(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="rs-root rs-muted">Loading platform connections…</div>;
  }

  return (
    <div className="rs-root">
      {error && <p className="rs-error">{error}</p>}
      {showGoLive && (
        <div className="rs-actions" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className="rs-btn rs-btn-primary"
            disabled={busy === 'go-live'}
            onClick={goLiveEverywhere}
          >
            {busy === 'go-live' ? 'Starting…' : '● Go live everywhere'}
          </button>
          <button type="button" className="rs-btn" onClick={load}>
            Refresh
          </button>
        </div>
      )}
      <div className="rs-grid">
        {connections.map((p) => (
          <div
            key={p.platform}
            className={`rs-platform-card${p.connected ? ' connected' : ''}`}
          >
            <h3>
              <span>{PLATFORM_ICONS[p.platform] || '•'}</span>
              {p.label || p.platform}
            </h3>
            <p className="rs-muted">
              {!p.configured
                ? 'OAuth not configured on server'
                : p.connected
                  ? `Connected · ${p.accountName || p.platform}`
                  : 'Not connected'}
            </p>
            <div className="rs-actions">
              {p.configured && !p.connected && (
                <button
                  type="button"
                  className="rs-btn rs-btn-primary"
                  disabled={busy === p.platform}
                  onClick={() => connect(p.platform)}
                >
                  Connect
                </button>
              )}
              {p.connected && (
                <button
                  type="button"
                  className="rs-btn"
                  disabled={busy === p.platform}
                  onClick={() => disconnect(p.platform)}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {!connections.length && (
        <p className="rs-muted">No platforms available. Start studio backend on port 5050.</p>
      )}
    </div>
  );
}

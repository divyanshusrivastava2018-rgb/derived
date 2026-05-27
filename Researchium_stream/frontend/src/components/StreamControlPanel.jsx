import { useCallback, useEffect, useState } from 'react';
import { streamV1 } from '../api/streamApi';

const LAYOUTS = [
  { id: 'solo', label: 'Solo' },
  { id: 'side', label: 'Side' },
  { id: 'pip', label: 'PiP' },
  { id: 'grid', label: 'Grid' },
  { id: 'present', label: 'Present' },
];

export function StreamControlPanel({
  roomSlug,
  title = 'Stream',
  onLiveChange,
  broadcastId: initialBroadcastId,
}) {
  const [scenes, setScenes] = useState([]);
  const [activeSceneId, setActiveSceneId] = useState(null);
  const [layout, setLayout] = useState('side');
  const [isLive, setIsLive] = useState(false);
  const [broadcastId, setBroadcastId] = useState(initialBroadcastId || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const loadRoom = useCallback(async () => {
    if (!roomSlug) return;
    try {
      const data = await streamV1.getRoomHost(roomSlug);
      const studio = data.studio || data;
      setScenes(studio.scenes || []);
      const active = studio.scenes?.find((s) => s.isActive);
      setActiveSceneId(active?.id || null);
      setLayout(studio.session?.layout || 'side');
      setIsLive(Boolean(studio.isLive));
    } catch (e) {
      setError(e.message);
    }
  }, [roomSlug]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  async function toggleLive() {
    if (!roomSlug) return;
    setBusy(true);
    setError(null);
    try {
      const next = !isLive;
      if (next) {
        const result = await streamV1.goLiveAll({
          title,
          roomSlug,
          description: 'Researchium Studio live',
        });
        setBroadcastId(result.broadcastId);
        await streamV1.setRoomLive(roomSlug, true);
        await streamV1.startAnalytics(roomSlug);
        setIsLive(true);
        onLiveChange?.({ live: true, broadcastId: result.broadcastId });
      } else {
        if (broadcastId) await streamV1.endBroadcast(broadcastId);
        await streamV1.setRoomLive(roomSlug, false);
        await streamV1.stopAnalytics(roomSlug);
        setIsLive(false);
        onLiveChange?.({ live: false });
      }
      await loadRoom();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function selectScene(sceneId) {
    if (!roomSlug) return;
    setBusy(true);
    try {
      await streamV1.activateScene(roomSlug, sceneId);
      await streamV1.switchBrowserScene(roomSlug, { sceneId, layout });
      const socket = window.ResearchiumStudioSignaling?.getSocket?.();
      socket?.emit('studio-scene-switch', { roomId: roomSlug, sceneId, layout });
      window.ResearchiumStudioSignaling?.emitState?.({ activeSceneId: sceneId, layout });
      setActiveSceneId(sceneId);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function selectLayout(layoutId) {
    setLayout(layoutId);
    const socket = window.ResearchiumStudioSignaling?.getSocket?.();
    socket?.emit('scene-update', {
      roomId: roomSlug,
      sceneConfig: { layout: layoutId, sources: [] },
    });
    window.ResearchiumStudioSignaling?.emitState?.({ layout: layoutId });
  }

  return (
    <div className="rs-root rs-controls rs-card">
      <div className="rs-live-row">
        <span className={`rs-live-dot${isLive ? ' on' : ''}`} />
        <strong>{isLive ? 'LIVE' : 'Offline'}</strong>
        <button
          type="button"
          className={`rs-btn${isLive ? ' rs-btn-danger' : ' rs-btn-primary'}`}
          disabled={busy || !roomSlug}
          onClick={toggleLive}
        >
          {busy ? '…' : isLive ? 'Stop stream' : 'Start stream'}
        </button>
      </div>
      {error && <p className="rs-error">{error}</p>}

      <div>
        <h4 className="rs-muted" style={{ marginBottom: 8, fontSize: 11, letterSpacing: '0.06em' }}>
          SCENES
        </h4>
        <div className="rs-scene-list">
          {scenes.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`rs-scene-chip${s.id === activeSceneId ? ' active' : ''}`}
              disabled={busy}
              onClick={() => selectScene(s.id)}
            >
              {s.name || s.slug}
            </button>
          ))}
          {!scenes.length && <span className="rs-muted">No scenes loaded</span>}
        </div>
      </div>

      <div>
        <h4 className="rs-muted" style={{ marginBottom: 8, fontSize: 11, letterSpacing: '0.06em' }}>
          LAYOUT
        </h4>
        <div className="rs-scene-list">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`rs-scene-chip${l.id === layout ? ' active' : ''}`}
              onClick={() => selectLayout(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

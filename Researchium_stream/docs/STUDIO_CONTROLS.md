# Stream Studio Controls

Browser studio (`studio.html`) and the studio backend (`:5050`) support scene switching, OBS WebSocket, overlays, and cross-platform viewer analytics.

## Scene switcher

### Browser (WebRTC / compositor)

- Use the **SCENES** sidebar to activate scenes via the core studio API (`/api/studio/room/:slug/scenes`).
- Layout buttons (solo, side-by-side, PiP, grid, presenter) emit `scene-update` on Socket.IO; the backend compositor returns `scene-render` frames.
- REST: `POST /api/studio-controls/:roomSlug/scene/browser` with `{ sceneId, layout, sceneConfig }`.
- Socket: `studio-scene-switch` with `{ roomId, sceneId, layout, sceneConfig }`.

### OBS WebSocket

1. In OBS: **Tools → WebSocket Server Settings** (OBS 28+), enable server on port **4455**.
2. Install optional dependency: `cd backend && npm install obs-websocket-js`
3. In studio **Graphics** drawer: connect with host/port/password (defaults `127.0.0.1:4455`).
4. OBS scenes appear in the scene list when connected; clicking switches `SetCurrentProgramScene`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/studio-controls/obs/connect` | POST | `{ host, port, password }` |
| `/api/studio-controls/obs/disconnect` | POST | Disconnect |
| `/api/studio-controls/obs/status` | GET | Connection status |
| `/api/studio-controls/obs/scenes` | GET | Scene list + current program scene |
| `/api/studio-controls/obs/scene` | POST | `{ sceneName }` |

Env: `OBS_WEBSOCKET_HOST`, `OBS_WEBSOCKET_PORT`, `OBS_WEBSOCKET_PASSWORD`.

## Overlay manager

Types: `alert`, `donation`, `follower`. Shown on preview stages with CSS animations; synced via Socket.IO.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/studio-controls/:roomSlug/overlays` | GET | Config + recent followers |
| `/api/studio-controls/:roomSlug/overlays` | PATCH | Toggle overlay types |
| `/api/studio-controls/:roomSlug/overlays/trigger` | POST | `{ type, title, subtitle, user, amount, platform }` |

Socket: `overlay-trigger`, events `overlay-show` / `overlay-hide`.

## Live analytics

Polls viewer counts when platforms are connected via multistream OAuth:

- **Twitch** — Helix `streams` API
- **YouTube** — live broadcast `concurrentViewers`
- **Facebook** — `live_views` on live video id (from connection metadata)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/studio-controls/:roomSlug/analytics` | GET | One-shot snapshot |
| `/api/studio-controls/:roomSlug/analytics/start` | POST | Start polling (default 10s) |
| `/api/studio-controls/:roomSlug/analytics/stop` | POST | Stop polling |

Socket: `analytics-subscribe` / `analytics-unsubscribe`, event `analytics-update`.

## Frontend

- `js/studio-controls.js` — API + overlay UI + analytics bar
- Wired from `js/studio-page.js` on studio load
- `stream-dashboard.html` — total viewers + per-platform breakdown when live

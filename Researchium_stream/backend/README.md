# Researchium Studio Backend v2

Unified server for `studio.html`: REST, Socket.IO WebRTC signaling, YouTube hooks, adaptive bitrate, scenes, recording.

| Port | Service |
|------|---------|
| 5050 | Studio backend (this package) |
| 4000 | Core API (auth, dashboard, studio DB — proxied) |
| 5051 | Prometheus metrics worker (`npm run metrics`) |

Redis is **optional** (`SKIP_REDIS=1` or unset `REDIS_URL` falls back to in-memory).

**Postgres migrations** (connections, chat, sessions): `infra/sql/005_*.sql`, `006_*.sql`, `007_stream_sessions.sql`. See `docs/BACKEND_API.md` for `/api/v1` REST + WebSocket chat relay.

## Run

```bash
npm run dev:api              # port 4000
npm run dev:studio-backend   # port 5050
python3 -m http.server 5500 --bind 127.0.0.1
```

## Docker

**Full stack** (from repo root): `docker compose up -d --build` — see root `docker-compose.yml`.

**Studio backend only** (this directory):

```bash
docker build -t researchium-studio-backend .
docker run --rm -p 5000:5000 \
  -e JWT_SECRET=change-me \
  -e API_INTERNAL_URL=http://host.docker.internal:4000 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e ALLOWED_ORIGINS=http://localhost:5500 \
  researchium-studio-backend
```

The image listens on **port 5000** (`STUDIO_BACKEND_PORT`). Map `5050:5000` if you prefer host port 5050.

`wrtc` is not installed in the image (native mesh / relay only). Set `WEBRTC_MODE=relay` or mount a custom build if needed.

## Native API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Status + active room count |
| POST | `/api/rooms/create` | Create room (Bearer) |
| POST | `/api/rooms/:roomId/join` | Join token (Bearer) |
| POST | `/api/youtube/stream/start` | Create/bind YouTube live broadcast + RTMP ingest |
| POST | `/api/youtube/stream/end` | End YouTube broadcast |
| GET | `/api/youtube/stream/:broadcastId/status` | Lifecycle status |
| PATCH | `/api/youtube/stream/:broadcastId` | Update title/description |
| GET | `/api/metrics/room/:roomId` | Room metrics + health score |
| GET | `/api/metrics/system` | CPU/memory samples + timeseries (`?limit=50`) |

All other `/api/*` routes proxy to the core API (`/api/dashboard`, `/api/auth`, etc.).

## Socket.IO events

Compatible with `studio.html` (`signal`, `studio-chat`, `studio-state`) plus:

- `webrtc-offer` / `webrtc-answer` / `ice-candidate`
- `scene-update` → `scene-render` (PNG base64 when `sharp` is installed; layouts: `solo`, `side`, `pip`, `grid`, `presenter`)
- `studio-chat` — live stream chat (moderation + broadcast + API persist)
- `chat-message` — alternate moderated chat event
- `screen-share-start`, `recording-start`, `invite-guest`

See [docs/STUDIO_INTEGRATION.md](../docs/STUDIO_INTEGRATION.md) for mapping UI → API (including `live-with-researchium-*` rooms).

## Multi-platform destinations

YouTube, Twitch, Facebook, LinkedIn OAuth + encrypted credentials + simultaneous go-live. See [docs/MULTISTREAM.md](../docs/MULTISTREAM.md).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/multistream/connections` | Connection status |
| POST | `/api/multistream/go-live` | Go live on all connected platforms |

## Unified chat aggregator

Cross-platform chat ingest + send + moderation. See [docs/UNIFIED_CHAT.md](../docs/UNIFIED_CHAT.md).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/unified-chat/:roomSlug/start` | Start Twitch IRC + YouTube/FB polling |
| POST | `/api/unified-chat/:roomSlug/send` | Send message to all platforms |
| POST | `/api/unified-chat/:roomSlug/moderate` | Timeout / ban / delete |

Connect with `auth: { token }` — JWT from `/api/dashboard/meeting` (signaling audience).

### Server-side WebRTC (`wrtc`)

When `wrtc` is installed, `webrtc-offer` creates a server `RTCPeerConnection`, applies adaptive bitrate caps, and returns `webrtc-answer` + `bitrate-strategy`. ICE candidates are exchanged via `ice-candidate` events.

```bash
cd backend && npm install wrtc   # optional native build
```

Set `WEBRTC_MODE=relay` to always use browser mesh relay (no `wrtc`). Set `DISABLE_SERVER_WEBRTC=1` to skip loading `wrtc`.

### Scene compositor (`sharp`)

```bash
cd backend && npm install sharp
```

Without `sharp`, `scene-render` returns layout metadata only (`format: metadata`).

## Env

See `.env.example`. For full API: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`. Without OAuth, routes return mock RTMP metadata using `YOUTUBE_STREAM_KEY` when set.

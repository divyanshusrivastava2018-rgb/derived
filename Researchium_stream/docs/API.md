# Researchium Stream API

Base URL: `http://127.0.0.1:4000` (development)

Protected routes require header: `X-API-Key: <API_KEY from .env>`

## Health

`GET /health` → `{ ok: true, db: true|false }`

## User session (Studio login)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | `{ email, password, name, institution? }` → `{ user, token, expiresIn }` |
| POST | `/api/auth/login` | — | `{ email, password }` → `{ user, token, expiresIn }` (rate limited) |
| GET | `/api/auth/me` | Bearer | Current user |
| PATCH | `/api/auth/me` | Bearer | `{ name?, institution? }` — update profile |
| POST | `/api/auth/refresh` | Bearer | New JWT (extends session) |
| POST | `/api/auth/logout` | — | No-op (client clears token); `204` |
| POST | `/api/auth/change-password` | Bearer | `{ currentPassword, newPassword }` |
| POST | `/api/auth/forgot-password` | — | `{ email, origin? }` — always `{ ok, message }`; dev may include `resetLink` |
| POST | `/api/auth/reset-password` | — | `{ token, password }` → `{ user, token }` (from email link) |
| POST | `/api/studio/start` | Bearer | Create stream, default scenes, signaling token |

Password rules: minimum 8 characters. Reset tokens expire in 1 hour.

Demo user (after seed or `DEV_AUTH_FALLBACK=1`): `demo@gmail.com` / `demo12345`

## Dashboard (meeting)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard` | Bearer | Host profile, streams list, active meeting, stats |
| POST | `/api/dashboard/meeting` | Bearer | Open or resume meeting `{ title?, forceNew? }` → signaling + studio |
| GET | `/api/dashboard/meeting/:roomSlug` | Bearer | Host meeting session |
| POST | `/api/dashboard/meeting/:roomSlug/live` | Bearer | `{ live: true\|false }` |

`POST /api/dashboard/meeting` resumes the latest scheduled/live room unless `forceNew: true`.

## Studio backend (port 5050)

Native routes on `researchium-studio-backend` (`npm run dev:studio-backend`):

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | Backend v2 status + active rooms |
| POST | `/api/rooms/create` | Bearer | Create signaling room |
| POST | `/api/rooms/:roomId/join` | Bearer | Join token for room |
| POST | `/api/youtube/stream/start` | Bearer | Create YouTube live broadcast + RTMP ingest (`title`, `description`, `privacyStatus`) |
| POST | `/api/youtube/stream/end` | Bearer | End broadcast (`broadcastId`) |
| GET | `/api/youtube/stream/:broadcastId/status` | Bearer | Broadcast lifecycle status |
| PATCH | `/api/youtube/stream/:broadcastId` | Bearer | Update `title` / `description` |
| GET | `/api/metrics/room/:roomId` | Bearer | Room metrics + `healthScore` |
| GET | `/api/metrics/system` | Bearer | System CPU/memory samples (`?limit=50`) |

### Researchium live chat integration (studio backend `:5050`)

Requires `X-API-Key: RESEARCHIUM_INTEGRATION_API_KEY`. See `backend/integrations/researchium-live-chat/README.md`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/integrations/researchium/v1/health` | — | Integration health |
| POST | `/api/integrations/researchium/v1/sessions` | API key | Register session `{ roomSlug }` |
| GET | `/api/integrations/researchium/v1/sessions/:roomSlug/messages` | API key | List messages |
| POST | `/api/integrations/researchium/v1/sessions/:roomSlug/messages` | API key | Send message |
| POST | `/api/integrations/researchium/v1/webhooks/events` | HMAC signature | Researchium webhook ingest |

Socket.IO on the same port handles `signal`, `studio-chat`, `webrtc-offer`, `scene-update`, `chat-relay-*`, etc. Other `/api/*` paths proxy to core API `:4000`.

### Stream API v1 (studio backend `:5050`)

Unified REST for connections, chat, and sessions. See **`docs/BACKEND_API.md`**.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/health` | — | v1 health |
| GET | `/api/v1/connections` | Bearer | Platform OAuth connections |
| GET | `/api/v1/rooms/:roomSlug/chat/messages` | Bearer | Chat history (`?platform=`) |
| POST | `/api/v1/rooms/:roomSlug/chat/relay/start` | Bearer | Start cross-platform chat |
| GET | `/api/v1/sessions` | Bearer | Stream sessions + viewer peaks |
| POST | `/api/v1/sessions/:id/end` | Bearer | End session |

Legacy paths remain: `/api/multistream`, `/api/unified-chat`, `/api/studio-controls`.

### React frontend components

See **`docs/FRONTEND_COMPONENTS.md`**. Build with `npm run build:frontend`, then open `stream-components.html` or use embedded mounts on `studio.html` / `stream-dashboard.html`.

## Studio room

Replace `:roomSlug` with the stream room id (e.g. `live-with-researchium-may26-abc123`).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/studio/room/:roomSlug` | — | Public studio state (no private chat, notes, or sources) |
| GET | `/api/studio/room/:roomSlug/host` | Bearer | Full host state + signaling token |
| PATCH | `/api/studio/room/:roomSlug` | Bearer | `{ layout, recordingEnabled, streamQuality, activeSceneId, scheduledAt }` |
| POST | `/api/studio/room/:roomSlug/live` | Bearer | `{ live: true\|false }` — go live / end |
| GET | `/api/studio/room/:roomSlug/scenes` | — | List scenes |
| POST | `/api/studio/room/:roomSlug/scenes` | Bearer | `{ name, layoutType }` |
| PATCH | `/api/studio/room/:roomSlug/scenes/:sceneId` | Bearer | `{ name, layoutType, active }` |
| DELETE | `/api/studio/room/:roomSlug/scenes/:sceneId` | Bearer | Delete scene |
| GET | `/api/studio/room/:roomSlug/chat` | Bearer for `?private=1` | Public messages only without auth; `?since=ISO` |
| POST | `/api/studio/room/:roomSlug/chat` | Bearer | Host message `{ body, isPrivate }` |
| POST | `/api/studio/room/:roomSlug/chat/guest` | — | Joined guest `{ inviteToken, authorName?, body }` (rate limited) |
| GET | `/api/studio/room/:roomSlug/guests` | Bearer | List guests |
| POST | `/api/studio/room/:roomSlug/guests` | Bearer | Create invite → `{ inviteUrl, inviteToken }` |
| POST | `/api/studio/room/:roomSlug/join` | — | `{ inviteToken, displayName }` → guest + signaling |
| GET | `/api/studio/room/:roomSlug/notes` | Bearer | Presenter notes |
| PUT | `/api/studio/room/:roomSlug/notes` | Bearer | Save notes `{ content }` |
| POST | `/api/studio/room/:roomSlug/sources` | Bearer | `{ kind, label, config }` — camera/screen/media/guest |
| POST | `/api/studio/room/:roomSlug/signaling-token` | Bearer | Refresh Socket.IO JWT |

### Pages

| File | Role |
|------|------|
| `studio-lobby.html` | Login + pre-join (mic/cam) |
| `studio.html` | Host/guest studio UI |
| `join.html?room=&token=` | Guest invite landing |

Signaling (port 4001): WebRTC `signal`, plus `studio-chat` and `studio-state` room broadcasts.

## Researchers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/researchers` | — | List (`?limit=&offset=`) |
| GET | `/api/researchers/:id` | — | Profile by UUID |
| POST | `/api/researchers` | API key | Create profile |

## Streams

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/streams` | — | List (`?status=live&limit=20`) |
| GET | `/api/streams/:id` | — | Detail + graph edges |
| POST | `/api/streams` | API key | Create stream |
| PATCH | `/api/streams/:id` | API key | Update `{ status }` |
| POST | `/api/streams/:id/verify-gate` | — | Body `{ password }` |

### Create stream body

```json
{
  "hostId": "<researcher-uuid>",
  "title": "Live lab session",
  "topic": "Quantum Physics",
  "roomSlug": "mit-lab-01",
  "status": "scheduled",
  "isGated": true,
  "gatePassword": "minimum-8-chars"
}
```

## Signaling token

`POST /api/auth/room-token` (API key)

```json
{
  "roomId": "mit-photonics-live",
  "role": "presenter",
  "gatePassword": "peer-review-only"
}
```

`gatePassword` required when stream is gated and `role` is `viewer`.

# Backend API — Platform connections, chat relay, stream sessions

Researchium uses **Node.js + Express** on the studio backend (`:5050`) with **Socket.IO** for real-time relay. PostgreSQL stores encrypted credentials, chat messages (with platform origin), and stream session analytics.

Run migrations in order:

```bash
psql "$DATABASE_URL" -f infra/sql/005_multistream_platforms.sql
psql "$DATABASE_URL" -f infra/sql/006_unified_chat.sql
psql "$DATABASE_URL" -f infra/sql/007_stream_sessions.sql
```

Set `ENCRYPTION_KEY` (32-byte base64) for credential encryption (`backend/lib/crypto-vault.js`).

---

## Unified REST API (`/api/v1`)

Base: `http://127.0.0.1:5050/api/v1`  
Auth: `Authorization: Bearer <JWT>` (same as studio login)

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | API version and status |

### Platform connections

Credentials are stored encrypted in `platform_connections` (see schema below).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/platforms` | Supported platforms + OAuth configured flag |
| GET | `/connections` | All connections for the user |
| GET | `/connections/:platform` | Single platform status |
| POST | `/connections/:platform/oauth` | Start OAuth → `{ authUrl }` |
| GET | `/connections/:platform/oauth/callback` | OAuth redirect (browser) |
| DELETE | `/connections/:platform` | Revoke connection |

Legacy aliases: `/api/multistream/*` (same behavior).

### Chat messages (platform origin)

Stored in `unified_chat_messages` with `platform` ∈ `youtube`, `twitch`, `facebook`, `linkedin`, `studio`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/rooms/:roomSlug/chat/messages` | History (`?since=`, `?platform=`, `?limit=`) |
| POST | `/rooms/:roomSlug/chat/messages` | Send (`body`, `authorName`, optional `platform`) |
| POST | `/rooms/:roomSlug/chat/relay/start` | Start cross-platform ingest |
| POST | `/rooms/:roomSlug/chat/relay/stop` | Stop ingest |
| GET | `/rooms/:roomSlug/chat/relay/status` | Aggregator status |
| POST | `/rooms/:roomSlug/chat/moderate` | Timeout / ban / delete |

Legacy aliases: `/api/unified-chat/:roomSlug/*`

### Stream sessions

Lifecycle and viewer peaks in `stream_sessions` + time-series in `stream_session_viewer_samples`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sessions` | List sessions (`?status=live`, `?limit=`) |
| GET | `/sessions/:sessionId` | Session detail |
| POST | `/sessions` | Start session `{ roomSlug, title, broadcastId? }` |
| POST | `/sessions/:sessionId/end` | End session |
| GET | `/sessions/:sessionId/analytics` | Peaks + viewer samples |
| GET | `/rooms/:roomSlug/session` | Active session for room |

Sessions are created automatically on **Go live everywhere** (`POST /api/multistream/go-live` or `/api/v1` equivalent). Viewer peaks update when analytics polling runs (`/api/studio-controls/.../analytics` or Socket `analytics-subscribe`).

---

## WebSocket chat relay (Socket.IO)

Connect to `http://127.0.0.1:5050` with `auth: { token: <signaling JWT> }`.

| Client event | Description |
|--------------|-------------|
| `chat-relay-join` | Subscribe to `{ roomId }` — joins room `chat:{roomId}` |
| `chat-relay-leave` | Unsubscribe |
| `chat-relay-send` | Send `{ roomId, body, authorName?, platform? }` |
| `chat-relay-start` | Start platform chat ingest (presenter only) |
| `chat-relay-stop` | Stop ingest |

| Server event | Description |
|--------------|-------------|
| `chat-relay-message` | Normalized message `{ id, roomSlug, platform, authorName, body, at }` |
| `chat-relay-status` | Relay / aggregator status |
| `chat-relay-error` | Error payload |
| `unified-chat-message` | Same payload (compat with studio UI) |
| `studio-chat` | Legacy studio chat format |

Existing events still work: `studio-chat`, `unified-chat-start`, `unified-chat-send`, `unified-chat-message`.

---

## Database schemas

### `platform_connections` (`005_multistream_platforms.sql`)

| Column | Type | Notes |
|--------|------|--------|
| `user_id` | TEXT | Owner |
| `platform` | TEXT | youtube, twitch, facebook, linkedin |
| `access_token_enc` | TEXT | AES-encrypted |
| `refresh_token_enc` | TEXT | Encrypted |
| `stream_key_enc` | TEXT | Encrypted RTMP key when applicable |
| `metadata` | JSONB | Account ids, live video ids, etc. |
| `status` | TEXT | connected, expired, revoked, error |

### `unified_chat_messages` (`006_unified_chat.sql`)

| Column | Type | Notes |
|--------|------|--------|
| `room_slug` | TEXT | Studio room |
| `platform` | TEXT | Origin platform |
| `external_id` | TEXT | Idempotent key per platform message |
| `author_name` | TEXT | Display name |
| `body` | TEXT | Message text |
| `metadata` | JSONB | Badges, emotes, outbound flag |

### `stream_sessions` (`007_stream_sessions.sql`)

| Column | Type | Notes |
|--------|------|--------|
| `user_id` | TEXT | Host |
| `room_slug` | TEXT | Studio room |
| `broadcast_id` | UUID | Link to multistream broadcast |
| `started_at` / `ended_at` | TIMESTAMPTZ | Session window |
| `peak_viewers` | INT | Max concurrent viewers (all platforms) |
| `platform_peaks` | JSONB | Per-platform peak counts |
| `last_viewer_total` | INT | Latest sample |

### `stream_session_viewer_samples`

Periodic snapshots: `total_viewers`, `breakdown` JSON (youtube/twitch/facebook), `recorded_at`.

---

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres for all tables |
| `ENCRYPTION_KEY` | Credential encryption |
| `JWT_SECRET` | Bearer tokens |
| `YOUTUBE_*`, `TWITCH_*`, `FACEBOOK_*`, `LINKEDIN_*` | OAuth client credentials |

Without Postgres, dev mode uses in-memory stores (data not persisted across restarts).

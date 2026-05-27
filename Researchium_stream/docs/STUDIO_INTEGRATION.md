# Researchium Studio — backend integration (live + chat)

The toolbar session label (`live-with-researchium-…`) is the **room slug**. It is created when you open a meeting from the dashboard and is used everywhere below.

## Architecture

| Layer | Port | Role |
|-------|------|------|
| **Core API** | 4000 | Auth, dashboard, **chat persistence** (`/api/studio/room/:roomSlug/chat`) |
| **Studio backend** | 5050 (or 5000 in Docker) | Socket.IO, WebRTC, moderation, proxies `/api/*` to core API |
| **Static UI** | 5500 | `studio.html`, `stream-dashboard.html` |

`studio.html` sets both API and signaling to the studio backend gateway (`:5050`).

## Chat (toolbar “Chat” button)

### 1. Persist message (host)

```http
POST /api/studio/room/{roomSlug}/chat
Authorization: Bearer {session_jwt}
Content-Type: application/json

{ "body": "Hello from the lab", "isPrivate": false }
```

### 2. Load history (poll or on open drawer)

```http
GET /api/studio/room/{roomSlug}/chat?since=2026-05-26T12:00:00.000Z
```

Public messages only without auth; host Bearer required for `?private=1`.

### 3. Real-time (Socket.IO)

Connect to studio backend with meeting JWT:

```javascript
const socket = io('http://127.0.0.1:5050', {
  auth: { token: signalingToken }, // from GET /api/studio/room/:slug/host
});

socket.emit('studio-chat', {
  authorName: 'Dr. Smith',
  body: 'Welcome to the stream',
});

socket.on('studio-chat', (msg) => {
  // { authorName, body, fromPeerId, at, sentiment?, roomSlug }
});
```

The studio backend **moderates** text, **broadcasts** to the room, and **persists** to the core API when a Bearer token is present on the socket.

Guest chat: `POST /api/studio/room/:slug/chat/guest` with `{ inviteToken, authorName, body }`, then emit `studio-chat` with the same `inviteToken` in the payload for server-side persist.

### 4. Gateway helpers

```http
GET /studio/room/{roomSlug}/info
GET /studio/room/{roomSlug}/chat    # proxy to core API
POST /studio/room/{roomSlug}/chat   # host only, Bearer required
```

## Live session (mic / camera / end call)

| UI control | Backend |
|------------|---------|
| Meeting code | `roomSlug` on stream row / `GET /api/dashboard/meeting/:roomSlug` |
| Go live / End | `POST /api/studio/room/:roomSlug/live` `{ "live": true\|false }` |
| Participants | Socket `room-peers`, `peer-joined`, `peer-left` + WebRTC `signal` |
| Screen share | `screen-share-start` → adaptive bitrate hints |
| Invite guest | `POST /api/studio/room/:roomSlug/guests` |
| Settings / layout | `studio-state` (presenter only) |

## Open meeting flow

1. `POST /api/dashboard/meeting` → `{ roomSlug, signalingToken, signalingUrl, stream, … }`
2. Open `studio.html?room={roomSlug}`
3. `GET /api/studio/room/:roomSlug/host` → full state + refresh token
4. Socket connect + optional `GET …/chat` polling every 3s (built into `js/studio-page.js`)

## Run locally

```bash
npm run dev:api              # :4000
cd backend && SKIP_REDIS=1 node server.js   # :5050
python3 -m http.server 5500 --bind 127.0.0.1
```

Demo: `demo@gmail.com` / `demo12345` with `DEV_AUTH_FALLBACK=1` in `.env`.

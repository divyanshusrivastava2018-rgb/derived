# Multi-platform streaming

Connect **YouTube**, **Twitch**, **Facebook Live**, and **LinkedIn Live** from the Stream Dashboard (**Destinations** panel).

## Features

- OAuth 2.0 per platform
- Encrypted storage of access tokens, refresh tokens, and stream keys (`AES-256-GCM`, `ENCRYPTION_KEY`)
- Automatic OAuth refresh before API calls (`OAUTH_REFRESH_BUFFER_MS`, see `backend/services/multistream/token-refresher.js`)
- Optional **local RTMP ingest** → FFmpeg distribute (`POST /api/rtmp/distribute`, see `docs/DEPLOYMENT.md`)
- One-click **Go live everywhere** (`POST /api/multistream/go-live`)
- Parallel platform API calls with retry + per-platform error reporting

## Setup

1. Run migration:

```bash
psql "$DATABASE_URL" -f infra/sql/005_multistream_platforms.sql
```

2. Generate encryption key:

```bash
openssl rand -hex 32   # → ENCRYPTION_KEY
```

3. Configure OAuth apps (see `backend/.env.example`) and set redirect URIs to:

- `http://127.0.0.1:5050/api/multistream/oauth/{platform}/callback`

4. Start services:

```bash
npm run dev:api
cd backend && SKIP_REDIS=1 node server.js
python3 -m http.server 5500 --bind 127.0.0.1
```

5. Open http://127.0.0.1:5500/stream-dashboard.html → **Destinations**

## API (studio backend, Bearer JWT)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/multistream/connections` | Platform connection status |
| GET | `/api/multistream/oauth/:platform/start` | OAuth URL |
| GET | `/api/multistream/oauth/:platform/callback` | OAuth redirect (browser) |
| DELETE | `/api/multistream/connections/:platform` | Disconnect |
| POST | `/api/multistream/go-live` | Go live on all connected platforms |
| POST | `/api/multistream/end` | End broadcast `{ broadcastId }` |

### Go live body

```json
{
  "title": "live-with-researchium-may26",
  "description": "Research stream",
  "roomSlug": "live-with-researchium-may26-abc",
  "platforms": ["youtube", "twitch"],
  "privacyStatus": "public"
}
```

Response includes per-platform RTMP URLs and a unified ingest summary for OBS.

## LinkedIn note

LinkedIn Live RTMP requires LinkedIn Live Events / Marketing API partner approval. OAuth connects the account; manual RTMP setup may be required until API access is granted.

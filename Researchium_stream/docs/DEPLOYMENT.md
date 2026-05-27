# Deployment — Docker, RTMP, OAuth, rate limits

## Quick start

```bash
cp .env.example .env
# Edit .env: POSTGRES_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, platform OAuth IDs

docker compose up -d --build
```

| Service | Port | Role |
|---------|------|------|
| `postgres` | 5432 | Platform connections, chat, sessions |
| `redis` | 6379 | Rate limits, sessions, metrics |
| `rtmp` | 1935, 8088 | **RTMP ingest** + HLS preview |
| `api` | (internal 4000) | Core auth & studio API |
| `backend` | 5000 | Multistream, chat relay, RTMP distribute |
| `nginx` | 80/443 | Reverse proxy + static files |

## RTMP workflow

1. **Go live** (`POST /api/multistream/go-live`) creates platform broadcasts and returns `ingest.localRtmp`:
   - `rtmpUrl`: `rtmp://localhost:1935/live`
   - `streamKey`: unique per room
   - `publishUrl`: full URL for OBS

2. **Publish** from OBS (or FFmpeg) to `publishUrl`.

3. **Distribute** to connected platforms:
   ```http
   POST /api/rtmp/distribute
   Authorization: Bearer …
   { "streamKey": "…", "broadcastId": "…" }
   ```
   Backend runs **FFmpeg** reading `rtmp://rtmp:1935/live/{streamKey}` and pushes FLV to each platform RTMP URL.

4. **Stop**: `POST /api/rtmp/stop` with `{ "streamKey" }`.

Env:

| Variable | Description |
|----------|-------------|
| `RTMP_INTERNAL_URL` | URL backend/FFmpeg reads (Docker: `rtmp://rtmp:1935/live`) |
| `RTMP_PUBLIC_HOST` | Hostname shown to encoders (OBS) |
| `RTMP_PUBLIC_PORT` | Default `1935` |
| `RTMP_INGEST_ENABLED` | Set `0` to skip local ingest hints on go-live |

## OAuth refresh tokens

All platforms store **encrypted** `access_token_enc` and `refresh_token_enc` in Postgres.

Before each API call, `getFreshConnectionSecrets()` refreshes tokens when expiry is within `OAUTH_REFRESH_BUFFER_MS` (default 5 minutes):

| Platform | Refresh method |
|----------|----------------|
| YouTube | Google `refreshAccessToken` |
| Twitch | `grant_type=refresh_token` |
| LinkedIn | `grant_type=refresh_token` |
| Facebook | `fb_exchange_token` (long-lived page token) |

Failures are logged; expired tokens without refresh return `platform_refresh_token_missing`.

## Rate limiting & API errors

| Limiter | Env | Default | Routes |
|---------|-----|---------|--------|
| Global API | `API_RATE_LIMIT_MAX` | 100/15min | `/api/*` |
| OAuth start | `OAUTH_RATE_LIMIT_MAX` | 40/15min | `/api/multistream/oauth/*/start` |
| Chat | `CHAT_RATE_LIMIT_MAX` | 120/min | `/api/unified-chat/*` |
| RTMP | `RTMP_RATE_LIMIT_MAX` | 30/min | `/api/rtmp/*` |
| Go live | `GOLIVE_RATE_LIMIT_MAX` | 20/hour | go-live, distribute |

Platform HTTP calls use retries (`PLATFORM_API_RETRY_MAX`) on 429/5xx via `PlatformApiError`.

JSON error shape:

```json
{ "error": "oauth_rate_limited", "retryable": true, "retryAfter": 900 }
```

## Environment variables

See root **`.env.example`** for the full list. Required for production:

- `POSTGRES_PASSWORD`, `DATABASE_URL`
- `JWT_SECRET`, `ENCRYPTION_KEY`
- Platform OAuth: `YOUTUBE_*`, `TWITCH_*`, `FACEBOOK_*`, `LINKEDIN_*`

## Migrations

Included in Docker Postgres init:

- `005_multistream_platforms.sql`
- `006_unified_chat.sql`
- `007_stream_sessions.sql`

For existing DBs, run manually:

```bash
psql "$DATABASE_URL" -f infra/sql/005_multistream_platforms.sql
psql "$DATABASE_URL" -f infra/sql/006_unified_chat.sql
psql "$DATABASE_URL" -f infra/sql/007_stream_sessions.sql
```

## Local dev (without Docker)

```bash
# Terminal 1: RTMP (Docker only for nginx-rtmp)
docker run --rm -p 1935:1935 -p 8088:8088 \
  -v $(pwd)/infra/nginx/rtmp.conf:/etc/nginx/nginx.conf:ro \
  alfg/nginx-rtmp

npm run dev:api
cd backend && SKIP_REDIS=1 node server.js
python3 -m http.server 5500 --bind 127.0.0.1
```

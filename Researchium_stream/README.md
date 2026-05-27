# Researchium Stream Studio

Live research broadcasting — landing page, backend API, signaling, and SFU.

## Backend API (`services/api`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health + DB ping |
| GET | `/api/streams` | List streams |
| GET | `/api/streams/:id` | Stream + research graph |
| POST | `/api/streams` | Create stream (API key) |
| PATCH | `/api/streams/:id` | Update status (API key) |
| POST | `/api/streams/:id/verify-gate` | Verify gated password |
| GET | `/api/researchers` | List researchers |
| POST | `/api/researchers` | Create researcher (API key) |
| POST | `/api/auth/room-token` | JWT for Socket.IO (API key) |

Full reference: [docs/API.md](./docs/API.md)

## Setup

```bash
cp config/env.example .env
bash scripts/generate-env-secrets.sh   # paste into .env

docker compose --env-file .env up -d --build   # Postgres, Redis, API, studio backend, nginx

Production TLS: add `ssl/cert.pem` + `ssl/key.pem`, then `NGINX_CONF=./nginx.conf docker compose up -d nginx` (see `ssl/README.md`).
npm install
npm run db:seed                        # demo data
npm run dev:api
npm run dev:signaling
npm run dev:studio-backend
npm run dev:sfu
```

`studio.html` uses the **studio backend** on port **5050** (WebRTC signaling + studio APIs; proxies other `/api` routes to :4000). Run `npm run dev:api` and `npm run dev:studio-backend`.

Landing page: `python3 -m http.server 5500 --bind 127.0.0.1` → http://127.0.0.1:5500/researchium-stream.html

### Studio (browser broadcast)

**Studio features:** pre-join lobby, participant grid, mesh WebRTC via Socket.IO, chat, screen share, leave → `meeting-end.html`.

1. `studio-lobby.html` — sign in (`demo@gmail.com` / `demo12345` after seed, or with `DEV_AUTH_FALLBACK=1` without DB)
2. **Allow mic/cam** → **Ready to join?** modal
3. `studio.html` — scenes, layouts, chat, guests, go live (API-backed)
4. `join.html?room=…&token=…` — guest invite link from host

Works **without Postgres** in development when `DEV_AUTH_FALLBACK=1` is set in `.env` (in-memory studio + demo login). With Postgres, run `infra/sql/init.sql` (includes studio tables) and `npm run db:seed`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Session JWT |
| POST | `/api/studio/start` | New room + scenes + signaling |
| GET | `/api/studio/room/:roomSlug/host` | Full studio state (host) |
| POST | `/api/studio/room/:roomSlug/live` | Go live / end |

See [docs/API.md](./docs/API.md) for all studio endpoints.

## Layout

```
services/api/          Express backend (routes, services, DB)
services/signaling/    Socket.IO + JWT
services/sfu/          mediasoup
services/shared/       Auth, CORS, validation
infra/sql/             PostgreSQL schema
docs/API.md
```

See [SECURITY.md](./SECURITY.md) for production checklist.

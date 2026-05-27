# Security

## Reporting

Report vulnerabilities privately to your security contact (do not open public issues for exploits).

## Controls implemented

- **JWT room tokens** — Signaling requires `handshake.auth.token` from `POST /api/auth/room-token` (protected by `X-API-Key`).
- **Targeted signaling** — WebRTC signals relay only to the intended `targetPeerId`; `fromPeerId` is server-assigned.
- **Studio public state** — `GET /api/studio/room/:roomSlug` omits private chat, presenter notes, and sources.
- **Guest chat** — `POST .../chat/guest` requires a valid joined `inviteToken`; body sanitized server-side.
- **Signaling studio events** — Chat relay strips HTML; `studio-state` only from presenter/moderator roles.
- **Auth rate limits** — Login/register throttled (`AUTH_RATE_LIMIT_MAX`).
- **CORS allowlist** — Set `ALLOWED_ORIGINS` (required in production for API/signaling).
- **Production API** — Non-health requests without `Origin` rejected when `NODE_ENV=production`.
- **Service bind** — Default `HOST=127.0.0.1`; expose via reverse proxy with TLS in production.
- **SFU internal auth** — `/rtp-capabilities` requires `X-Internal-Key`.
- **Rate limits** — HTTP (`express-rate-limit`) and signaling event limits.
- **SQL** — Parameterized queries; UUID validation on stream/scene IDs.
- **Dev auth fallback** — Opt-in only: `DEV_AUTH_FALLBACK=1` (disabled in production).
- **Static studio CSP** — Content-Security-Policy on lobby, studio, join, and meeting-end pages.
- **XSS** — Chat UI uses `textContent` / safe DOM helpers (`js/studio-safe.js`).
- **Docker** — Postgres bound to `127.0.0.1`; password required via `.env`.
- **HLS edge** — Rate limiting + security headers; restrict `Access-Control-Allow-Origin` in `infra/nginx/hls.conf`.

## Production checklist

1. Copy `config/env.example` → `.env` and run `bash scripts/generate-env-secrets.sh` for secrets.
2. Set `NODE_ENV=production`, strong `JWT_SECRET`, `API_KEY`, `INTERNAL_SERVICE_KEY`.
3. Set `ALLOWED_ORIGINS` to your real app origin(s) only.
4. Terminate TLS (HTTPS / WSS) at NGINX or cloud load balancer.
5. Do not publish Postgres or SFU ports to the public internet.
6. Enable HLS signed URLs before public VOD distribution.

## Obtain a signaling token (dev)

```bash
curl -s -X POST http://127.0.0.1:4000/api/auth/room-token \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"roomId":"demo-lab","role":"presenter"}'
```

Use returned `token` as `io(url, { auth: { token } })`.

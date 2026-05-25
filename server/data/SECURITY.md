# GATE mock exam — security notes

## Answer keys (secret)

- **Never** commit `server/data/gate-mcq-answers.json` (gitignored, mode `0600` on server).
- Prefer **`GATE_ANSWERS_JSON`** in production (JSON string in env / secret manager).
- `gate-mcq-answers.seed.json` is for local/deploy bootstrap only.

## Public offline bundle (practice only)

- `public/data/gate-score-bundle.json` stores **obfuscated** keys (`enc` field) only — no `answers`, no `solutions`.
- Regenerate: `npm run sync:mock-offline` after key changes.
- `public/data/gate-mcq-solutions.json` is **not** published (gitignored).
- Offline scoring is **not** secure against a motivated user — use the live API for scored mocks.

Regenerate after key changes:

```bash
npm run sync:mock-offline
```

Disable offline scoring on static deploy:

```bash
GATE_OFFLINE_SCORING=0 npm run build:runtime-config
```

## API behaviour

| Endpoint | Requirement |
|----------|-------------|
| `POST .../start` | Questions **without** answer indices |
| `POST .../submit` | **Valid session required** in production |
| `POST .../submit` | Returns `reviewToken` for post-submit review / AI |
| `POST .../solve-question` | Requires `reviewToken`; max solves per token (default 30, `GATE_MAX_SOLVES_PER_REVIEW`) |

**Never** set in production: `GATE_ALLOW_STATELESS_SUBMIT=1`, `ALLOW_DEMO_MEMBER=1`.

Development / smoke: `GATE_ALLOW_STATELESS_SUBMIT=1` only when needed.

## Sessions

- In-memory by default; optional `GATE_SESSION_STORE=file` (gitignored `gate-sessions.json`) for single-server restarts.
- Use Redis when running multiple Node instances.

## Progress API

- Clients must use `GET /api/platform/progress/session` → signed `learnerToken`.
- Raw `learnerId` is rejected in production (no IDOR).

## Deployment

```bash
NODE_ENV=production
CORS_ORIGIN=https://www.derived.co.in
GATE_SESSION_STORE=file
GATE_OFFLINE_SCORING=0
TRUST_PROXY=1
RESEARCHIUM_ADMIN_USERNAME=...
RESEARCHIUM_ADMIN_PASSWORD=...
RESEARCHIUM_MEMBER_SECRET=...
HCAPTCHA_SECRET_KEY=...
# GATE_OFFLINE_BUNDLE_PEPPER=...  # optional; must match client decoder if offline scoring enabled
# ANTHROPIC_API_KEY=... / OPENAI_API_KEY=...
```

Ensure nginx proxies `/api` to Node — see `docs/nginx-gate-api.example.conf`.

## AI solver

Server-only API keys. Rate-limited per IP and per `reviewToken`.

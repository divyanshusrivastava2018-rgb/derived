# GATE mock exam — security notes

## Answer keys (secret)

- **Never** commit `gate-mcq-answers.json` (gitignored, mode `0600` on server).
- Prefer **`GATE_ANSWERS_JSON`** in production (JSON string in env / secret manager) instead of a file in the repo.
- `gate-mcq-answers.seed.json` is for local/deploy bootstrap only. Do not publish real keys in public repositories.

## API behaviour

| Endpoint | Requirement |
|----------|-------------|
| `POST .../start` | Returns questions **without** answer indices |
| `POST .../submit` | **Valid session required** in production (`NODE_ENV=production`) |
| `POST .../submit` | Returns `reviewToken` for post-submit review / AI solutions |
| `POST .../solve-question` | Requires `reviewToken` from a completed submit |

Development / smoke tests: set `GATE_ALLOW_STATELESS_SUBMIT=1` only when needed.

## Deployment

```bash
NODE_ENV=production
CORS_ORIGIN=https://www.derived.co.in
# Optional: inject keys without a file
# GATE_ANSWERS_JSON='{"answers":{"ga1":1,...}}'
```

Ensure nginx (or your proxy) does **not** serve `server/data/` — only `public/` and `/api` to Node.

If you deploy **static files to GitHub Pages**, the exam UI must call the live API on `https://www.derived.co.in`. The client auto-detects `*.github.io` and sets the API base. Add your Pages origin to `CORS_ORIGIN` on the server:

```bash
CORS_ORIGIN=https://www.derived.co.in,https://YOUR_USER.github.io
```

## AI solver

`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` are server-only. Solutions are rate-limited per IP and per `reviewToken` (max 60 questions per attempt).

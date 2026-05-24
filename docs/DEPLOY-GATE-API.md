# GATE exam scoring API — deployment

The GATE mock **must** reach `POST /api/mcq/gate/paper/:year/submit`. Static hosting alone (GitHub Pages) cannot score exams.

## Option A — Single Node server (recommended)

1. Deploy the full repo with `node server/index.js` (see `render.yaml` or your VPS).
2. Point **derived.co.in** to that host (not GitHub Pages-only).
3. On VPS, proxy `/api` to Node — see `docs/nginx-gate-api.example.conf`.
4. Run once: `npm run prepare:gate` (creates answer keys from seed).

```bash
NODE_ENV=production
RESEARCHIUM_ADMIN_USERNAME=...
RESEARCHIUM_ADMIN_PASSWORD=...
RESEARCHIUM_MEMBER_SECRET=...
HCAPTCHA_SECRET_KEY=...
CORS_ORIGIN=https://www.derived.co.in
```

## Option B — GitHub Pages + API on Render

1. Create a **Web Service** on [Render](https://render.com) from this repo (`render.yaml`).
2. Copy the service URL, e.g. `https://researchium-xxxx.onrender.com`.
3. In GitHub → **Settings → Secrets → Actions**, add:
   - `GATE_API_BASE` = `https://researchium-xxxx.onrender.com`
4. Re-run **Deploy static content to Pages** (or push to `main`).
5. On Render, set `CORS_ORIGIN` to your Pages URL and `https://www.derived.co.in`.

The static build writes `public/data/runtime-config.json` with `gateApiBase` from that secret.

## Verify

```bash
curl -s https://YOUR_HOST/api/mcq/gate/healthz
# {"ok":true,"service":"gate-mcq",...}
```

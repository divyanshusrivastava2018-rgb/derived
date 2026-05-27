import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as mediasoup from 'mediasoup';
import { getHost, isProduction } from '../../shared/env.js';
import { verifyInternalKey } from '../../shared/auth.js';

const PORT = Number(process.env.SFU_PORT) || 4002;
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '16kb' }));
app.use(
  rateLimit({
    windowMs: 60_000,
    max: Number(process.env.SFU_RATE_LIMIT_MAX) || 60,
  })
);

function requireInternal(req, res, next) {
  if (!verifyInternalKey(req.get('X-Internal-Key'))) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

let worker;
let router;

async function boot() {
  worker = await mediasoup.createWorker({
    rtcMinPort: Number(process.env.RTC_MIN_PORT) || 40000,
    rtcMaxPort: Number(process.env.RTC_MAX_PORT) || 40100,
  });
  router = await worker.createRouter({
    mediaCodecs: [
      { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
      { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 },
    ],
  });
  console.log('[sfu] mediasoup worker ready');
}

app.get('/health', requireInternal, (_req, res) => {
  res.json({ ok: true, router: !!router });
});

app.get('/rtp-capabilities', requireInternal, (_req, res) => {
  if (!router) return res.status(503).json({ error: 'not_ready' });
  res.json(router.rtpCapabilities);
});

boot().catch((err) => {
  console.error('[sfu] boot failed', err);
  process.exit(1);
});

if (isProduction() && !process.env.INTERNAL_SERVICE_KEY) {
  console.error('[sfu] INTERNAL_SERVICE_KEY is required in production');
  process.exit(1);
}

const host = getHost();
app.listen(PORT, host, () => {
  console.log(`[sfu] control plane on http://${host}:${PORT} (internal auth required)`);
});

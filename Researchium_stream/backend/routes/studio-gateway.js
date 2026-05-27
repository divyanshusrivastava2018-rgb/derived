import { Router } from 'express';
import axios from 'axios';
import { config } from '../config.js';
import { log } from '../lib/logger.js';

export const studioGatewayRouter = Router();

/** Studio-specific endpoints (extend API without duplicating core auth). */
studioGatewayRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'researchium-studio-backend',
    api: config.apiUrl,
    signaling: config.signalingUrl,
  });
});

studioGatewayRouter.get('/ready', async (_req, res) => {
  const checks = { api: false, signaling: false };
  try {
    const api = await axios.get(`${config.apiUrl}/health`, { timeout: 2000 });
    checks.api = api.status === 200 || api.status === 503;
  } catch (e) {
    log.warn(`API unreachable: ${e.message}`);
  }
  try {
    await axios.get(config.signalingUrl, { timeout: 2000, validateStatus: () => true });
    checks.signaling = true;
  } catch (e) {
    log.warn(`Signaling unreachable: ${e.message}`);
  }
  const ok = checks.api;
  res.status(ok ? 200 : 503).json({ ok, checks });
});

/** YouTube / RTMP broadcast metadata (configure YOUTUBE_* in .env for production). */
studioGatewayRouter.post('/youtube/go-live', async (req, res) => {
  const { roomSlug, title, privacyStatus = 'unlisted' } = req.body || {};
  if (!roomSlug) return res.status(400).json({ error: 'roomSlug_required' });

  const streamKey = process.env.YOUTUBE_STREAM_KEY;
  if (!streamKey) {
    return res.status(501).json({
      error: 'youtube_not_configured',
      hint: 'Set YOUTUBE_STREAM_KEY in .env and run the encoding worker.',
      rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
      roomSlug,
      title: title || 'Researchium Live',
      privacyStatus,
    });
  }

  res.json({
    ok: true,
    roomSlug,
    rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
    streamKey: `${streamKey.slice(0, 4)}…`,
    title,
    privacyStatus,
  });
});

studioGatewayRouter.get('/metrics/summary', async (req, res) => {
  const auth = req.get('Authorization');
  if (!auth) return res.status(401).json({ error: 'unauthorized' });
  try {
    const { data } = await axios.get(`${config.apiUrl}/api/dashboard`, {
      headers: { Authorization: auth },
      timeout: 5000,
    });
    res.json({
      activeMeeting: data.activeMeeting,
      stats: data.stats,
      isLive: Boolean(data.activeMeeting?.isLive),
    });
  } catch (e) {
    const status = e.response?.status || 502;
    res.status(status).json({ error: e.response?.data?.error || 'upstream_error' });
  }
});

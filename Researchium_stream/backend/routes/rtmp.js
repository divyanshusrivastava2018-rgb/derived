import { Router } from 'express';
import { asyncHandler } from '../middleware/api-errors.js';
import {
  createIngestSession,
  getIngestSession,
  endIngestSession,
  getRtmpPublicBase,
} from '../services/rtmp/ingest.js';
import {
  startDistribution,
  stopDistribution,
  getDistributionStatus,
} from '../services/rtmp/distributor.js';
import { multistreamRepo } from '../services/multistream/repository.js';

export function createRtmpRouter({ multistreamManager, authService }) {
  const router = Router();
  const auth = authService.authenticate.bind(authService);

  router.get('/config', (_req, res) => {
    const { baseUrl, host, port, app } = getRtmpPublicBase();
    res.json({
      rtmpUrl: baseUrl,
      host,
      port,
      app,
      hlsPreview: process.env.RTMP_HLS_PUBLIC_URL || `http://${host}:8088/hls`,
    });
  });

  router.post(
    '/ingest',
    auth,
    asyncHandler(async (req, res) => {
      const { roomSlug, title } = req.body || {};
      if (!roomSlug) {
        return res.status(400).json({ error: 'roomSlug_required' });
      }
      const session = createIngestSession({
        userId: req.userId,
        roomSlug,
        title,
      });
      res.status(201).json({ ingest: session });
    })
  );

  router.post(
    '/distribute',
    auth,
    asyncHandler(async (req, res) => {
      const { streamKey, broadcastId, platforms } = req.body || {};
      if (!streamKey) {
        return res.status(400).json({ error: 'streamKey_required' });
      }

      const ingest = getIngestSession(streamKey);
      if (!ingest || ingest.userId !== req.userId) {
        return res.status(404).json({ error: 'ingest_not_found' });
      }

      let targets = req.body?.targets;
      if (!targets?.length && broadcastId) {
        const broadcast = await multistreamRepo.getBroadcast(broadcastId);
        if (!broadcast || broadcast.user_id !== req.userId) {
          return res.status(404).json({ error: 'broadcast_not_found' });
        }
        targets = (broadcast.targets || [])
          .filter((t) => t.status === 'live' && t.rtmp_url)
          .map((t) => ({
            platform: t.platform,
            rtmpUrl: t.rtmp_url,
            streamKey: null,
          }));
      }

      if (!targets?.length) {
        const live = await multistreamManager.goLiveAll(req.userId, {
          title: ingest.title,
          roomSlug: ingest.roomSlug,
          platforms,
        });
        targets = live.targets
          .filter((t) => t.ok && t.rtmpUrl)
          .map((t) => ({
            platform: t.platform,
            rtmpUrl: t.rtmpUrl,
            streamKey: t.streamKey,
          }));
      }

      const state = startDistribution(streamKey, targets, { userId: req.userId });
      res.json({ ok: true, distribution: state, targetCount: targets.length });
    })
  );

  router.post(
    '/stop',
    auth,
    asyncHandler(async (req, res) => {
      const { streamKey } = req.body || {};
      if (!streamKey) return res.status(400).json({ error: 'streamKey_required' });
      stopDistribution(streamKey);
      endIngestSession(streamKey);
      res.json({ ok: true });
    })
  );

  router.get(
    '/status/:streamKey',
    auth,
    asyncHandler(async (req, res) => {
      const ingest = getIngestSession(req.params.streamKey);
      if (!ingest || ingest.userId !== req.userId) {
        return res.status(404).json({ error: 'not_found' });
      }
      res.json({
        ingest,
        distribution: getDistributionStatus(req.params.streamKey),
      });
    })
  );

  return router;
}

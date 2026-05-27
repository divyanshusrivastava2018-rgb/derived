import { Router } from 'express';
import { oauthLimiter, goLiveLimiter } from '../middleware/rate-limits.js';
import { asyncHandler } from '../middleware/api-errors.js';

export function createMultistreamRouter(manager, authService) {
  const router = Router();
  const auth = authService.authenticate.bind(authService);
  const dashboardReturn =
    process.env.MULTISTREAM_OAUTH_SUCCESS_URL || 'http://127.0.0.1:5500/stream-dashboard.html?panel=destinations';

  router.get('/platforms', auth, (req, res) => {
    res.json({ platforms: manager.listPlatforms(req.userId) });
  });

  router.get('/connections', auth, async (req, res) => {
    const connections = await manager.listConnections(req.userId);
    res.json({ connections });
  });

  router.get('/oauth/:platform/start', oauthLimiter, auth, (req, res) => {
    try {
      const { url } = manager.startOAuth(req.params.platform, req.userId);
      res.json({ authUrl: url });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get('/oauth/:platform/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query;
      if (error) {
        return res.redirect(`${dashboardReturn}&oauth_error=${encodeURIComponent(error)}`);
      }
      await manager.completeOAuth(req.params.platform, code, state);
      res.redirect(`${dashboardReturn}&oauth=connected&platform=${req.params.platform}`);
    } catch (e) {
      res.redirect(`${dashboardReturn}&oauth_error=${encodeURIComponent(e.message)}`);
    }
  });

  router.delete('/connections/:platform', auth, async (req, res) => {
    await manager.disconnect(req.userId, req.params.platform);
    res.json({ ok: true });
  });

  router.post(
    '/go-live',
    goLiveLimiter,
    auth,
    asyncHandler(async (req, res) => {
      const result = await manager.goLiveAll(req.userId, {
        title: req.body?.title,
        description: req.body?.description,
        roomSlug: req.body?.roomSlug,
        platforms: req.body?.platforms,
        privacyStatus: req.body?.privacyStatus || 'public',
      });
      res.status(201).json(result);
    })
  );

  router.post(
    '/rtmp/distribute',
    goLiveLimiter,
    auth,
    asyncHandler(async (req, res) => {
      const result = await manager.startRtmpDistribution(req.userId, req.body || {});
      res.status(201).json(result);
    })
  );

  router.post('/end', auth, async (req, res) => {
    try {
      const result = await manager.endBroadcast(req.userId, req.body?.broadcastId);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get('/broadcasts/:broadcastId', auth, async (req, res) => {
    const { multistreamRepo } = await import('../services/multistream/repository.js');
    const broadcast = await multistreamRepo.getBroadcast(req.params.broadcastId);
    if (!broadcast || broadcast.user_id !== req.userId) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ broadcast });
  });

  return router;
}

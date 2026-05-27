import { Router } from 'express';
import { analyticsCollector, overlayManager } from '../services/studio-controls/index.js';

export function createStudioControlsRouter({ sceneController, authService }) {
  const router = Router();
  const auth = authService.authenticate.bind(authService);

  router.get('/:roomSlug/analytics', auth, async (req, res) => {
    const data = await analyticsCollector.collect(
      req.params.roomSlug,
      req.userId,
      req.app.get('io')
    );
    res.json(data);
  });

  router.post('/:roomSlug/analytics/start', auth, (req, res) => {
    analyticsCollector.start(
      req.params.roomSlug,
      req.userId,
      req.app.get('io'),
      Number(req.body?.intervalMs) || 10000
    );
    res.json({ ok: true });
  });

  router.post('/:roomSlug/analytics/stop', auth, (req, res) => {
    analyticsCollector.stop(req.params.roomSlug);
    res.json({ ok: true });
  });

  router.get('/:roomSlug/overlays', auth, (req, res) => {
    res.json(overlayManager.getFullState(req.params.roomSlug));
  });

  router.patch('/:roomSlug/overlays', auth, (req, res) => {
    const config = overlayManager.updateConfig(req.params.roomSlug, req.body || {});
    res.json({ config });
  });

  router.post('/:roomSlug/overlays/trigger', auth, (req, res) => {
    const { type, ...payload } = req.body || {};
    if (!type) return res.status(400).json({ error: 'type_required' });
    const event = overlayManager.trigger(
      req.params.roomSlug,
      type,
      payload,
      req.app.get('io')
    );
    res.status(201).json({ event });
  });

  router.post('/obs/connect', auth, async (req, res) => {
    try {
      const result = await sceneController.connectObs(req.userId, req.body || {});
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post('/obs/disconnect', auth, async (req, res) => {
    await sceneController.disconnectObs(req.userId);
    res.json({ ok: true });
  });

  router.get('/obs/status', auth, async (req, res) => {
    res.json(await sceneController.obsStatus(req.userId));
  });

  router.get('/obs/scenes', auth, async (req, res) => {
    try {
      res.json(await sceneController.listObsScenes(req.userId));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post('/obs/scene', auth, async (req, res) => {
    try {
      const result = await sceneController.switchObsScene(req.userId, req.body?.sceneName);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post('/:roomSlug/scene/browser', auth, async (req, res) => {
    const result = await sceneController.switchBrowserScene(
      req.app.get('io'),
      req.params.roomSlug,
      req.body || {}
    );
    res.json(result);
  });

  return router;
}

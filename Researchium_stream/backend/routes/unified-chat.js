import { Router } from 'express';
import { chatLimiter } from '../middleware/rate-limits.js';
import { asyncHandler } from '../middleware/api-errors.js';

export function createUnifiedChatRouter(manager, authService) {
  const router = Router();
  const auth = authService.authenticate.bind(authService);
  router.use(chatLimiter);

  router.get('/:roomSlug/status', auth, (req, res) => {
    res.json(manager.status(req.params.roomSlug));
  });

  router.get('/:roomSlug/messages', auth, async (req, res) => {
    const messages = await manager.history(req.params.roomSlug, {
      since: req.query.since,
      limit: Number(req.query.limit) || 100,
    });
    res.json({ messages });
  });

  router.post('/:roomSlug/start', auth, async (req, res) => {
    try {
      const result = await manager.start(
        req.params.roomSlug,
        req.userId,
        req.app.get('io'),
        req.body || {}
      );
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post('/:roomSlug/stop', auth, async (req, res) => {
    await manager.stop(req.params.roomSlug);
    res.json({ ok: true });
  });

  router.post('/:roomSlug/send', auth, async (req, res) => {
    try {
      const results = await manager.send(
        req.params.roomSlug,
        req.userId,
        req.app.get('io'),
        req.body?.body,
        req.body?.authorName || 'Host'
      );
      res.json({ results });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post('/:roomSlug/moderate', auth, async (req, res) => {
    const { action, platform, userId, username, durationSec, messageId, externalMessageId } =
      req.body || {};
    if (!action) return res.status(400).json({ error: 'action_required' });

    const results = await manager.moderate(
      req.params.roomSlug,
      req.userId,
      req.app.get('io'),
      action,
      {
        platform: platform || 'all',
        userId,
        username,
        durationSec,
        messageId,
        externalMessageId,
      }
    );
    res.json({ results });
  });

  return router;
}

import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireResearchiumApiKey } from '../middleware/require-api-key.js';

export function createSessionsRouter(chatService) {
  const router = Router();
  router.use(requireResearchiumApiKey);

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const { roomSlug, title, externalSessionId, metadata } = req.body || {};
      const session = await chatService.ensureSession({
        roomSlug,
        title,
        externalSessionId,
        metadata,
      });
      res.status(201).json({ session });
    })
  );

  router.get(
    '/:roomSlug',
    asyncHandler(async (req, res) => {
      const { repository } = await import('../db/repository.js');
      const session = await repository.requireSession(req.params.roomSlug);
      res.json({ session });
    })
  );

  return router;
}

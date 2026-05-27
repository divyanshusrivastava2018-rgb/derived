import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireResearchiumApiKey } from '../middleware/require-api-key.js';

export function createMessagesRouter(chatService) {
  const router = Router({ mergeParams: true });
  router.use(requireResearchiumApiKey);

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { since, limit, includePrivate } = req.query;
      const result = await chatService.receiveMessages(req.params.roomSlug, {
        since,
        limit: limit ? Number(limit) : 100,
        includePrivate: includePrivate === '1' || includePrivate === 'true',
      });
      res.json({
        session: result.session,
        messages: result.messages,
        count: result.messages.length,
      });
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const message = await chatService.sendMessage(req.params.roomSlug, req.body || {});
      res.status(201).json({ message });
    })
  );

  return router;
}

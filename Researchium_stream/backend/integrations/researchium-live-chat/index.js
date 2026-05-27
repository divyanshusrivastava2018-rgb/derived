import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { integrationConfig, usePostgres } from './config.js';
import { errorMiddleware, asyncHandler } from './lib/errors.js';
import { pingDb } from './db/pool.js';
import { ChatService } from './services/chat-service.js';
import { WebhookProcessor } from './services/webhook-processor.js';
import { createSessionsRouter } from './routes/sessions.js';
import { createMessagesRouter } from './routes/messages.js';
import { createWebhooksRouter } from './routes/webhooks.js';
import { requireResearchiumApiKey } from './middleware/require-api-key.js';

let retryTimer = null;

/**
 * Mount Researchium live chat integration on an Express app.
 * @param {{ io?: import('socket.io').Server, onBroadcast?: Function }} deps
 */
export function createResearchiumLiveChatIntegration(deps = {}) {
  const chatService = new ChatService({
    io: deps.io,
    onBroadcast: deps.onBroadcast,
  });
  const webhookProcessor = new WebhookProcessor(chatService);

  const router = Router();

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: integrationConfig.rateLimitPerMinute,
    standardHeaders: true,
    legacyHeaders: false,
  });
  router.use(limiter);

  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      let db = false;
      if (usePostgres()) {
        try {
          db = await pingDb();
        } catch {
          db = false;
        }
      }
      res.json({
        ok: true,
        service: 'researchium-live-chat',
        store: usePostgres() ? 'postgres' : 'memory',
        db,
        enabled: integrationConfig.enabled,
      });
    })
  );

  router.use('/sessions', createSessionsRouter(chatService));
  router.use('/sessions/:roomSlug/messages', createMessagesRouter(chatService));
  router.use('/webhooks', createWebhooksRouter(webhookProcessor));

  router.post(
    '/admin/retry-webhooks',
    requireResearchiumApiKey,
    asyncHandler(async (req, res) => {
      const results = await webhookProcessor.processPendingBatch(
        Math.min(50, Number(req.body?.limit) || 10)
      );
      res.json({ results });
    })
  );

  router.use(errorMiddleware);

  function startRetryWorker() {
    if (retryTimer) return;
    retryTimer = setInterval(() => {
      webhookProcessor.processPendingBatch(20).catch(() => {});
    }, 30000);
    if (retryTimer.unref) retryTimer.unref();
  }

  function stopRetryWorker() {
    if (retryTimer) clearInterval(retryTimer);
    retryTimer = null;
  }

  return { router, chatService, webhookProcessor, startRetryWorker, stopRetryWorker };
}

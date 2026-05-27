import express from 'express';
import { Router } from 'express';
import { asyncHandler, ValidationError } from '../lib/errors.js';
import { integrationConfig } from '../config.js';
import { verifyWebhookSignature } from '../lib/signature.js';
import { requireResearchiumApiKey } from '../middleware/require-api-key.js';

export function createWebhooksRouter(webhookProcessor) {
  const router = Router();

  router.post(
    '/events',
    express.text({ type: 'application/json', limit: '1mb' }),
    asyncHandler(async (req, res) => {
      const rawBody = req.body || '';
      const signature = req.get('X-Researchium-Signature') || req.get('X-Webhook-Signature');

      if (integrationConfig.webhookSecret) {
        verifyWebhookSignature(integrationConfig.webhookSecret, rawBody, signature);
      } else if (process.env.NODE_ENV === 'production') {
        throw new ValidationError('RESEARCHIUM_WEBHOOK_SECRET required in production');
      }

      let event;
      try {
        event = JSON.parse(rawBody);
      } catch {
        throw new ValidationError('Invalid JSON body');
      }

      const result = await webhookProcessor.ingest(event);
      res.status(result.duplicate ? 200 : 202).json(result);
    })
  );

  router.post(
    '/retry',
    express.json(),
    requireResearchiumApiKey,
    asyncHandler(async (req, res) => {
      const limit = Math.min(50, Number(req.body?.limit) || 10);
      const results = await webhookProcessor.processPendingBatch(limit);
      res.json({ processed: results.length, results });
    })
  );

  return router;
}

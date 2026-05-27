import { Router } from 'express';
import { pingDb } from '../db/pool.js';
import { asyncHandler } from '../middleware/async-handler.js';

export const healthRouter = Router();

async function currentHealth() {
  let db = false;
  try {
    db = await pingDb();
  } catch {
    db = false;
  }
  return { ok: true, db };
}

healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    // Liveness endpoint: API process is reachable.
    const payload = await currentHealth();
    res.status(200).json(payload);
  })
);

healthRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    // Readiness endpoint: only ready when DB connectivity is available.
    const payload = await currentHealth();
    res.status(payload.db ? 200 : 503).json(payload);
  })
);

import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireApiKey } from '../middleware/require-api-key.js';
import * as researchers from '../services/researchers.js';

export const researchersRouter = Router();

researchersRouter.get(
  '/api/researchers',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const rows = await researchers.listResearchers({ limit, offset });
    res.json({ researchers: rows, limit, offset });
  })
);

researchersRouter.get(
  '/api/researchers/:id',
  asyncHandler(async (req, res) => {
    const row = await researchers.getResearcherById(req.params.id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    res.json({ researcher: row });
  })
);

researchersRouter.post(
  '/api/researchers',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { name, orcid, institution } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name_required' });
    }
    const row = await researchers.createResearcher({ name, orcid, institution });
    res.status(201).json({ researcher: row });
  })
);

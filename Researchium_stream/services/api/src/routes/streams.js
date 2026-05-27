import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireApiKey } from '../middleware/require-api-key.js';
import * as streams from '../services/streams.js';

export const streamsRouter = Router();

streamsRouter.get(
  '/api/streams',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const status = req.query.status ? String(req.query.status) : undefined;
    const rows = await streams.listStreams({ status, limit, offset });
    res.json({ streams: rows, limit, offset });
  })
);

streamsRouter.get(
  '/api/streams/:id',
  asyncHandler(async (req, res) => {
    const stream = await streams.getStreamById(req.params.id);
    if (!stream) return res.status(404).json({ error: 'not_found' });
    const graph = await streams.getStreamGraph(stream.id);
    const { gate_password_hash, ...publicStream } = stream;
    res.json({ stream: publicStream, graph });
  })
);

streamsRouter.post(
  '/api/streams',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { hostId, title, topic, roomSlug, status, isGated, gatePassword } =
      req.body || {};
    if (!hostId || !title || !roomSlug) {
      return res.status(400).json({ error: 'hostId_title_roomSlug_required' });
    }
    const row = await streams.createStream({
      hostId,
      title,
      topic,
      roomSlug,
      status,
      isGated: Boolean(isGated),
      gatePassword,
    });
    res.status(201).json({ stream: row });
  })
);

streamsRouter.patch(
  '/api/streams/:id',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status_required' });
    const row = await streams.updateStreamStatus(req.params.id, status);
    if (!row) return res.status(404).json({ error: 'not_found' });
    res.json({ stream: row });
  })
);

streamsRouter.post(
  '/api/streams/:id/verify-gate',
  asyncHandler(async (req, res) => {
    const stream = await streams.getStreamGateById(req.params.id);
    if (!stream) return res.status(404).json({ error: 'not_found' });
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'password_required' });
    await streams.verifyGatePassword(stream, password);
    res.json({ ok: true, roomSlug: stream.room_slug });
  })
);

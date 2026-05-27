import { Router } from 'express';
import { createPeerId, signRoomToken } from '../../../shared/auth.js';
import { assertRoomId } from '../../../shared/validate.js';
import { requireApiKey } from '../middleware/require-api-key.js';
import { asyncHandler } from '../middleware/async-handler.js';
import * as streams from '../services/streams.js';

export const authRouter = Router();

const ROLES = ['viewer', 'presenter', 'moderator'];

authRouter.post(
  '/api/auth/room-token',
  requireApiKey,
  asyncHandler(async (req, res) => {
    const { roomId, role = 'viewer', gatePassword } = req.body || {};

    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'invalid_room' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: 'invalid_role' });
    }

    assertRoomId(roomId);

    const stream = await streams.getStreamByRoomSlug(roomId);
    if (!stream) {
      return res.status(404).json({ error: 'stream_not_found' });
    }

    if (stream.is_gated && role === 'viewer') {
      if (!gatePassword) {
        return res.status(403).json({ error: 'gate_password_required' });
      }
      await streams.verifyGatePassword(stream, gatePassword);
    }

    if (role === 'presenter' || role === 'moderator') {
      // Presenter tokens require API key (already enforced)
    }

    const peerId = createPeerId();
    const token = signRoomToken({ peerId, roomId, role });
    res.json({
      token,
      peerId,
      roomId,
      streamId: stream.id,
      expiresIn: 7200,
    });
  })
);

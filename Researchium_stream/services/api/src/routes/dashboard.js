import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireUser } from '../middleware/require-user.js';
import { assertRoomId } from '../../../shared/validate.js';
import * as dashboard from '../services/dashboard.js';
import * as studio from '../services/studio.js';
import { buildMeetingResponse } from '../lib/meeting-payload.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/api/dashboard',
  requireUser,
  asyncHandler(async (req, res) => {
    const data = await dashboard.getDashboard(req.user.researcherId);
    res.json({
      user: req.user,
      ...data,
    });
  })
);

dashboardRouter.post(
  '/api/dashboard/meeting',
  requireUser,
  asyncHandler(async (req, res) => {
    const origin = req.body?.origin || req.get('origin') || '';
    const payload = await dashboard.openMeeting(req.user.researcherId, req.user.name, {
      title: req.body?.title,
      forceNew: Boolean(req.body?.forceNew),
      origin,
    });
    res.status(payload.resumed ? 200 : 201).json(payload);
  })
);

dashboardRouter.post(
  '/api/dashboard/meeting/:roomSlug/live',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const live = req.body?.live !== false;
    const result = await dashboard.setMeetingLive(
      req.user.researcherId,
      req.params.roomSlug,
      live
    );
    res.json(result);
  })
);

dashboardRouter.get(
  '/api/dashboard/meeting/:roomSlug',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    await studio.assertHost(req.params.roomSlug, req.user.researcherId);
    const state = await studio.getRoomState(req.params.roomSlug);
    if (!state) return res.status(404).json({ error: 'not_found' });
    res.json(
      buildMeetingResponse({
        stream: state.stream,
        roomSlug: req.params.roomSlug,
        state,
        origin: req.query.origin || '',
      })
    );
  })
);

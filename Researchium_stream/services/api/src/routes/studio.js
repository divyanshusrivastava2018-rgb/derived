import { Router } from 'express';
import { createPeerId, signRoomToken } from '../../../shared/auth.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireUser } from '../middleware/require-user.js';
import * as streams from '../services/streams.js';
import * as studio from '../services/studio.js';
import * as devAuth from '../dev-auth.js';
import { sanitizeShortText, sanitizeChatBody, assertRoomId } from '../../../shared/validate.js';
import { guestChatRateLimit } from '../middleware/auth-rate-limit.js';

export const studioRouter = Router();

function slugify(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base || 'stream'}-${Date.now().toString(36)}`;
}

function signalingPayload(roomSlug, role = 'presenter') {
  const peerId = createPeerId();
  const signalingToken = signRoomToken({ peerId, roomId: roomSlug, role });
  const signalingUrl =
    process.env.SIGNALING_PUBLIC_URL ||
    `http://${process.env.PUBLIC_HOST || '127.0.0.1'}:${process.env.SIGNALING_PORT || 4001}`;
  return { peerId, signalingToken, signalingUrl };
}

studioRouter.post(
  '/api/studio/start',
  requireUser,
  asyncHandler(async (req, res) => {
    const title =
      sanitizeShortText(req.body?.title, 300) ||
      `Live with Researchium, ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    const roomSlug = slugify(title);
    const origin = req.body?.origin || '';

    let stream;
    try {
      stream = await streams.createStream({
        hostId: req.user.researcherId,
        title,
        topic: 'Studio',
        roomSlug,
        status: 'scheduled',
        isGated: false,
      });
    } catch (e) {
      if (devAuth.devAuthEnabled() && (devAuth.isDbConnectionError(e) || !(await devAuth.isDatabaseAvailable()))) {
        devAuth.markDatabaseUnavailable();
        stream = devAuth.createDevStream({
          title,
          roomSlug,
          hostId: req.user.researcherId,
        });
        stream.host_name = req.user.name;
      } else {
        throw e;
      }
    }

    const state = await studio.bootstrapStudio(stream);
    const sig = signalingPayload(roomSlug, 'presenter');

    res.status(201).json({
      stream,
      roomSlug,
      ...sig,
      inviteUrl: `${origin}/join.html?room=${encodeURIComponent(roomSlug)}`,
      studio: studio.formatPublicState(state, { includeInviteTokens: true }),
    });
  })
);

studioRouter.get(
  '/api/studio/room/:roomSlug',
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const state = await studio.getRoomState(req.params.roomSlug);
    if (!state) return res.status(404).json({ error: 'not_found' });
    res.json({ studio: studio.formatPublicState(state, { publicOnly: true }) });
  })
);

studioRouter.get(
  '/api/studio/room/:roomSlug/host',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    await studio.assertHost(req.params.roomSlug, req.user.researcherId);
    const state = await studio.getRoomState(req.params.roomSlug);
    const sig = signalingPayload(req.params.roomSlug, 'presenter');
    const origin = req.get('origin') || req.query.origin || '';
    res.json({
      studio: studio.formatPublicState(state, { includeInviteTokens: true }),
      ...sig,
      inviteUrl: `${origin}/join.html?room=${encodeURIComponent(req.params.roomSlug)}`,
    });
  })
);

studioRouter.patch(
  '/api/studio/room/:roomSlug',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const { layout, recordingEnabled, streamQuality, activeSceneId, scheduledAt } = req.body || {};
    await studio.updateSession(req.params.roomSlug, req.user.researcherId, {
      layout,
      recordingEnabled,
      streamQuality,
      activeSceneId,
      scheduledAt,
    });
    const state = await studio.getRoomState(req.params.roomSlug);
    res.json({ studio: studio.formatPublicState(state, { includeInviteTokens: true }) });
  })
);

studioRouter.post(
  '/api/studio/room/:roomSlug/live',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const live = req.body?.live !== false;
    const state = await studio.setLive(req.params.roomSlug, req.user.researcherId, live);
    res.json({ studio: studio.formatPublicState(state, { includeInviteTokens: true }) });
  })
);

studioRouter.get(
  '/api/studio/room/:roomSlug/scenes',
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const scenes = await studio.listScenes(req.params.roomSlug);
    res.json({ scenes });
  })
);

studioRouter.post(
  '/api/studio/room/:roomSlug/scenes',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const scene = await studio.createScene(req.params.roomSlug, req.user.researcherId, {
      name: req.body?.name,
      layout_type: req.body?.layoutType,
    });
    res.status(201).json({ scene });
  })
);

studioRouter.patch(
  '/api/studio/room/:roomSlug/scenes/:sceneId',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const scene = await studio.patchScene(req.params.roomSlug, req.user.researcherId, req.params.sceneId, {
      name: req.body?.name,
      layout_type: req.body?.layoutType,
      active: req.body?.active,
    });
    res.json({ scene });
  })
);

studioRouter.delete(
  '/api/studio/room/:roomSlug/scenes/:sceneId',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    await studio.deleteScene(req.params.roomSlug, req.user.researcherId, req.params.sceneId);
    res.status(204).end();
  })
);

studioRouter.get(
  '/api/studio/room/:roomSlug/chat',
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const isPrivate = req.query.private === '1' ? true : req.query.private === '0' ? false : undefined;
    const isHostRequest = req.get('Authorization')?.startsWith('Bearer ');
    const messages = await studio.listMessages(req.params.roomSlug, {
      isPrivate: isHostRequest ? isPrivate : false,
      since: req.query.since,
    });
    res.json({ messages });
  })
);

studioRouter.post(
  '/api/studio/room/:roomSlug/chat',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const msg = await studio.postMessage(
      req.params.roomSlug,
      {
        author_name: req.body?.authorName || req.user.name,
        author_role: 'host',
        body: req.body?.body,
        is_private: req.body?.isPrivate,
      },
      req.user.researcherId
    );
    res.status(201).json({ message: msg });
  })
);

studioRouter.post(
  '/api/studio/room/:roomSlug/chat/guest',
  guestChatRateLimit,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const inviteToken = req.body?.inviteToken;
    const guest = await studio.verifyJoinedGuest(req.params.roomSlug, inviteToken);
    const authorName = sanitizeShortText(req.body?.authorName || guest.display_name, 120);
    if (req.body?.isPrivate) {
      return res.status(403).json({ error: 'private_not_allowed' });
    }
    const msg = await studio.postMessage(req.params.roomSlug, {
      author_name: authorName,
      author_role: 'guest',
      body: sanitizeChatBody(req.body?.body, 2000),
      is_private: false,
    });
    res.status(201).json({ message: msg });
  })
);

studioRouter.get(
  '/api/studio/room/:roomSlug/guests',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    await studio.assertHost(req.params.roomSlug, req.user.researcherId);
    const state = await studio.getRoomState(req.params.roomSlug);
    res.json({ guests: studio.formatPublicState(state, { includeInviteTokens: true }).guests });
  })
);

studioRouter.post(
  '/api/studio/room/:roomSlug/guests',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const guest = await studio.createGuestInvite(req.params.roomSlug, req.user.researcherId);
    const origin = req.body?.origin || '';
    res.status(201).json({
      guest: {
        id: guest.id,
        inviteToken: guest.invite_token,
        inviteUrl: `${origin}/join.html?room=${encodeURIComponent(req.params.roomSlug)}&token=${guest.invite_token}`,
      },
    });
  })
);

studioRouter.post(
  '/api/studio/room/:roomSlug/join',
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const guest = await studio.joinAsGuest(req.params.roomSlug, {
      invite_token: req.body?.inviteToken,
      display_name: req.body?.displayName,
    });
    const sig = signalingPayload(req.params.roomSlug, 'viewer');
    res.json({
      guest: {
        id: guest.id,
        displayName: guest.display_name,
        status: guest.status,
      },
      ...sig,
    });
  })
);

studioRouter.get(
  '/api/studio/room/:roomSlug/notes',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const notes = await studio.getNotes(req.params.roomSlug, req.user.researcherId);
    res.json({ notes: notes.content });
  })
);

studioRouter.put(
  '/api/studio/room/:roomSlug/notes',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const notes = await studio.saveNotes(
      req.params.roomSlug,
      req.user.researcherId,
      req.body?.content ?? ''
    );
    res.json({ notes: notes.content });
  })
);

studioRouter.post(
  '/api/studio/room/:roomSlug/sources',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    const source = await studio.addSource(req.params.roomSlug, req.user.researcherId, {
      kind: req.body?.kind,
      label: req.body?.label,
      config: req.body?.config,
    });
    res.status(201).json({ source });
  })
);

studioRouter.post(
  '/api/studio/room/:roomSlug/signaling-token',
  requireUser,
  asyncHandler(async (req, res) => {
    assertRoomId(req.params.roomSlug);
    await studio.assertHost(req.params.roomSlug, req.user.researcherId);
    const role = req.body?.role === 'viewer' ? 'viewer' : 'presenter';
    res.json(signalingPayload(req.params.roomSlug, role));
  })
);

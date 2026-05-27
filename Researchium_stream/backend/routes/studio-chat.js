import { Router } from 'express';
import { config } from '../config.js';

/** Optional explicit chat proxy on studio backend (UI may also use /api/studio/* via proxy). */
export function createStudioChatRouter(studioChatService, authService) {
  const router = Router();

  router.get('/room/:roomSlug/chat', async (req, res) => {
    try {
      const data = await studioChatService.listMessages(
        req.params.roomSlug,
        req.query,
        req.get('Authorization')
      );
      res.json(data);
    } catch (e) {
      const status = e.response?.status || 502;
      res.status(status).json({ error: e.response?.data?.error || 'chat_fetch_failed' });
    }
  });

  router.post('/room/:roomSlug/chat', authService.authenticate.bind(authService), async (req, res) => {
    try {
      const data = await studioChatService.postHostMessage(
        req.params.roomSlug,
        req.body?.body,
        req.body?.isPrivate,
        req.get('Authorization')
      );
      res.status(201).json(data);
    } catch (e) {
      const status = e.response?.status || 502;
      res.status(status).json({ error: e.response?.data?.error || 'chat_post_failed' });
    }
  });

  router.get('/room/:roomSlug/info', async (req, res) => {
    res.json({
      roomSlug: req.params.roomSlug,
      chat: {
        rest: `/api/studio/room/${req.params.roomSlug}/chat`,
        socketEvent: 'studio-chat',
        gateway: config.port,
      },
      signaling: {
        url: process.env.PUBLIC_SIGNALING_URL || `http://${config.host}:${config.port}`,
        events: ['studio-chat', 'studio-state', 'signal', 'room-peers', 'peer-joined', 'peer-left'],
      },
    });
  });

  return router;
}

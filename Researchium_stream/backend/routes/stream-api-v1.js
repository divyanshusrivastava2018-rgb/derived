import { Router } from 'express';

/**
 * Unified REST API v1 — platform connections, chat, stream sessions.
 */
export function createStreamApiV1Router({
  multistreamManager,
  unifiedChatManager,
  streamSessionManager,
  authService,
}) {
  const router = Router();
  const auth = authService.authenticate.bind(authService);
  const dashboardReturn =
    process.env.MULTISTREAM_OAUTH_SUCCESS_URL ||
    'http://127.0.0.1:5500/stream-dashboard.html?panel=destinations';

  router.get('/health', (_req, res) => {
    res.json({ ok: true, version: 'v1', service: 'researchium-stream-api' });
  });

  /* ── Platform connections (encrypted credentials in Postgres) ── */
  router.get('/platforms', auth, (req, res) => {
    res.json({ platforms: multistreamManager.listPlatforms(req.userId) });
  });

  router.get('/connections', auth, async (req, res) => {
    const connections = await multistreamManager.listConnections(req.userId);
    res.json({ connections });
  });

  router.get('/connections/:platform', auth, async (req, res) => {
    const connections = await multistreamManager.listConnections(req.userId);
    const conn = connections.find((c) => c.platform === req.params.platform);
    if (!conn) return res.status(404).json({ error: 'not_found' });
    res.json({ connection: conn });
  });

  router.post('/connections/:platform/oauth', auth, (req, res) => {
    try {
      const { url } = multistreamManager.startOAuth(req.params.platform, req.userId);
      res.json({ authUrl: url });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get('/connections/:platform/oauth/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query;
      if (error) {
        return res.redirect(`${dashboardReturn}&oauth_error=${encodeURIComponent(error)}`);
      }
      await multistreamManager.completeOAuth(req.params.platform, code, state);
      res.redirect(`${dashboardReturn}&oauth=connected&platform=${req.params.platform}`);
    } catch (e) {
      res.redirect(`${dashboardReturn}&oauth_error=${encodeURIComponent(e.message)}`);
    }
  });

  router.delete('/connections/:platform', auth, async (req, res) => {
    await multistreamManager.disconnect(req.userId, req.params.platform);
    res.json({ ok: true });
  });

  /* ── Chat messages (platform origin in unified_chat_messages) ── */
  router.get('/rooms/:roomSlug/chat/messages', auth, async (req, res) => {
    const messages = await unifiedChatManager.history(req.params.roomSlug, {
      since: req.query.since,
      platform: req.query.platform,
      limit: Number(req.query.limit) || 100,
    });
    res.json({ messages });
  });

  router.post('/rooms/:roomSlug/chat/messages', auth, async (req, res) => {
    const body = req.body?.body?.trim();
    if (!body) return res.status(400).json({ error: 'body_required' });

    const platform = req.body?.platform || 'studio';
    if (platform === 'studio') {
      const { unifiedChatRepo } = await import('../services/unified-chat/repository.js');
      const saved = await unifiedChatRepo.saveMessage({
        roomSlug: req.params.roomSlug,
        platform: 'studio',
        authorName: req.body?.authorName || 'Host',
        authorId: req.userId,
        body,
      });
      req.app.get('io')?.to(req.params.roomSlug).emit('unified-chat-message', saved);
      req.app.get('io')?.to(`chat:${req.params.roomSlug}`).emit('chat-relay-message', saved);
      return res.status(201).json({ message: saved });
    }

    try {
      const results = await unifiedChatManager.send(
        req.params.roomSlug,
        req.userId,
        req.app.get('io'),
        body,
        req.body?.authorName || 'Host'
      );
      res.status(201).json({ results });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post('/rooms/:roomSlug/chat/relay/start', auth, async (req, res) => {
    try {
      const result = await unifiedChatManager.start(
        req.params.roomSlug,
        req.userId,
        req.app.get('io'),
        req.body || {}
      );
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post('/rooms/:roomSlug/chat/relay/stop', auth, async (req, res) => {
    await unifiedChatManager.stop(req.params.roomSlug);
    res.json({ ok: true, status: unifiedChatManager.status(req.params.roomSlug) });
  });

  router.post('/rooms/:roomSlug/chat/moderate', auth, async (req, res) => {
    const { action, platform, userId, username, durationSec, messageId, externalMessageId } =
      req.body || {};
    if (!action) return res.status(400).json({ error: 'action_required' });

    const results = await unifiedChatManager.moderate(
      req.params.roomSlug,
      req.userId,
      req.app.get('io'),
      action,
      {
        platform: platform || 'all',
        userId,
        username,
        durationSec,
        messageId,
        externalMessageId,
      }
    );
    res.json({ results });
  });

  router.get('/rooms/:roomSlug/chat/relay/status', auth, (req, res) => {
    res.json(unifiedChatManager.status(req.params.roomSlug));
  });

  /* ── Stream sessions (start/end, viewer peaks) ── */
  router.get('/sessions', auth, async (req, res) => {
    const sessions = await streamSessionManager.list(req.userId, {
      limit: Number(req.query.limit) || 20,
      status: req.query.status,
    });
    res.json({ sessions });
  });

  router.get('/sessions/:sessionId', auth, async (req, res) => {
    const session = await streamSessionManager.get(req.params.sessionId);
    if (!session || session.userId !== req.userId) {
      return res.status(404).json({ error: 'not_found' });
    }
    res.json({ session });
  });

  router.post('/sessions', auth, async (req, res) => {
    const session = await streamSessionManager.start(req.userId, {
      roomSlug: req.body?.roomSlug,
      broadcastId: req.body?.broadcastId,
      title: req.body?.title,
      metadata: req.body?.metadata,
    });
    res.status(201).json({ session });
  });

  router.post('/sessions/:sessionId/end', auth, async (req, res) => {
    const existing = await streamSessionManager.get(req.params.sessionId);
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: 'not_found' });
    }
    const session = await streamSessionManager.end(
      req.params.sessionId,
      req.body?.status || 'ended'
    );
    res.json({ session });
  });

  router.get('/sessions/:sessionId/analytics', auth, async (req, res) => {
    const session = await streamSessionManager.get(req.params.sessionId);
    if (!session || session.userId !== req.userId) {
      return res.status(404).json({ error: 'not_found' });
    }
    const samples = await streamSessionManager.samples(req.params.sessionId);
    res.json({
      session: {
        id: session.id,
        peakViewers: session.peakViewers,
        peakViewersAt: session.peakViewersAt,
        platformPeaks: session.platformPeaks,
        lastViewerTotal: session.lastViewerTotal,
      },
      samples,
    });
  });

  router.get('/rooms/:roomSlug/session', auth, async (req, res) => {
    const session = await streamSessionManager.getActive(req.params.roomSlug);
    if (!session || session.userId !== req.userId) {
      return res.status(404).json({ error: 'no_active_session' });
    }
    res.json({ session });
  });

  return router;
}

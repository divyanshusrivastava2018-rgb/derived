import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { config } from './config.js';
import { log } from './lib/logger.js';
import { connectRedis } from './lib/redis.js';
import { studioGatewayRouter } from './routes/studio-gateway.js';
import { WebRTCSignaling } from './services/webrtc-signaling.js';
import { YouTubeLiveService } from './services/youtube-live.js';
import { AdaptiveBitrateController } from './algorithms/adaptive-bitrate.js';
import { SceneCompositor } from './services/scene-compositor.js';
import { MetricsCollector } from './monitoring/metrics.js';
import { RoomManager } from './services/room-manager.js';
import { AuthService } from './services/auth.js';
import { TranscoderService } from './services/transcoder.js';
import { StudioChatService } from './services/studio-chat.js';
import { createStudioChatRouter } from './routes/studio-chat.js';
import { createResearchiumLiveChatIntegration } from './integrations/researchium-live-chat/index.js';
import { integrationConfig } from './integrations/researchium-live-chat/config.js';
import { MultistreamManager } from './services/multistream/manager.js';
import { createMultistreamRouter } from './routes/multistream.js';
import { UnifiedChatManager } from './services/unified-chat/manager.js';
import { createUnifiedChatRouter } from './routes/unified-chat.js';
import { createStudioControlsRouter } from './routes/studio-controls.js';
import { createSceneController, overlayManager, analyticsCollector } from './services/studio-controls/index.js';
import { createStreamApiV1Router } from './routes/stream-api-v1.js';
import { streamSessionManager } from './services/stream-sessions/manager.js';
import { ChatRelayService } from './services/chat-relay.js';
import { createRtmpRouter } from './routes/rtmp.js';
import { rtmpLimiter } from './middleware/rate-limits.js';
import { apiErrorHandler } from './middleware/api-errors.js';
import { listDistributions, stopDistribution } from './services/rtmp/distributor.js';

const app = express();
const httpServer = createServer(app);

const { client: redisClient, subClient: redisSubClient } = await connectRedis();

const corsOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOriginFn = (origin, cb) => {
  if (!origin) return cb(null, true);
  if (!corsOrigins.length) {
    return cb(null, /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  }
  cb(null, corsOrigins.includes(origin));
};

const io = new Server(httpServer, {
  cors: { origin: corsOriginFn, credentials: true },
});

if (redisClient && redisSubClient) {
  try {
    const { createAdapter } = await import('@socket.io/redis-adapter');
    io.adapter(createAdapter(redisClient, redisSubClient));
    log.info('Socket.IO Redis adapter enabled');
  } catch (e) {
    log.warn(`Redis adapter not loaded: ${e.message}`);
  }
}

app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(
  cors({
    origin: corsOriginFn,
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

let apiLimiter;
if (redisClient) {
  try {
    const { RedisStore } = await import('rate-limit-redis');
    apiLimiter = rateLimit({
      store: new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
      }),
      windowMs: 15 * 60 * 1000,
      max: Number(process.env.API_RATE_LIMIT_MAX) || 100,
      message: { error: 'too_many_requests' },
      standardHeaders: true,
      legacyHeaders: false,
    });
  } catch {
    apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
  }
} else {
  apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.API_RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
}
app.use('/api/', apiLimiter);

const roomManager = new RoomManager(io, redisClient);
const webrtcSignaling = new WebRTCSignaling(io, roomManager);
const adaptiveBitrate = new AdaptiveBitrateController(redisClient);
const sceneCompositor = new SceneCompositor(redisClient);
const sceneController = createSceneController(sceneCompositor);
const metricsCollector = new MetricsCollector(redisClient);
const authService = new AuthService(redisClient);
const youtubeService = new YouTubeLiveService(redisClient);
const transcoderService = new TranscoderService();
const studioChatService = new StudioChatService(authService);

const researchiumChat = integrationConfig.enabled
  ? createResearchiumLiveChatIntegration({ io })
  : null;
const multistreamManager = new MultistreamManager();
const unifiedChatManager = new UnifiedChatManager();
const chatRelay = new ChatRelayService(unifiedChatManager);

app.set('io', io);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    version: '2.0.0',
    activeRooms: roomManager.getActiveRoomsCount(),
    redis: Boolean(redisClient),
  });
});

app.post('/api/rooms/create', authService.authenticate.bind(authService), async (req, res) => {
  try {
    const { roomName, settings } = req.body || {};
    const room = await roomManager.createRoom(roomName, req.userId, settings);
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rooms/:roomId/join', authService.authenticate.bind(authService), async (req, res) => {
  try {
    const { roomId } = req.params;
    const token = await roomManager.generateJoinToken(roomId, req.userId);
    res.json({ token, roomId });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

app.post('/api/youtube/stream/start', authService.authenticate.bind(authService), async (req, res) => {
  try {
    const { title, description, privacyStatus } = req.body || {};
    const streamData = await youtubeService.createLiveStream(title, description, privacyStatus);
    res.json(streamData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/youtube/stream/end', authService.authenticate.bind(authService), async (req, res) => {
  try {
    const { broadcastId } = req.body || {};
    const result = await youtubeService.endLiveStream(broadcastId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/youtube/stream/:broadcastId/status', authService.authenticate.bind(authService), async (req, res) => {
  try {
    const status = await youtubeService.getStreamStatus(req.params.broadcastId);
    res.json({ broadcastId: req.params.broadcastId, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/youtube/stream/:broadcastId', authService.authenticate.bind(authService), async (req, res) => {
  try {
    const { title, description } = req.body || {};
    const updated = await youtubeService.updateStreamMetadata(
      req.params.broadcastId,
      title,
      description
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/metrics/room/:roomId', authService.authenticate.bind(authService), async (req, res) => {
  const metrics = await metricsCollector.getRoomMetrics(req.params.roomId);
  res.json(metrics);
});

app.get('/api/metrics/system', authService.authenticate.bind(authService), async (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const [samples, timeseries] = await Promise.all([
    metricsCollector.getSystemMetrics(limit),
    metricsCollector.getTimeseries(Math.min(100, limit)),
  ]);
  res.json({ samples, timeseries });
});

app.use('/studio', studioGatewayRouter);
app.use('/studio', createStudioChatRouter(studioChatService, authService));

if (researchiumChat) {
  app.use('/api/integrations/researchium/v1', researchiumChat.router);
}

app.use('/api/rtmp', rtmpLimiter, createRtmpRouter({ multistreamManager, authService }));
app.use('/api/multistream', createMultistreamRouter(multistreamManager, authService));
app.use('/api/unified-chat', createUnifiedChatRouter(unifiedChatManager, authService));
app.use(
  '/api/studio-controls',
  createStudioControlsRouter({ sceneController, authService })
);
app.use(
  '/api/v1',
  createStreamApiV1Router({
    multistreamManager,
    unifiedChatManager,
    streamSessionManager,
    authService,
  })
);

app.use(
  createProxyMiddleware({
    target: config.apiUrl,
    changeOrigin: true,
    pathFilter: (pathname) => {
      const native =
        pathname === '/api/health' ||
        pathname.startsWith('/api/rooms') ||
        pathname.startsWith('/api/youtube') ||
        pathname.startsWith('/api/metrics/room') ||
        pathname === '/api/metrics/system' ||
        pathname.startsWith('/api/integrations/researchium') ||
        pathname.startsWith('/api/multistream') ||
        pathname.startsWith('/api/unified-chat') ||
        pathname.startsWith('/api/studio-controls') ||
        pathname.startsWith('/api/v1') ||
        pathname.startsWith('/api/rtmp');
      return pathname.startsWith('/api/') && !native;
    },
  })
);

app.use(apiErrorHandler);

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));
    const payload = authService.verifySocketToken(token);
    socket.data.peerId = payload.sub;
    socket.data.roomId = payload.roomId;
    socket.data.role = payload.role || 'viewer';
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

chatRelay.register(io);

io.on('connection', (socket) => {
  const { peerId, roomId } = socket.data;
  log.info(`Client connected: ${socket.id} room=${roomId} peer=${peerId}`);

  if (roomId && peerId) {
    webrtcSignaling.registerSocket(socket, {
      peerId,
      roomId,
      role: socket.data.role,
    });
  }

  socket.on('webrtc-offer', async (data) => {
    const { roomId: rid, sdp, userId } = data || {};
    const room = rid || socket.data.roomId;
    const bitrateStrategy = await adaptiveBitrate.calculateStrategy(room);
    await webrtcSignaling.handleOffer(socket, room, sdp, userId, bitrateStrategy);
  });

  socket.on('webrtc-answer', (data) => {
    webrtcSignaling.handleAnswer(socket, data?.roomId || socket.data.roomId, data?.sdp);
  });

  socket.on('ice-candidate', (data) => {
    webrtcSignaling.handleIceCandidate(
      socket,
      data?.roomId || socket.data.roomId,
      data?.candidate
    );
  });

  socket.on('signal', (msg) => webrtcSignaling.handleLegacySignal(socket, msg));
  socket.on('studio-chat', async (msg) => {
    await studioChatService.handleStudioChat(io, socket, msg);
  });
  socket.on('studio-state', (patch) => webrtcSignaling.handleStudioState(socket, patch));

  socket.on('unified-chat-start', async (data) => {
    const room = data?.roomId || socket.data.roomId;
    if (!room || socket.data.role === 'viewer') return;
    try {
      const result = await unifiedChatManager.start(room, socket.data.peerId, io, data?.config || {});
      socket.emit('unified-chat-status', result);
    } catch (e) {
      socket.emit('unified-chat-error', { error: e.message });
    }
  });

  socket.on('unified-chat-stop', async () => {
    const room = socket.data.roomId;
    if (room) await unifiedChatManager.stop(room);
    socket.emit('unified-chat-status', unifiedChatManager.status(room));
  });

  socket.on('unified-chat-send', async (data) => {
    const room = data?.roomId || socket.data.roomId;
    if (!room) return;
    try {
      const results = await unifiedChatManager.send(
        room,
        socket.data.peerId,
        io,
        data?.body,
        data?.authorName || 'Host'
      );
      socket.emit('unified-chat-sent', { results });
    } catch (e) {
      socket.emit('unified-chat-error', { error: e.message });
    }
  });

  socket.on('unified-chat-moderate', async (data) => {
    const room = data?.roomId || socket.data.roomId;
    if (!room || (socket.data.role !== 'presenter' && socket.data.role !== 'moderator')) return;
    const results = await unifiedChatManager.moderate(
      room,
      socket.data.peerId,
      io,
      data.action,
      data.target || {}
    );
    socket.emit('unified-chat-moderation-result', { results });
  });

  socket.on('scene-update', async (data) => {
    const { roomId: rid, sceneConfig } = data || {};
    const room = rid || socket.data.roomId;
    const composedFrame = await sceneCompositor.composeScene(sceneConfig);
    io.to(room).emit('scene-render', { frame: composedFrame, timestamp: Date.now() });
    socket.to(room).emit('studio-state', { layout: sceneConfig?.layout });
  });

  socket.on('studio-scene-switch', async (data) => {
    const room = data?.roomId || socket.data.roomId;
    if (!room || socket.data.role === 'viewer') return;
    if (data?.source === 'obs' && data?.sceneName) {
      try {
        await sceneController.switchObsScene(socket.data.peerId, data.sceneName);
        io.to(room).emit('studio-state', { obsScene: data.sceneName });
      } catch (e) {
        socket.emit('studio-controls-error', { error: e.message });
      }
      return;
    }
    await sceneController.switchBrowserScene(io, room, {
      sceneId: data?.sceneId,
      layout: data?.layout,
      sceneConfig: data?.sceneConfig,
    });
  });

  socket.on('overlay-trigger', (data) => {
    const room = data?.roomId || socket.data.roomId;
    if (!room || !data?.type) return;
    overlayManager.trigger(room, data.type, data, io);
  });

  socket.on('analytics-subscribe', (data) => {
    const room = data?.roomId || socket.data.roomId;
    if (!room) return;
    analyticsCollector.start(room, socket.data.peerId, io, data?.intervalMs || 10000);
  });

  socket.on('analytics-unsubscribe', (data) => {
    const room = data?.roomId || socket.data.roomId;
    if (room) analyticsCollector.stop(room);
  });

  socket.on('chat-message', async (data) => {
    const { roomId: rid, message, userId } = data || {};
    const room = rid || socket.data.roomId;
    const moderated = await authService.moderateMessage(message);
    if (moderated.approved) {
      io.to(room).emit('chat-message', {
        userId,
        message: moderated.message,
        timestamp: Date.now(),
        sentiment: moderated.sentiment,
      });
      io.to(room).emit('studio-chat', {
        authorName: userId || 'Guest',
        body: moderated.message,
        at: Date.now(),
      });
    }
  });

  socket.on('bitrate-metrics', async (data) => {
    const room = data?.roomId || socket.data.roomId;
    if (!room) return;
    await adaptiveBitrate.recordSample(room, data);
    await metricsCollector.updateRoom(room, {
      bandwidth: data.bandwidthKbps ?? data.currentBandwidth,
      latency: data.rtt ?? data.latency,
      packetLoss: data.packetLoss,
      cpuUsage: data.cpuUsage,
      bitrate: data.bitrate ?? data.bandwidthKbps,
    });
  });

  socket.on('screen-share-start', async (data) => {
    const { roomId: rid, streamId } = data || {};
    const room = rid || socket.data.roomId;
    const quality = await adaptiveBitrate.getOptimalResolution(room);
    socket.to(room).emit('screen-share', { streamId, quality });
  });

  socket.on('recording-start', async (data) => {
    const { roomId: rid, userId } = data || {};
    const room = rid || socket.data.roomId;
    if (await authService.hasRecordingPermission(userId || socket.data.peerId)) {
      await transcoderService.startRecording(room);
      io.to(room).emit('recording-status', { status: 'recording' });
    }
  });

  socket.on('invite-guest', async (data) => {
    const { roomId: rid, guestEmail } = data || {};
    const room = rid || socket.data.roomId;
    const token = await authService.generateGuestToken(room, guestEmail);
    const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5500';
    socket.emit('guest-invitation', {
      token,
      roomUrl: `${base}/join.html?room=${encodeURIComponent(room)}&token=${token}`,
    });
  });

  socket.on('disconnect', () => {
    webrtcSignaling.handleDisconnect(socket);
    log.info(`Client disconnected: ${socket.id}`);
  });
});

const PORT = Number(process.env.PORT || process.env.STUDIO_BACKEND_PORT) || 5050;
const HOST = config.host;

httpServer.listen(PORT, HOST, () => {
  log.info(`Researchium Studio Backend v2 on http://${HOST}:${PORT}`);
  log.info(`Core API proxy → ${config.apiUrl}`);
  log.info(`Metrics: GET /api/metrics/room/:roomId, GET /api/metrics/system`);
  if (researchiumChat) {
    researchiumChat.startRetryWorker();
    log.info(`Researchium chat: /api/integrations/researchium/v1`);
  }
  log.info(`Multistream: /api/multistream (YouTube, Twitch, Facebook, LinkedIn)`);
  log.info(`Unified chat: /api/unified-chat/:roomSlug`);
  log.info(`Studio controls: /api/studio-controls (OBS, overlays, analytics)`);
  log.info(`Stream API v1: /api/v1 (connections, chat, sessions)`);
  log.info(`RTMP ingest: /api/rtmp (local nginx-rtmp → distribute)`);
});

function shutdown() {
  researchiumChat?.stopRetryWorker();
  for (const slug of analyticsCollector.rooms.keys()) {
    analyticsCollector.stop(slug);
  }
  for (const d of listDistributions()) {
    stopDistribution(d.streamKey);
  }
  metricsCollector.stop();
  httpServer.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

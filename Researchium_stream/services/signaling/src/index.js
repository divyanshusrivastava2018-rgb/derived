import { createServer } from 'http';
import { Server } from 'socket.io';
import { createSocketCors } from '../../shared/cors.js';
import { getHost, isProduction, requireEnv } from '../../shared/env.js';
import { verifyRoomToken } from '../../shared/auth.js';
import { assertRoomId } from '../../shared/validate.js';
import { createEventLimiter } from '../../shared/rate-limit.js';
import { RoomRegistry } from '../../shared/rooms.js';

const PORT = Number(process.env.SIGNALING_PORT) || 4001;
const MAX_SIGNAL_BYTES = Number(process.env.MAX_SIGNAL_BYTES) || 16_384;
const registry = new RoomRegistry();
const limitEvents = createEventLimiter({
  max: Number(process.env.SIGNALING_EVENT_LIMIT) || 120,
});

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: createSocketCors(),
  maxHttpBufferSize: MAX_SIGNAL_BYTES,
});

if (isProduction() && !process.env.ALLOWED_ORIGINS) {
  console.error('[signaling] ALLOWED_ORIGINS is required in production');
  process.exit(1);
}

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));
    const payload = verifyRoomToken(token);
    socket.data.peerId = payload.sub;
    socket.data.roomId = payload.roomId;
    socket.data.role = payload.role;
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  const { peerId, roomId } = socket.data;

  try {
    assertRoomId(roomId);
    registry.join(roomId, peerId, socket.id);
    socket.join(roomId);
  } catch (err) {
    socket.emit('error', { message: err.message || 'join_failed' });
    socket.disconnect(true);
    return;
  }

  socket.to(roomId).emit('peer-joined', { peerId });
  socket.emit('room-peers', registry.listPeers(roomId));

  socket.on('studio-chat', (msg) => {
    try {
      limitEvents(socket.id);
    } catch {
      return socket.emit('error', { message: 'rate_limited' });
    }
    if (!msg || typeof msg.body !== 'string' || msg.body.length > 2000) return;
    const body = msg.body.replace(/<[^>]*>/g, '').slice(0, 2000);
    const authorName =
      typeof msg.authorName === 'string' ? msg.authorName.slice(0, 120) : 'Guest';
    socket.to(roomId).emit('studio-chat', {
      authorName,
      body,
      fromPeerId: peerId,
      at: Date.now(),
    });
  });

  socket.on('studio-state', (patch) => {
    try {
      limitEvents(socket.id);
    } catch {
      return socket.emit('error', { message: 'rate_limited' });
    }
    if (!patch || typeof patch !== 'object') return;
    const role = socket.data.role;
    if (role !== 'presenter' && role !== 'moderator') return;
    const allowed = {};
    if (typeof patch.layout === 'string') allowed.layout = patch.layout.slice(0, 20);
    if (typeof patch.isLive === 'boolean') allowed.isLive = patch.isLive;
    socket.to(roomId).emit('studio-state', { ...allowed, fromPeerId: peerId });
  });

  socket.on('signal', (msg) => {
    try {
      limitEvents(socket.id);
    } catch {
      return socket.emit('error', { message: 'rate_limited' });
    }

    const { targetPeerId, payload } = msg || {};
    if (!targetPeerId || !payload) return;

    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > MAX_SIGNAL_BYTES) return;

    const targetSocketId = registry.getSocketId(roomId, targetPeerId);
    if (!targetSocketId) return;

    io.to(targetSocketId).emit('signal', {
      fromPeerId: peerId,
      payload,
    });
  });

  socket.on('disconnecting', () => {
    registry.leave(roomId, peerId);
    socket.to(roomId).emit('peer-left', { peerId });
  });
});

const host = getHost();
httpServer.listen(PORT, host, () => {
  requireEnv('JWT_SECRET', 'dev-only-change-me-before-any-shared-network-use');
  console.log(`[signaling] Socket.IO on http://${host}:${PORT}`);
});

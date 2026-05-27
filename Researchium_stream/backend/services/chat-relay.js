import { log } from '../lib/logger.js';
import { unifiedChatRepo } from './unified-chat/repository.js';

/**
 * WebSocket chat relay: fans out platform + studio messages to room subscribers.
 */
export class ChatRelayService {
  constructor(unifiedChatManager) {
    this.unifiedChatManager = unifiedChatManager;
    this.roomSubscribers = new Map();
  }

  attachSocket(socket, io) {
      socket.on('chat-relay-join', async (data) => {
        const room = data?.roomId || socket.data.roomId;
        if (!room) return;
        socket.join(`chat:${room}`);
        socket.data.chatRelayRoom = room;
        const count = (this.roomSubscribers.get(room) || 0) + 1;
        this.roomSubscribers.set(room, count);
        socket.emit('chat-relay-status', {
          roomId: room,
          subscribed: true,
          aggregator: this.unifiedChatManager.status(room),
        });
      });

      socket.on('chat-relay-leave', () => {
        const room = socket.data.chatRelayRoom;
        if (room) {
          socket.leave(`chat:${room}`);
          const count = Math.max(0, (this.roomSubscribers.get(room) || 1) - 1);
          if (count === 0) this.roomSubscribers.delete(room);
          else this.roomSubscribers.set(room, count);
          delete socket.data.chatRelayRoom;
        }
      });

      socket.on('chat-relay-send', async (data) => {
        const room = data?.roomId || socket.data.roomId;
        const body = data?.body?.trim();
        if (!room || !body) return;

        const authorName = data?.authorName || 'Host';
        const platform = data?.platform || 'studio';

        if (platform === 'studio' || !this.unifiedChatManager.status(room).running) {
          const saved = await unifiedChatRepo.saveMessage({
            roomSlug: room,
            platform: 'studio',
            authorName,
            body,
            authorId: socket.data.peerId,
          });
          this.broadcast(io, room, saved);
          return;
        }

        try {
          await this.unifiedChatManager.send(
            room,
            socket.data.peerId,
            io,
            body,
            authorName
          );
        } catch (e) {
          socket.emit('chat-relay-error', { error: e.message });
        }
      });

      socket.on('chat-relay-start', async (data) => {
        const room = data?.roomId || socket.data.roomId;
        if (!room || socket.data.role === 'viewer') return;
        try {
          const result = await this.unifiedChatManager.start(
            room,
            socket.data.peerId,
            io,
            data?.config || {}
          );
          socket.emit('chat-relay-status', { roomId: room, aggregator: result });
        } catch (e) {
          socket.emit('chat-relay-error', { error: e.message });
        }
      });

      socket.on('chat-relay-stop', async (data) => {
        const room = data?.roomId || socket.data.roomId;
        if (room) await this.unifiedChatManager.stop(room);
        socket.emit('chat-relay-status', {
          roomId: room,
          aggregator: this.unifiedChatManager.status(room),
        });
      });
  }

  register(io) {
    io.on('connection', (socket) => this.attachSocket(socket, io));
    log.info('Chat relay WebSocket handlers registered');
  }

  broadcast(io, roomSlug, message) {
    const payload = {
      id: message.id,
      roomSlug: message.roomSlug,
      platform: message.platform,
      authorName: message.authorName,
      authorId: message.authorId,
      body: message.body,
      at: message.at,
    };
    io.to(roomSlug).emit('unified-chat-message', payload);
    io.to(`chat:${roomSlug}`).emit('chat-relay-message', payload);
  }

  relayInbound(io, roomSlug, message) {
    this.broadcast(io, roomSlug, message);
  }
}

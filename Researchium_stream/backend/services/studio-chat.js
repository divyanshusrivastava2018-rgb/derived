import axios from 'axios';
import { config } from '../config.js';
import { log } from '../lib/logger.js';

/**
 * Bridges Researchium Studio UI chat with core API persistence and Socket.IO broadcast.
 * Room slug format: live-with-researchium-may26-abc123 (see services/api slugify).
 */
export class StudioChatService {
  constructor(authService) {
    this.authService = authService;
  }

  sanitizeOutgoing(msg = {}) {
    const body = String(msg.body || '')
      .replace(/<[^>]*>/g, '')
      .slice(0, 2000);
    const authorName =
      typeof msg.authorName === 'string' ? msg.authorName.slice(0, 120) : 'Guest';
    return { authorName, body };
  }

  buildEvent(socket, moderated, authorName) {
    return {
      authorName,
      body: moderated.message,
      fromPeerId: socket.data.peerId,
      at: Date.now(),
      sentiment: moderated.sentiment,
      roomSlug: socket.data.roomId,
    };
  }

  /** Real-time fan-out + optional persistence to core API. */
  async handleStudioChat(io, socket, msg) {
    const roomId = socket.data.roomId;
    if (!roomId || !msg?.body) return null;

    const { authorName, body } = this.sanitizeOutgoing(msg);
    if (!body.trim()) return null;

    const moderated = await this.authService.moderateMessage(body);
    if (!moderated.approved) {
      socket.emit('chat-rejected', {
        reason: 'moderation',
        roomSlug: roomId,
      });
      return null;
    }

    const event = this.buildEvent(socket, moderated, authorName);
    socket.to(roomId).emit('studio-chat', event);

    void this.persistMessage(socket, event, msg).catch((e) => {
      log.warn(`Chat persist skipped: ${e.message}`);
    });

    return event;
  }

  async persistMessage(socket, event, rawMsg) {
    const roomSlug = socket.data.roomId;
    const token = socket.handshake.auth?.token;

    if (rawMsg?.inviteToken) {
      await axios.post(
        `${config.apiUrl}/api/studio/room/${encodeURIComponent(roomSlug)}/chat/guest`,
        {
          inviteToken: rawMsg.inviteToken,
          authorName: event.authorName,
          body: event.body,
        },
        { timeout: 5000 }
      );
      return;
    }

    if (!token) return;

    await axios.post(
      `${config.apiUrl}/api/studio/room/${encodeURIComponent(roomSlug)}/chat`,
      {
        body: event.body,
        isPrivate: Boolean(rawMsg?.isPrivate),
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      }
    );
  }

  async listMessages(roomSlug, query = {}, authorization) {
    const params = new URLSearchParams();
    if (query.private === '1' || query.private === true) params.set('private', '1');
    if (query.private === '0' || query.private === false) params.set('private', '0');
    if (query.since) params.set('since', query.since);
    const qs = params.toString();

    const { data } = await axios.get(
      `${config.apiUrl}/api/studio/room/${encodeURIComponent(roomSlug)}/chat${qs ? `?${qs}` : ''}`,
      {
        headers: authorization ? { Authorization: authorization } : {},
        timeout: 5000,
      }
    );
    return data;
  }

  async postHostMessage(roomSlug, body, isPrivate, authorization) {
    const { data } = await axios.post(
      `${config.apiUrl}/api/studio/room/${encodeURIComponent(roomSlug)}/chat`,
      { body, isPrivate: Boolean(isPrivate) },
      {
        headers: { Authorization: authorization },
        timeout: 5000,
      }
    );
    return data;
  }
}

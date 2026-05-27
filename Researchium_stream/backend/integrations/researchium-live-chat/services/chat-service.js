import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { integrationConfig } from '../config.js';
import { repository } from '../db/repository.js';
import { ValidationError } from '../lib/errors.js';
import { withRetry } from '../lib/retry.js';

function sanitizeBody(body, max) {
  const text = String(body || '')
    .replace(/<[^>]*>/g, '')
    .trim();
  if (!text) throw new ValidationError('Message body is required');
  if (text.length > max) throw new ValidationError(`Message exceeds ${max} characters`);
  return text;
}

export class ChatService {
  constructor({ io, onBroadcast } = {}) {
    this.io = io;
    this.onBroadcast = onBroadcast;
  }

  async ensureSession({ roomSlug, title, externalSessionId, metadata }) {
    if (!roomSlug || typeof roomSlug !== 'string') {
      throw new ValidationError('roomSlug is required');
    }
    return repository.upsertSession({
      room_slug: roomSlug.slice(0, 120),
      title: title?.slice(0, 200),
      external_session_id: externalSessionId || null,
      metadata: metadata || {},
    });
  }

  async sendMessage(roomSlug, payload) {
    await this.ensureSession({ roomSlug });
    const session = await repository.requireSession(roomSlug);
    const body = sanitizeBody(payload.body, integrationConfig.messageMaxLength);

    const message = await repository.insertMessage({
      session_id: session.id,
      external_message_id: payload.externalMessageId || `out-${uuidv4()}`,
      direction: payload.direction || 'outbound',
      author_id: payload.authorId || null,
      author_name: String(payload.authorName || 'Integration').slice(0, 120),
      author_role: payload.authorRole || 'integration',
      body,
      is_private: Boolean(payload.isPrivate),
      sentiment: payload.sentiment || null,
      delivery_status: 'delivered',
      metadata: payload.metadata || {},
    });

    await this.broadcastToRoom(roomSlug, message);
    await this.syncToCoreApi(roomSlug, message, payload);

    return message;
  }

  async ingestInbound(roomSlug, payload) {
    await this.ensureSession({ roomSlug, externalSessionId: payload.externalSessionId });
    const session = await repository.requireSession(roomSlug);
    const body = sanitizeBody(payload.body, integrationConfig.messageMaxLength);

    const message = await repository.insertMessage({
      session_id: session.id,
      external_message_id: payload.externalMessageId || payload.messageId || null,
      direction: 'inbound',
      author_id: payload.authorId || null,
      author_name: String(payload.authorName || 'Researchium').slice(0, 120),
      author_role: payload.authorRole || 'viewer',
      body,
      is_private: Boolean(payload.isPrivate),
      sentiment: payload.sentiment || null,
      delivery_status: 'delivered',
      metadata: { source: 'webhook', ...(payload.metadata || {}) },
    });

    await this.broadcastToRoom(roomSlug, message);
    return message;
  }

  async receiveMessages(roomSlug, { since, limit, includePrivate = false } = {}) {
    const session = await repository.requireSession(roomSlug);
    const messages = await repository.listMessages(session.id, { since, limit });
    if (includePrivate) return { session, messages };
    return {
      session,
      messages: messages.filter((m) => !m.isPrivate),
    };
  }

  broadcastToRoom(roomSlug, message) {
    const event = {
      authorName: message.authorName,
      body: message.body,
      fromPeerId: message.authorId || message.id,
      at: new Date(message.createdAt).getTime(),
      sentiment: message.sentiment,
      roomSlug,
      messageId: message.id,
    };

    if (this.onBroadcast) {
      this.onBroadcast(roomSlug, event);
    } else if (this.io) {
      this.io.to(roomSlug).emit('studio-chat', event);
    }

    return event;
  }

  async syncToCoreApi(roomSlug, message, payload) {
    if (!integrationConfig.coreApiUrl) return;

    await withRetry(
      async () => {
        await axios.post(
          `${integrationConfig.coreApiUrl}/api/studio/room/${encodeURIComponent(roomSlug)}/chat`,
          {
            body: message.body,
            isPrivate: message.isPrivate,
          },
          {
            headers: {
              'X-API-Key': integrationConfig.apiKey,
              'Content-Type': 'application/json',
            },
            timeout: integrationConfig.outboundTimeoutMs,
            validateStatus: (s) => s < 500,
          }
        );
      },
      {
        maxAttempts: integrationConfig.outboundMaxAttempts,
        shouldRetry: (err) => !err.response || err.response.status >= 500,
      }
    ).catch(() => {
      /* core API optional when using integration store only */
    });
  }
}

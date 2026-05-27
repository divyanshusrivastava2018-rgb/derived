import { integrationConfig } from '../config.js';
import { repository } from '../db/repository.js';
import { nextRetryAt } from '../lib/retry.js';
import { ValidationError } from '../lib/errors.js';

const HANDLED_EVENTS = new Set([
  'chat.message.created',
  'chat.message.updated',
  'session.started',
  'session.ended',
  'session.updated',
  'participant.joined',
  'participant.left',
]);

export class WebhookProcessor {
  constructor(chatService) {
    this.chatService = chatService;
  }

  async ingest(event) {
    const eventId = event.id || event.event_id;
    const eventType = event.type || event.event_type;
    const payload = event.data || event.payload || event;

    if (!eventId || !eventType) {
      throw new ValidationError('Webhook must include id and type');
    }

    if (!HANDLED_EVENTS.has(eventType)) {
      return { accepted: true, skipped: true, reason: 'unsupported_event_type' };
    }

    const roomSlug = payload.room_slug || payload.roomSlug || payload.session_id;
    let sessionId = null;
    if (roomSlug) {
      const session = await this.chatService.ensureSession({
        roomSlug,
        title: payload.title,
        externalSessionId: payload.external_session_id || payload.sessionId,
        metadata: payload.metadata || {},
      });
      sessionId = session.id;
    }

    const { row, duplicate } = await repository.insertWebhookEvent({
      event_id: String(eventId),
      event_type: eventType,
      session_id: sessionId,
      payload: event,
      max_attempts: integrationConfig.webhookMaxAttempts,
    });

    if (duplicate) {
      return { accepted: true, duplicate: true, eventId };
    }

    void this.processRow(row).catch((err) => {
      console.error('[researchium-chat] webhook process error', err.message);
    });

    return { accepted: true, eventId, queued: true };
  }

  async processRow(row) {
    try {
      await this.dispatch(row);
      await repository.updateWebhookEvent(row.id, {
        status: 'processed',
        processed_at: new Date(),
        last_error: null,
      });
    } catch (err) {
      const attempt = row.attempt_count ?? 1;
      const failed = attempt >= (row.max_attempts ?? integrationConfig.webhookMaxAttempts);
      await repository.updateWebhookEvent(row.id, {
        status: failed ? 'failed' : 'pending',
        last_error: err.message?.slice(0, 500),
        next_retry_at: failed ? null : nextRetryAt(attempt, integrationConfig),
      });
      throw err;
    }
  }

  async dispatch(row) {
    const event = row.payload;
    const payload = event.data || event.payload || event;
    const roomSlug = payload.room_slug || payload.roomSlug;

    switch (row.event_type) {
      case 'chat.message.created':
        if (!roomSlug || !payload.body) return;
        await this.chatService.ingestInbound(roomSlug, {
          body: payload.body,
          authorName: payload.author_name || payload.authorName || 'Researchium',
          authorId: payload.author_id || payload.authorId,
          authorRole: payload.author_role || 'viewer',
          externalMessageId: payload.message_id || payload.id,
          isPrivate: Boolean(payload.is_private),
          metadata: { source: 'webhook' },
        });
        return;

      case 'session.started':
        if (!roomSlug) return;
        await this.chatService.ensureSession({
          roomSlug,
          status: 'live',
          externalSessionId: payload.session_id,
          metadata: payload,
        });
        return;

      case 'session.ended':
        if (!roomSlug) return;
        await repository.upsertSession({
          room_slug: roomSlug,
          status: 'ended',
        });
        return;

      case 'participant.joined':
      case 'participant.left':
      case 'session.updated':
      case 'chat.message.updated':
        return;

      default:
        return;
    }
  }

  async processPendingBatch(limit = 10) {
    const rows = await repository.claimPendingWebhooks(limit);
    const results = [];
    for (const row of rows) {
      try {
        await this.dispatch(row);
        await repository.updateWebhookEvent(row.id, {
          status: 'processed',
          processed_at: new Date(),
        });
        results.push({ id: row.id, ok: true });
      } catch (err) {
        const failed = row.attempt_count >= row.max_attempts;
        await repository.updateWebhookEvent(row.id, {
          status: failed ? 'failed' : 'pending',
          last_error: err.message,
          next_retry_at: failed ? null : nextRetryAt(row.attempt_count, integrationConfig),
        });
        results.push({ id: row.id, ok: false, error: err.message });
      }
    }
    return results;
  }
}

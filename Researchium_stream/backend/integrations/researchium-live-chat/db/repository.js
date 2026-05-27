import { v4 as uuidv4 } from 'uuid';
import { getPool, usePostgres } from './pool.js';
import { NotFoundError } from '../lib/errors.js';

/** In-memory fallback when Postgres is unavailable. */
class MemoryStore {
  constructor() {
    this.sessions = new Map();
    this.messages = new Map();
    this.webhooks = new Map();
  }

  async upsertSession(data) {
    const existing = [...this.sessions.values()].find(
      (s) => s.room_slug === data.room_slug || s.external_session_id === data.external_session_id
    );
    const row = existing
      ? { ...existing, ...data, updated_at: new Date().toISOString() }
      : {
          id: uuidv4(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'active',
          metadata: {},
          ...data,
        };
    this.sessions.set(row.id, row);
    return row;
  }

  async getSessionBySlug(roomSlug) {
    return [...this.sessions.values()].find((s) => s.room_slug === roomSlug) || null;
  }

  async getSessionById(id) {
    return this.sessions.get(id) || null;
  }

  async insertMessage(data) {
    const row = {
      id: uuidv4(),
      created_at: new Date().toISOString(),
      delivery_status: 'delivered',
      metadata: {},
      ...data,
    };
    this.messages.set(row.id, row);
    return row;
  }

  async listMessages(sessionId, { since, limit = 100 } = {}) {
    let rows = [...this.messages.values()].filter((m) => m.session_id === sessionId);
    if (since) {
      const t = new Date(since).getTime();
      rows = rows.filter((m) => new Date(m.created_at).getTime() > t);
    }
    return rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).slice(-limit);
  }

  async insertWebhookEvent(data) {
    const existing = [...this.webhooks.values()].find((e) => e.event_id === data.event_id);
    if (existing) return { row: existing, duplicate: true };
    const row = {
      id: uuidv4(),
      created_at: new Date().toISOString(),
      status: 'pending',
      attempt_count: 0,
      max_attempts: data.max_attempts ?? 5,
      ...data,
    };
    this.webhooks.set(row.id, row);
    return { row, duplicate: false };
  }

  async updateWebhookEvent(id, patch) {
    const row = this.webhooks.get(id);
    if (!row) return null;
    Object.assign(row, patch);
    this.webhooks.set(id, row);
    return row;
  }

  async claimPendingWebhooks(limit = 10) {
    const now = Date.now();
    return [...this.webhooks.values()]
      .filter(
        (e) =>
          (e.status === 'pending' || e.status === 'failed') &&
          e.attempt_count < e.max_attempts &&
          (!e.next_retry_at || new Date(e.next_retry_at).getTime() <= now)
      )
      .slice(0, limit);
  }
}

const memory = new MemoryStore();

function mapSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    roomSlug: row.room_slug,
    streamId: row.stream_id,
    externalSessionId: row.external_session_id,
    title: row.title,
    status: row.status,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    externalMessageId: row.external_message_id,
    direction: row.direction,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    body: row.body,
    isPrivate: row.is_private,
    sentiment: row.sentiment,
    deliveryStatus: row.delivery_status,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

export const repository = {
  async upsertSession(data) {
    if (!usePostgres()) return mapSession(await memory.upsertSession(data));

    const pool = getPool();
    const r = await pool.query(
      `INSERT INTO researchium_chat_sessions (room_slug, stream_id, external_session_id, title, status, metadata)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'active'), COALESCE($6::jsonb, '{}'))
       ON CONFLICT (room_slug) DO UPDATE SET
         external_session_id = COALESCE(EXCLUDED.external_session_id, researchium_chat_sessions.external_session_id),
         title = COALESCE(EXCLUDED.title, researchium_chat_sessions.title),
         status = COALESCE(EXCLUDED.status, researchium_chat_sessions.status),
         metadata = researchium_chat_sessions.metadata || EXCLUDED.metadata,
         updated_at = now()
       RETURNING *`,
      [
        data.room_slug,
        data.stream_id || null,
        data.external_session_id || null,
        data.title || null,
        data.status || null,
        JSON.stringify(data.metadata || {}),
      ]
    );
    return mapSession(r.rows[0]);
  },

  async getSessionBySlug(roomSlug) {
    if (!usePostgres()) return mapSession(await memory.getSessionBySlug(roomSlug));
    const r = await getPool().query(
      `SELECT * FROM researchium_chat_sessions WHERE room_slug = $1`,
      [roomSlug]
    );
    return mapSession(r.rows[0]);
  },

  async getSessionById(id) {
    if (!usePostgres()) return mapSession(await memory.getSessionById(id));
    const r = await getPool().query(`SELECT * FROM researchium_chat_sessions WHERE id = $1`, [id]);
    return mapSession(r.rows[0]);
  },

  async requireSession(roomSlug) {
    const session = await this.getSessionBySlug(roomSlug);
    if (!session) throw new NotFoundError('session', roomSlug);
    return session;
  },

  async insertMessage(data) {
    if (!usePostgres()) return mapMessage(await memory.insertMessage(data));

    const r = await getPool().query(
      `INSERT INTO researchium_chat_messages (
         session_id, external_message_id, direction, author_id, author_name, author_role,
         body, is_private, sentiment, delivery_status, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       ON CONFLICT (external_message_id) DO NOTHING
       RETURNING *`,
      [
        data.session_id,
        data.external_message_id || null,
        data.direction || 'outbound',
        data.author_id || null,
        data.author_name,
        data.author_role || 'viewer',
        data.body,
        Boolean(data.is_private),
        data.sentiment || null,
        data.delivery_status || 'delivered',
        JSON.stringify(data.metadata || {}),
      ]
    );
    if (!r.rows[0] && data.external_message_id) {
      const existing = await getPool().query(
        `SELECT * FROM researchium_chat_messages WHERE external_message_id = $1`,
        [data.external_message_id]
      );
      return mapMessage(existing.rows[0]);
    }
    return mapMessage(r.rows[0]);
  },

  async listMessages(sessionId, opts = {}) {
    if (!usePostgres()) {
      return (await memory.listMessages(sessionId, opts)).map(mapMessage);
    }

    const limit = Math.min(500, opts.limit || 100);
    const params = [sessionId];
    let sql = `SELECT * FROM researchium_chat_messages WHERE session_id = $1`;
    if (opts.since) {
      sql += ` AND created_at > $2`;
      params.push(opts.since);
    }
    sql += ` ORDER BY created_at ASC LIMIT $${params.length + 1}`;
    params.push(limit);
    const r = await getPool().query(sql, params);
    return r.rows.map(mapMessage);
  },

  async insertWebhookEvent(data) {
    if (!usePostgres()) return memory.insertWebhookEvent(data);

    try {
      const r = await getPool().query(
        `INSERT INTO researchium_webhook_events (event_id, event_type, session_id, payload, max_attempts)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         RETURNING *`,
        [
          data.event_id,
          data.event_type,
          data.session_id || null,
          JSON.stringify(data.payload),
          data.max_attempts ?? 5,
        ]
      );
      return { row: r.rows[0], duplicate: false };
    } catch (e) {
      if (e.code === '23505') {
        const r = await getPool().query(
          `SELECT * FROM researchium_webhook_events WHERE event_id = $1`,
          [data.event_id]
        );
        return { row: r.rows[0], duplicate: true };
      }
      throw e;
    }
  },

  async updateWebhookEvent(id, patch) {
    if (!usePostgres()) return memory.updateWebhookEvent(id, patch);

    const fields = [];
    const values = [id];
    let i = 2;
    for (const [key, val] of Object.entries(patch)) {
      fields.push(`${key} = $${i++}`);
      values.push(val);
    }
    if (!fields.length) return null;
    const r = await getPool().query(
      `UPDATE researchium_webhook_events SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    return r.rows[0];
  },

  async claimPendingWebhooks(limit = 10) {
    if (!usePostgres()) return memory.claimPendingWebhooks(limit);

    const r = await getPool().query(
      `UPDATE researchium_webhook_events e
       SET status = 'processing', attempt_count = attempt_count + 1
       WHERE e.id IN (
         SELECT id FROM researchium_webhook_events
         WHERE status IN ('pending', 'failed')
           AND attempt_count < max_attempts
           AND (next_retry_at IS NULL OR next_retry_at <= now())
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [limit]
    );
    return r.rows;
  },
};

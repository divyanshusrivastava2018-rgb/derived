import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';

const { Pool } = pg;
let pool = null;

function usePg() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!usePg()) return null;
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return pool;
}

const memMessages = new Map();
const memModLog = [];

function roomKey(roomSlug) {
  return roomSlug;
}

export const unifiedChatRepo = {
  async saveMessage(msg) {
    const row = {
      id: msg.id || uuidv4(),
      room_slug: msg.roomSlug,
      platform: msg.platform,
      external_id: msg.externalId || null,
      author_id: msg.authorId || null,
      author_name: msg.authorName,
      body: msg.body,
      is_deleted: false,
      metadata: msg.metadata || {},
      created_at: msg.at ? new Date(msg.at).toISOString() : new Date().toISOString(),
    };

    if (!usePg()) {
      if (!memMessages.has(roomKey(msg.roomSlug))) memMessages.set(roomKey(msg.roomSlug), []);
      const list = memMessages.get(roomKey(msg.roomSlug));
      if (row.external_id && list.some((m) => m.external_id === row.external_id && m.platform === row.platform)) {
        return list.find((m) => m.external_id === row.external_id && m.platform === row.platform);
      }
      list.push(row);
      if (list.length > 500) list.splice(0, list.length - 500);
      return formatRow(row);
    }

    try {
      const r = await getPool().query(
        `INSERT INTO unified_chat_messages (
           id, room_slug, platform, external_id, author_id, author_name, body, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT (room_slug, platform, external_id) DO NOTHING
         RETURNING *`,
        [
          row.id,
          row.room_slug,
          row.platform,
          row.external_id,
          row.author_id,
          row.author_name,
          row.body,
          JSON.stringify(row.metadata),
        ]
      );
      return formatRow(r.rows[0] || row);
    } catch {
      return formatRow(row);
    }
  },

  async markDeleted(messageId) {
    if (!usePg()) {
      for (const list of memMessages.values()) {
        const m = list.find((x) => x.id === messageId);
        if (m) m.is_deleted = true;
      }
      return;
    }
    await getPool().query(
      `UPDATE unified_chat_messages SET is_deleted = true WHERE id = $1`,
      [messageId]
    );
  },

  async listMessages(roomSlug, { since, platform, limit = 100 } = {}) {
    if (!usePg()) {
      let list = [...(memMessages.get(roomKey(roomSlug)) || [])].filter((m) => !m.is_deleted);
      if (since) {
        const t = new Date(since).getTime();
        list = list.filter((m) => new Date(m.created_at).getTime() > t);
      }
      if (platform) list = list.filter((m) => m.platform === platform);
      return list.slice(-limit).map(formatRow);
    }
    const params = [roomSlug];
    let sql = `SELECT * FROM unified_chat_messages WHERE room_slug = $1 AND is_deleted = false`;
    if (platform) {
      params.push(platform);
      sql += ` AND platform = $${params.length}`;
    }
    if (since) {
      params.push(since);
      sql += ` AND created_at > $${params.length}`;
    }
    params.push(limit);
    sql += ` ORDER BY created_at ASC LIMIT $${params.length}`;
    const r = await getPool().query(sql, params);
    return r.rows.map(formatRow);
  },

  async logModeration(entry) {
    const row = { id: uuidv4(), created_at: new Date().toISOString(), ...entry };
    if (!usePg()) {
      memModLog.push(row);
      return row;
    }
    await getPool().query(
      `INSERT INTO unified_chat_moderation_log (
         room_slug, moderator_id, action, target_platform, target_user_id,
         target_username, message_id, duration_sec, success, error_message
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        entry.room_slug,
        entry.moderator_id,
        entry.action,
        entry.target_platform,
        entry.target_user_id,
        entry.target_username,
        entry.message_id,
        entry.duration_sec,
        entry.success,
        entry.error_message,
      ]
    );
    return row;
  },
};

function formatRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    roomSlug: row.room_slug,
    platform: row.platform,
    externalId: row.external_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    isDeleted: row.is_deleted,
    metadata: row.metadata || {},
    at: new Date(row.created_at).getTime(),
  };
}

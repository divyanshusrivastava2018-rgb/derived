import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';
import { encryptSecret, decryptSecret } from '../../lib/crypto-vault.js';

const { Pool } = pg;
let pool = null;

function usePg() {
  return Boolean(process.env.DATABASE_URL || process.env.MULTISTREAM_DATABASE_URL);
}

function getPool() {
  if (!usePg()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.MULTISTREAM_DATABASE_URL || process.env.DATABASE_URL,
    });
  }
  return pool;
}

const mem = {
  connections: new Map(),
  broadcasts: new Map(),
  targets: new Map(),
};

function connKey(userId, platform) {
  return `${userId}:${platform}`;
}

function mapConnection(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform,
    accountId: row.account_id,
    accountName: row.account_name,
    status: row.status,
    tokenExpiresAt: row.token_expires_at,
    metadata: row.metadata || {},
    connectedAt: row.created_at,
    updatedAt: row.updated_at,
    configured: true,
  };
}

export const multistreamRepo = {
  async saveConnection(userId, platform, secrets, profile = {}) {
    const payload = {
      user_id: userId,
      platform,
      account_id: profile.accountId || null,
      account_name: profile.accountName || null,
      access_token_enc: encryptSecret(secrets.accessToken),
      refresh_token_enc: encryptSecret(secrets.refreshToken),
      stream_key_enc: encryptSecret(secrets.streamKey),
      token_expires_at: secrets.expiresAt || null,
      scopes: profile.scopes || [],
      metadata: profile.metadata || {},
      status: 'connected',
    };

    if (!usePg()) {
      const id = uuidv4();
      const row = { id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload };
      mem.connections.set(connKey(userId, platform), row);
      return mapConnection(row);
    }

    const r = await getPool().query(
      `INSERT INTO platform_connections (
         user_id, platform, account_id, account_name,
         access_token_enc, refresh_token_enc, stream_key_enc,
         token_expires_at, scopes, metadata, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,'connected')
       ON CONFLICT (user_id, platform) DO UPDATE SET
         account_id = EXCLUDED.account_id,
         account_name = EXCLUDED.account_name,
         access_token_enc = EXCLUDED.access_token_enc,
         refresh_token_enc = EXCLUDED.refresh_token_enc,
         stream_key_enc = COALESCE(EXCLUDED.stream_key_enc, platform_connections.stream_key_enc),
         token_expires_at = EXCLUDED.token_expires_at,
         scopes = EXCLUDED.scopes,
         metadata = EXCLUDED.metadata,
         status = 'connected',
         updated_at = now()
       RETURNING *`,
      [
        userId,
        platform,
        payload.account_id,
        payload.account_name,
        payload.access_token_enc,
        payload.refresh_token_enc,
        payload.stream_key_enc,
        payload.token_expires_at,
        payload.scopes,
        JSON.stringify(payload.metadata),
      ]
    );
    return mapConnection(r.rows[0]);
  },

  async getConnectionSecrets(userId, platform) {
    let row;
    if (!usePg()) {
      row = mem.connections.get(connKey(userId, platform));
    } else {
      const r = await getPool().query(
        `SELECT * FROM platform_connections WHERE user_id = $1 AND platform = $2 AND status = 'connected'`,
        [userId, platform]
      );
      row = r.rows[0];
    }
    if (!row) return null;
    return {
      connection: mapConnection(row),
      accessToken: decryptSecret(row.access_token_enc),
      refreshToken: decryptSecret(row.refresh_token_enc),
      streamKey: decryptSecret(row.stream_key_enc),
    };
  },

  async listConnections(userId) {
    if (!usePg()) {
      return [...mem.connections.values()]
        .filter((r) => r.user_id === userId)
        .map(mapConnection);
    }
    const r = await getPool().query(
      `SELECT id, user_id, platform, account_id, account_name, status, token_expires_at, metadata, created_at, updated_at
       FROM platform_connections WHERE user_id = $1 ORDER BY platform`,
      [userId]
    );
    return r.rows.map(mapConnection);
  },

  async disconnect(userId, platform) {
    if (!usePg()) {
      mem.connections.delete(connKey(userId, platform));
      return;
    }
    await getPool().query(
      `UPDATE platform_connections SET status = 'revoked', updated_at = now() WHERE user_id = $1 AND platform = $2`,
      [userId, platform]
    );
  },

  async createBroadcast(userId, { roomSlug, title, description }) {
    const id = uuidv4();
    if (!usePg()) {
      const row = {
        id,
        user_id: userId,
        room_slug: roomSlug,
        title,
        description,
        status: 'starting',
        created_at: new Date().toISOString(),
      };
      mem.broadcasts.set(id, row);
      return row;
    }
    const r = await getPool().query(
      `INSERT INTO multistream_broadcasts (id, user_id, room_slug, title, description, status)
       VALUES ($1,$2,$3,$4,$5,'starting') RETURNING *`,
      [id, userId, roomSlug || null, title, description || null]
    );
    return r.rows[0];
  },

  async addTarget(broadcastId, target) {
    const id = uuidv4();
    if (!usePg()) {
      const row = { id, broadcast_id: broadcastId, ...target, created_at: new Date().toISOString() };
      if (!mem.targets.has(broadcastId)) mem.targets.set(broadcastId, []);
      mem.targets.get(broadcastId).push(row);
      return row;
    }
    const r = await getPool().query(
      `INSERT INTO multistream_broadcast_targets (
         id, broadcast_id, platform, external_broadcast_id, rtmp_url, playback_url, status, error_message, metadata
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING *`,
      [
        id,
        broadcastId,
        target.platform,
        target.external_broadcast_id || null,
        target.rtmp_url || null,
        target.playback_url || null,
        target.status || 'pending',
        target.error_message || null,
        JSON.stringify(target.metadata || {}),
      ]
    );
    return r.rows[0];
  },

  async finalizeBroadcast(broadcastId, status) {
    if (!usePg()) {
      const b = mem.broadcasts.get(broadcastId);
      if (b) b.status = status;
      return;
    }
    await getPool().query(
      `UPDATE multistream_broadcasts SET status = $2, ended_at = CASE WHEN $2 IN ('ended','failed') THEN now() ELSE ended_at END WHERE id = $1`,
      [broadcastId, status]
    );
  },

  async getBroadcast(broadcastId) {
    if (!usePg()) {
      const b = mem.broadcasts.get(broadcastId);
      const targets = mem.targets.get(broadcastId) || [];
      return b ? { ...b, targets } : null;
    }
    const b = await getPool().query(`SELECT * FROM multistream_broadcasts WHERE id = $1`, [broadcastId]);
    const t = await getPool().query(
      `SELECT platform, external_broadcast_id, rtmp_url, playback_url, status, error_message, metadata
       FROM multistream_broadcast_targets WHERE broadcast_id = $1`,
      [broadcastId]
    );
    if (!b.rows[0]) return null;
    return { ...b.rows[0], targets: t.rows };
  },
};

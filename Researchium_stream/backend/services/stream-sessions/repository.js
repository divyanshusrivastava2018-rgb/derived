import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';

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

const memSessions = new Map();
const memSamples = new Map();

function mapSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    roomSlug: row.room_slug,
    broadcastId: row.broadcast_id,
    title: row.title,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    peakViewers: row.peak_viewers,
    peakViewersAt: row.peak_viewers_at,
    platformPeaks: row.platform_peaks || {},
    lastViewerTotal: row.last_viewer_total,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const streamSessionRepo = {
  async create({ userId, roomSlug, broadcastId, title, metadata }) {
    const row = {
      id: uuidv4(),
      user_id: userId,
      room_slug: roomSlug || null,
      broadcast_id: broadcastId || null,
      title: title || 'Untitled stream',
      status: 'live',
      started_at: new Date().toISOString(),
      ended_at: null,
      peak_viewers: 0,
      peak_viewers_at: null,
      platform_peaks: {},
      last_viewer_total: 0,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!usePg()) {
      memSessions.set(row.id, row);
      if (row.room_slug) memSessions.set(`room:${row.room_slug}`, row);
      return mapSession(row);
    }

    const r = await getPool().query(
      `INSERT INTO stream_sessions (
         id, user_id, room_slug, broadcast_id, title, status, metadata
       ) VALUES ($1,$2,$3,$4,$5,'live',$6::jsonb)
       RETURNING *`,
      [
        row.id,
        row.user_id,
        row.room_slug,
        row.broadcast_id,
        row.title,
        JSON.stringify(row.metadata),
      ]
    );
    return mapSession(r.rows[0]);
  },

  async getById(sessionId) {
    if (!usePg()) {
      return mapSession(memSessions.get(sessionId));
    }
    const r = await getPool().query(`SELECT * FROM stream_sessions WHERE id = $1`, [sessionId]);
    return mapSession(r.rows[0]);
  },

  async getActiveByRoom(roomSlug) {
    if (!usePg()) {
      return mapSession(memSessions.get(`room:${roomSlug}`));
    }
    const r = await getPool().query(
      `SELECT * FROM stream_sessions
       WHERE room_slug = $1 AND status = 'live'
       ORDER BY started_at DESC LIMIT 1`,
      [roomSlug]
    );
    return mapSession(r.rows[0]);
  },

  async listByUser(userId, { limit = 20, status } = {}) {
    if (!usePg()) {
      let list = [...memSessions.values()].filter(
        (s) => typeof s === 'object' && s.user_id === userId && !String(s.id).startsWith('room:')
      );
      if (status) list = list.filter((s) => s.status === status);
      return list
        .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
        .slice(0, limit)
        .map(mapSession);
    }

    const params = [userId, limit];
    let sql = `SELECT * FROM stream_sessions WHERE user_id = $1`;
    if (status) {
      sql += ` AND status = $3`;
      params.push(status);
    }
    sql += ` ORDER BY started_at DESC LIMIT $2`;
    const r = await getPool().query(sql, params);
    return r.rows.map(mapSession);
  },

  async end(sessionId, status = 'ended') {
    const endedAt = new Date().toISOString();
    if (!usePg()) {
      const row = memSessions.get(sessionId);
      if (!row) return null;
      row.status = status;
      row.ended_at = endedAt;
      row.updated_at = endedAt;
      if (row.room_slug) memSessions.delete(`room:${row.room_slug}`);
      return mapSession(row);
    }

    const r = await getPool().query(
      `UPDATE stream_sessions
       SET status = $2, ended_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [sessionId, status]
    );
    return mapSession(r.rows[0]);
  },

  async recordViewers(sessionId, { totalViewers, breakdown }) {
    const peaks = {};
    for (const [platform, data] of Object.entries(breakdown || {})) {
      peaks[platform] = data?.viewers ?? 0;
    }

    if (!usePg()) {
      const row = memSessions.get(sessionId);
      if (!row) return null;
      row.last_viewer_total = totalViewers;
      row.updated_at = new Date().toISOString();
      const platformPeaks = { ...(row.platform_peaks || {}) };
      let updatedPeak = false;
      for (const [p, n] of Object.entries(peaks)) {
        if (n > (platformPeaks[p] || 0)) platformPeaks[p] = n;
      }
      row.platform_peaks = platformPeaks;
      if (totalViewers > row.peak_viewers) {
        row.peak_viewers = totalViewers;
        row.peak_viewers_at = row.updated_at;
        updatedPeak = true;
      }
      if (!memSamples.has(sessionId)) memSamples.set(sessionId, []);
      const samples = memSamples.get(sessionId);
      samples.push({
        total_viewers: totalViewers,
        breakdown,
        recorded_at: row.updated_at,
      });
      if (samples.length > 120) samples.splice(0, samples.length - 120);
      return { session: mapSession(row), peakUpdated: updatedPeak };
    }

    const current = await getPool().query(`SELECT platform_peaks, peak_viewers FROM stream_sessions WHERE id = $1`, [
      sessionId,
    ]);
    const existingPeaks = current.rows[0]?.platform_peaks || {};
    const mergedPeaks = { ...existingPeaks };
    for (const [p, n] of Object.entries(peaks)) {
      mergedPeaks[p] = Math.max(Number(mergedPeaks[p] || 0), n);
    }
    const prevPeak = current.rows[0]?.peak_viewers || 0;

    const r = await getPool().query(
      `UPDATE stream_sessions SET
         last_viewer_total = $2,
         platform_peaks = $3::jsonb,
         peak_viewers = GREATEST(peak_viewers, $2),
         peak_viewers_at = CASE WHEN $2 > $4 THEN now() ELSE peak_viewers_at END,
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [sessionId, totalViewers, JSON.stringify(mergedPeaks), prevPeak]
    );

    await getPool().query(
      `INSERT INTO stream_session_viewer_samples (session_id, total_viewers, breakdown)
       VALUES ($1, $2, $3::jsonb)`,
      [sessionId, totalViewers, JSON.stringify(breakdown || {})]
    );

    return { session: mapSession(r.rows[0]), peakUpdated: totalViewers >= (r.rows[0]?.peak_viewers || 0) };
  },

  async listSamples(sessionId, limit = 60) {
    if (!usePg()) {
      return (memSamples.get(sessionId) || []).slice(-limit);
    }
    const r = await getPool().query(
      `SELECT total_viewers, breakdown, recorded_at
       FROM stream_session_viewer_samples
       WHERE session_id = $1
       ORDER BY recorded_at DESC
       LIMIT $2`,
      [sessionId, limit]
    );
    return r.rows.reverse();
  },
};

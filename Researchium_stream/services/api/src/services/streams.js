import bcrypt from 'bcrypt';
import { pool } from '../db/pool.js';
import { assertUuid, assertRoomId, sanitizeShortText } from '../../../shared/validate.js';

const STREAM_STATUSES = ['scheduled', 'live', 'ended', 'recorded'];

export async function listStreams({ status, limit = 20, offset = 0 }) {
  if (status && !STREAM_STATUSES.includes(status)) {
    const err = new Error('invalid_status');
    err.status = 400;
    throw err;
  }
  const params = status ? [status, limit, offset] : [limit, offset];
  const where = status ? 'WHERE s.status = $1' : '';
  const limitClause = status ? 'LIMIT $2 OFFSET $3' : 'LIMIT $1 OFFSET $2';
  const { rows } = await pool.query(
    `SELECT s.id, s.title, s.topic, s.status, s.room_slug, s.is_gated, s.created_at,
            r.name AS host_name, r.orcid, r.institution
     FROM streams s
     JOIN researchers r ON r.id = s.host_id
     ${where}
     ORDER BY s.created_at DESC
     ${limitClause}`,
    params
  );
  return rows;
}

export async function getStreamById(id) {
  assertUuid(id, 'stream id');
  const { rows } = await pool.query(
    `SELECT s.id, s.title, s.topic, s.status, s.room_slug, s.is_gated, s.created_at, s.updated_at,
            r.id AS host_id, r.name AS host_name, r.orcid, r.institution
     FROM streams s
     JOIN researchers r ON r.id = s.host_id
     WHERE s.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function getStreamByRoomSlug(roomSlug) {
  assertRoomId(roomSlug);
  const { rows } = await pool.query(
    `SELECT s.id, s.title, s.topic, s.status, s.room_slug, s.is_gated,
            s.gate_password_hash, r.name AS host_name
     FROM streams s
     JOIN researchers r ON r.id = s.host_id
     WHERE s.room_slug = $1`,
    [roomSlug]
  );
  return rows[0] || null;
}

export async function getStreamGraph(streamId) {
  const { rows } = await pool.query(
    `SELECT from_id, to_id, rel FROM stream_edges WHERE from_id = $1`,
    [streamId]
  );
  return rows;
}

export async function createStream({
  hostId,
  title,
  topic,
  roomSlug,
  status = 'scheduled',
  isGated = false,
  gatePassword,
}) {
  assertUuid(hostId, 'host id');
  assertRoomId(roomSlug);
  if (!STREAM_STATUSES.includes(status)) {
    const err = new Error('invalid_status');
    err.status = 400;
    throw err;
  }

  let gatePasswordHash = null;
  if (isGated) {
    if (!gatePassword || String(gatePassword).length < 8) {
      const err = new Error('gate_password_required');
      err.status = 400;
      throw err;
    }
    gatePasswordHash = await bcrypt.hash(String(gatePassword), 12);
  }

  const { rows } = await pool.query(
    `INSERT INTO streams (host_id, title, topic, status, room_slug, is_gated, gate_password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, title, topic, status, room_slug, is_gated, created_at`,
    [
      hostId,
      sanitizeShortText(title, 300),
      topic ? sanitizeShortText(topic, 120) : null,
      status,
      roomSlug,
      isGated,
      gatePasswordHash,
    ]
  );
  return rows[0];
}

export async function updateStreamStatus(id, status) {
  assertUuid(id, 'stream id');
  if (!STREAM_STATUSES.includes(status)) {
    const err = new Error('invalid_status');
    err.status = 400;
    throw err;
  }
  const { rows } = await pool.query(
    `UPDATE streams SET status = $2, updated_at = now() WHERE id = $1
     RETURNING id, title, status, room_slug, updated_at`,
    [id, status]
  );
  return rows[0] || null;
}

export async function getStreamGateById(id) {
  assertUuid(id, 'stream id');
  const { rows } = await pool.query(
    `SELECT id, is_gated, gate_password_hash, room_slug FROM streams WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function verifyGatePassword(stream, password) {
  if (!stream?.is_gated || !stream.gate_password_hash) {
    const err = new Error('not_gated');
    err.status = 400;
    throw err;
  }
  const ok = await bcrypt.compare(String(password), stream.gate_password_hash);
  if (!ok) {
    const err = new Error('invalid_gate_password');
    err.status = 401;
    throw err;
  }
  return true;
}

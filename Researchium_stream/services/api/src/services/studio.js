import crypto from 'crypto';
import { pool } from '../db/pool.js';
import * as devAuth from '../dev-auth.js';
import * as devStudio from './studio-dev.js';
import * as streams from './streams.js';
import {
  assertRoomId,
  assertUuid,
  sanitizeShortText,
  sanitizeChatBody,
} from '../../../shared/validate.js';

const LAYOUTS = ['solo', 'side', 'pip', 'grid', 'present'];
const QUALITIES = ['480p', '720p', '1080p'];

async function useDb(fn, devFn) {
  if (devAuth.devAuthEnabled() && !(await devAuth.isDatabaseAvailable())) {
    return devFn();
  }
  try {
    return await fn();
  } catch (e) {
    if (devAuth.devAuthEnabled() && devAuth.isDbConnectionError(e)) {
      devAuth.markDatabaseUnavailable();
      return devFn();
    }
    throw e;
  }
}

export async function getStreamByRoom(roomSlug) {
  assertRoomId(roomSlug);
  return useDb(
    async () => {
      const { rows } = await pool.query(
        `SELECT s.*, r.id AS host_id, r.name AS host_name
         FROM streams s
         JOIN researchers r ON r.id = s.host_id
         WHERE s.room_slug = $1`,
        [roomSlug]
      );
      return rows[0] || null;
    },
    () => devStudio.getDevRoom(roomSlug)?.stream || null
  );
}

export async function assertHost(roomSlug, researcherId) {
  const stream = await getStreamByRoom(roomSlug);
  if (!stream) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  if (stream.host_id !== researcherId) {
    const err = new Error('forbidden');
    err.status = 403;
    throw err;
  }
  return stream;
}

async function seedDefaultScenes(streamId) {
  const defaults = [
    { name: 'Welcome', slug: 'welcome', sort_order: 0 },
    { name: 'Demo', slug: 'demo', sort_order: 1 },
  ];
  const ids = [];
  for (const d of defaults) {
    const { rows } = await pool.query(
      `INSERT INTO studio_scenes (stream_id, name, slug, layout_type, sort_order)
       VALUES ($1, $2, $3, 'side', $4)
       RETURNING id`,
      [streamId, d.name, d.slug, d.sort_order]
    );
    ids.push(rows[0].id);
  }
  await pool.query(
    `INSERT INTO studio_sessions (stream_id, active_scene_id)
     VALUES ($1, $2)
     ON CONFLICT (stream_id) DO UPDATE SET active_scene_id = EXCLUDED.active_scene_id`,
    [streamId, ids[0]]
  );
  await pool.query(
    `INSERT INTO studio_notes (stream_id, content) VALUES ($1, '')
     ON CONFLICT (stream_id) DO NOTHING`,
    [streamId]
  );
  await pool.query(
    `INSERT INTO studio_messages (stream_id, author_name, author_role, body, is_private)
     VALUES ($1, 'Researchium', 'system', $2, false)`,
    [
      streamId,
      'Studio is ready. Configure your scenes and go live when you are set.',
    ]
  );
  return ids[0];
}

export async function bootstrapStudio(stream) {
  return useDb(
    async () => {
      const existing = await getRoomState(stream.room_slug);
      if (existing) return existing;
      await seedDefaultScenes(stream.id);
      return getRoomState(stream.room_slug);
    },
    () => devStudio.bootstrapDevRoom(stream)
  );
}

export async function getRoomState(roomSlug) {
  assertRoomId(roomSlug);
  return useDb(
    async () => {
      const stream = await getStreamByRoom(roomSlug);
      if (!stream) return null;

      const { rows: sessRows } = await pool.query(
        `SELECT * FROM studio_sessions WHERE stream_id = $1`,
        [stream.id]
      );
      let session = sessRows[0];
      if (!session) {
        await seedDefaultScenes(stream.id);
        const { rows } = await pool.query(
          `SELECT * FROM studio_sessions WHERE stream_id = $1`,
          [stream.id]
        );
        session = rows[0];
      }

      const { rows: scenes } = await pool.query(
        `SELECT * FROM studio_scenes WHERE stream_id = $1 ORDER BY sort_order`,
        [stream.id]
      );
      const { rows: messages } = await pool.query(
        `SELECT * FROM studio_messages WHERE stream_id = $1 ORDER BY created_at ASC LIMIT 200`,
        [stream.id]
      );
      const { rows: guests } = await pool.query(
        `SELECT id, stream_id, invite_token, display_name, status, joined_at, created_at
         FROM studio_guests WHERE stream_id = $1 ORDER BY created_at`,
        [stream.id]
      );
      const { rows: noteRows } = await pool.query(
        `SELECT * FROM studio_notes WHERE stream_id = $1`,
        [stream.id]
      );
      const { rows: sources } = await pool.query(
        `SELECT * FROM studio_sources WHERE stream_id = $1 ORDER BY created_at`,
        [stream.id]
      );

      const activeId = session?.active_scene_id;
      return {
        stream,
        session,
        scenes: scenes.map((s) => ({ ...s, is_active: s.id === activeId })),
        messages,
        guests,
        notes: noteRows[0] || { stream_id: stream.id, content: '' },
        sources,
        isLive: stream.status === 'live',
      };
    },
    () => devStudio.getDevRoomState(roomSlug)
  );
}

export async function updateSession(roomSlug, researcherId, patch) {
  await assertHost(roomSlug, researcherId);
  const layout = patch.layout && LAYOUTS.includes(patch.layout) ? patch.layout : undefined;
  const quality =
    patch.streamQuality && QUALITIES.includes(patch.streamQuality) ? patch.streamQuality : undefined;

  return useDb(
    async () => {
      const stream = await getStreamByRoom(roomSlug);
      const { rows } = await pool.query(
        `UPDATE studio_sessions SET
           layout = COALESCE($2, layout),
           recording_enabled = COALESCE($3, recording_enabled),
           stream_quality = COALESCE($4, stream_quality),
           active_scene_id = COALESCE($5, active_scene_id),
           scheduled_at = COALESCE($6, scheduled_at),
           updated_at = now()
         WHERE stream_id = $1
         RETURNING *`,
        [
          stream.id,
          layout,
          patch.recordingEnabled,
          quality,
          patch.activeSceneId,
          patch.scheduledAt,
        ]
      );
      return rows[0];
    },
    () => {
      devStudio.updateDevSession(roomSlug, {
        layout: layout || undefined,
        recording_enabled: patch.recordingEnabled,
        stream_quality: quality,
        active_scene_id: patch.activeSceneId,
        scheduled_at: patch.scheduledAt,
      });
      return devStudio.getDevRoom(roomSlug).session;
    }
  );
}

export async function setLive(roomSlug, researcherId, live) {
  const stream = await assertHost(roomSlug, researcherId);
  return useDb(
    async () => {
      await streams.updateStreamStatus(stream.id, live ? 'live' : 'scheduled');
      await pool.query(
        `UPDATE studio_sessions SET
           live_started_at = CASE WHEN $2 THEN COALESCE(live_started_at, now()) ELSE NULL END,
           updated_at = now()
         WHERE stream_id = $1`,
        [stream.id, live]
      );
      if (live) {
        await pool.query(
          `INSERT INTO studio_messages (stream_id, author_name, author_role, body, is_private)
           VALUES ($1, 'Researchium', 'system', 'You are now live.', false)`,
          [stream.id]
        );
      }
      return getRoomState(roomSlug);
    },
    () => {
      devStudio.setDevLive(roomSlug, live);
      return devStudio.getDevRoomState(roomSlug);
    }
  );
}

export async function listScenes(roomSlug) {
  const state = await getRoomState(roomSlug);
  return state?.scenes || [];
}

export async function createScene(roomSlug, researcherId, { name, layout_type }) {
  await assertHost(roomSlug, researcherId);
  const cleanName = sanitizeShortText(name, 80);
  if (!cleanName) {
    const err = new Error('name_required');
    err.status = 400;
    throw err;
  }
  const slug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40);

  return useDb(
    async () => {
      const stream = await getStreamByRoom(roomSlug);
      const { rows } = await pool.query(
        `INSERT INTO studio_scenes (stream_id, name, slug, layout_type, sort_order)
         VALUES (
           $1, $2, $3, $4,
           (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM studio_scenes WHERE stream_id = $1)
         )
         RETURNING *`,
        [stream.id, cleanName, slug, layout_type || 'side']
      );
      return rows[0];
    },
    () => devStudio.addDevScene(roomSlug, { name: cleanName, layout_type })
  );
}

export async function patchScene(roomSlug, researcherId, sceneId, patch) {
  assertUuid(sceneId, 'scene id');
  await assertHost(roomSlug, researcherId);
  return useDb(
    async () => {
      const stream = await getStreamByRoom(roomSlug);
      if (patch.active) {
        await pool.query(
          `UPDATE studio_sessions SET active_scene_id = $2, updated_at = now() WHERE stream_id = $1`,
          [stream.id, sceneId]
        );
      }
      const { rows } = await pool.query(
        `UPDATE studio_scenes SET
           name = COALESCE($3, name),
           layout_type = COALESCE($4, layout_type)
         WHERE id = $2 AND stream_id = $1
         RETURNING *`,
        [
          stream.id,
          sceneId,
          patch.name ? sanitizeShortText(patch.name, 80) : null,
          patch.layout_type,
        ]
      );
      if (!rows[0]) {
        const err = new Error('not_found');
        err.status = 404;
        throw err;
      }
      return rows[0];
    },
    () => devStudio.patchDevScene(roomSlug, sceneId, patch)
  );
}

export async function deleteScene(roomSlug, researcherId, sceneId) {
  assertUuid(sceneId, 'scene id');
  await assertHost(roomSlug, researcherId);
  return useDb(
    async () => {
      const stream = await getStreamByRoom(roomSlug);
      const { rowCount } = await pool.query(
        `DELETE FROM studio_scenes WHERE id = $2 AND stream_id = $1`,
        [stream.id, sceneId]
      );
      if (!rowCount) {
        const err = new Error('not_found');
        err.status = 404;
        throw err;
      }
      const { rows: remaining } = await pool.query(
        `SELECT id FROM studio_scenes WHERE stream_id = $1`,
        [stream.id]
      );
      if (!remaining.length) {
        const err = new Error('last_scene');
        err.status = 400;
        throw err;
      }
      const { rows: sess } = await pool.query(
        `SELECT active_scene_id FROM studio_sessions WHERE stream_id = $1`,
        [stream.id]
      );
      if (sess[0]?.active_scene_id === sceneId) {
        await pool.query(
          `UPDATE studio_sessions SET active_scene_id = $2 WHERE stream_id = $1`,
          [stream.id, remaining[0].id]
        );
      }
      return true;
    },
    () => devStudio.deleteDevScene(roomSlug, sceneId)
  );
}

export async function listMessages(roomSlug, { isPrivate, since } = {}) {
  return useDb(
    async () => {
      const stream = await getStreamByRoom(roomSlug);
      if (!stream) return [];
      const params = [stream.id];
      let sql = `SELECT * FROM studio_messages WHERE stream_id = $1`;
      if (isPrivate !== undefined) {
        params.push(isPrivate);
        sql += ` AND is_private = $${params.length}`;
      }
      if (since) {
        params.push(since);
        sql += ` AND created_at > $${params.length}`;
      }
      sql += ` ORDER BY created_at ASC LIMIT 200`;
      const { rows } = await pool.query(sql, params);
      return rows;
    },
    () => {
      const state = devStudio.getDevRoomState(roomSlug);
      if (!state) return [];
      let msgs = state.messages;
      if (isPrivate !== undefined) msgs = msgs.filter((m) => m.is_private === isPrivate);
      if (since) msgs = msgs.filter((m) => m.created_at > since);
      return msgs;
    }
  );
}

export async function verifyJoinedGuest(roomSlug, inviteToken) {
  if (!inviteToken || typeof inviteToken !== 'string' || inviteToken.length < 16) {
    const err = new Error('invalid_invite');
    err.status = 401;
    throw err;
  }
  return useDb(
    async () => {
      const stream = await getStreamByRoom(roomSlug);
      if (!stream) {
        const err = new Error('not_found');
        err.status = 404;
        throw err;
      }
      const { rows } = await pool.query(
        `SELECT id, display_name, status FROM studio_guests
         WHERE stream_id = $1 AND invite_token = $2 AND status = 'joined'`,
        [stream.id, inviteToken]
      );
      if (!rows[0]) {
        const err = new Error('invalid_invite');
        err.status = 401;
        throw err;
      }
      return rows[0];
    },
    () => {
      const room = devStudio.getDevRoom(roomSlug);
      const guest = room?.guests.find(
        (g) => g.invite_token === inviteToken && g.status === 'joined'
      );
      if (!guest) {
        const err = new Error('invalid_invite');
        err.status = 401;
        throw err;
      }
      return guest;
    }
  );
}

export async function postMessage(roomSlug, { author_name, author_role, body, is_private }, researcherId) {
  const cleanBody = sanitizeChatBody(body, 2000);
  if (!cleanBody) {
    const err = new Error('body_required');
    err.status = 400;
    throw err;
  }
  const name = sanitizeShortText(author_name, 120);
  if (researcherId) await assertHost(roomSlug, researcherId);

  return useDb(
    async () => {
      const stream = await getStreamByRoom(roomSlug);
      if (!stream) {
        const err = new Error('not_found');
        err.status = 404;
        throw err;
      }
      const { rows } = await pool.query(
        `INSERT INTO studio_messages (stream_id, author_name, author_role, body, is_private)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [stream.id, name, author_role || 'host', cleanBody, Boolean(is_private)]
      );
      return rows[0];
    },
    () => devStudio.addDevMessage(roomSlug, { author_name: name, author_role, body: cleanBody, is_private })
  );
}

export async function createGuestInvite(roomSlug, researcherId) {
  await assertHost(roomSlug, researcherId);
  const token = crypto.randomBytes(16).toString('hex');
  return useDb(
    async () => {
      const stream = await getStreamByRoom(roomSlug);
      const { rows } = await pool.query(
        `INSERT INTO studio_guests (stream_id, invite_token)
         VALUES ($1, $2)
         RETURNING *`,
        [stream.id, token]
      );
      return rows[0];
    },
    () => devStudio.createDevGuestInvite(roomSlug)
  );
}

export async function joinAsGuest(roomSlug, { invite_token, display_name }) {
  const name = sanitizeShortText(display_name, 120);
  if (!name || !invite_token) {
    const err = new Error('token_name_required');
    err.status = 400;
    throw err;
  }
  return useDb(
    async () => {
      const stream = await getStreamByRoom(roomSlug);
      const { rows } = await pool.query(
        `UPDATE studio_guests SET display_name = $3, status = 'joined', joined_at = now()
         WHERE stream_id = $1 AND invite_token = $2
         RETURNING *`,
        [stream.id, invite_token, name]
      );
      if (!rows[0]) {
        const err = new Error('invalid_invite');
        err.status = 404;
        throw err;
      }
      await pool.query(
        `INSERT INTO studio_messages (stream_id, author_name, author_role, body, is_private)
         VALUES ($1, $2, 'guest', 'joined the studio.', false)`,
        [stream.id, name]
      );
      return rows[0];
    },
    () => devStudio.joinDevGuest(roomSlug, { invite_token, display_name: name })
  );
}

export async function getNotes(roomSlug, researcherId) {
  await assertHost(roomSlug, researcherId);
  return useDb(
    async () => {
      const stream = await getStreamByRoom(roomSlug);
      const { rows } = await pool.query(
        `SELECT * FROM studio_notes WHERE stream_id = $1`,
        [stream.id]
      );
      return rows[0] || { stream_id: stream.id, content: '' };
    },
    () => devStudio.getDevRoom(roomSlug)?.notes
  );
}

export async function saveNotes(roomSlug, researcherId, content) {
  await assertHost(roomSlug, researcherId);
  const clean = sanitizeShortText(content, 50_000);
  return useDb(
    async () => {
      const stream = await getStreamByRoom(roomSlug);
      const { rows } = await pool.query(
        `INSERT INTO studio_notes (stream_id, content, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (stream_id) DO UPDATE SET content = EXCLUDED.content, updated_at = now()
         RETURNING *`,
        [stream.id, clean]
      );
      return rows[0];
    },
    () => devStudio.saveDevNotes(roomSlug, clean)
  );
}

export async function addSource(roomSlug, researcherId, { kind, label, config }) {
  await assertHost(roomSlug, researcherId);
  const cleanLabel = sanitizeShortText(label, 120);
  const allowed = ['camera', 'screen', 'media', 'guest'];
  if (!allowed.includes(kind)) {
    const err = new Error('invalid_kind');
    err.status = 400;
    throw err;
  }
  return useDb(
    async () => {
      const stream = await getStreamByRoom(roomSlug);
      const { rows } = await pool.query(
        `INSERT INTO studio_sources (stream_id, kind, label, config)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [stream.id, kind, cleanLabel || kind, JSON.stringify(config || {})]
      );
      return rows[0];
    },
    () => devStudio.addDevSource(roomSlug, { kind, label: cleanLabel, config })
  );
}

export function formatPublicState(
  state,
  { includeInviteTokens = false, publicOnly = false } = {}
) {
  if (!state) return null;
  const guests = state.guests.map((g) => {
    const row = {
      id: g.id,
      displayName: g.display_name,
      status: g.status,
      joinedAt: g.joined_at,
    };
    if (includeInviteTokens && !publicOnly) row.inviteToken = g.invite_token;
    return row;
  });
  const messages = (publicOnly
    ? state.messages.filter((m) => !m.is_private)
    : state.messages
  ).map((m) => ({
    id: m.id,
    authorName: m.author_name,
    authorRole: m.author_role,
    body: m.body,
    isPrivate: m.is_private,
    createdAt: m.created_at,
  }));
  const payload = {
    stream: {
      id: state.stream.id,
      title: state.stream.title,
      topic: state.stream.topic,
      status: state.stream.status,
      roomSlug: state.stream.room_slug,
      hostName: state.stream.host_name,
    },
    session: {
      layout: state.session?.layout,
      recordingEnabled: state.session?.recording_enabled,
      streamQuality: state.session?.stream_quality,
      activeSceneId: state.session?.active_scene_id,
      scheduledAt: state.session?.scheduled_at,
      liveStartedAt: state.session?.live_started_at,
    },
    scenes: state.scenes.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      layoutType: s.layout_type,
      sortOrder: s.sort_order,
      isActive: s.is_active,
    })),
    messages,
    guests: publicOnly
      ? guests.map(({ inviteToken, ...rest }) => rest)
      : guests,
    isLive: state.isLive,
  };
  if (!publicOnly) {
    payload.notes = state.notes?.content ?? '';
    payload.sources = state.sources.map((s) => ({
      id: s.id,
      kind: s.kind,
      label: s.label,
      config: s.config,
    }));
  }
  return payload;
}

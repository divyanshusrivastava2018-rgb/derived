import crypto from 'crypto';

/** In-memory studio state when Postgres is unavailable (development only). */
const rooms = new Map();

const DEFAULT_SCENES = [
  { name: 'Welcome', slug: 'welcome', layout_type: 'side', sort_order: 0 },
  { name: 'Demo', slug: 'demo', layout_type: 'side', sort_order: 1 },
];

function sceneId() {
  return crypto.randomUUID();
}

function guestToken() {
  return crypto.randomBytes(16).toString('hex');
}

function mapScene(s, streamId, activeId) {
  return {
    id: s.id,
    stream_id: streamId,
    name: s.name,
    slug: s.slug,
    layout_type: s.layout_type,
    sort_order: s.sort_order,
    config: s.config || {},
    created_at: s.created_at,
    is_active: s.id === activeId,
  };
}

export function bootstrapDevRoom(stream) {
  const streamId = stream.id;
  const scenes = DEFAULT_SCENES.map((d, i) => ({
    id: sceneId(),
    ...d,
    config: {},
    created_at: new Date().toISOString(),
  }));
  const session = {
    stream_id: streamId,
    layout: 'side',
    recording_enabled: false,
    stream_quality: '720p',
    active_scene_id: scenes[0].id,
    scheduled_at: null,
    live_started_at: null,
    updated_at: new Date().toISOString(),
  };
  rooms.set(stream.room_slug, {
    stream,
    session,
    scenes,
    messages: [
      {
        id: crypto.randomUUID(),
        stream_id: streamId,
        author_name: 'Researchium',
        author_role: 'system',
        body: 'Studio is ready. Configure your scenes and go live when you are set.',
        is_private: false,
        created_at: new Date().toISOString(),
      },
    ],
    guests: [],
    notes: { stream_id: streamId, content: '', updated_at: new Date().toISOString() },
    sources: [],
  });
  return getDevRoomState(stream.room_slug);
}

export function getDevRoom(roomSlug) {
  return rooms.get(roomSlug);
}

export function getDevRoomState(roomSlug) {
  const room = rooms.get(roomSlug);
  if (!room) return null;
  const { stream, session, scenes, messages, guests, notes, sources } = room;
  const activeId = session.active_scene_id;
  return {
    stream,
    session,
    scenes: scenes.map((s) => mapScene(s, stream.id, activeId)),
    messages: [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    guests,
    notes,
    sources,
    isLive: stream.status === 'live',
  };
}

export function updateDevSession(roomSlug, patch) {
  const room = rooms.get(roomSlug);
  if (!room) return null;
  Object.assign(room.session, patch, { updated_at: new Date().toISOString() });
  return room.session;
}

export function setDevLive(roomSlug, live) {
  const room = rooms.get(roomSlug);
  if (!room) return null;
  room.stream.status = live ? 'live' : 'scheduled';
  room.session.live_started_at = live ? new Date().toISOString() : null;
  room.session.updated_at = new Date().toISOString();
  if (live) {
    room.messages.push({
      id: crypto.randomUUID(),
      stream_id: room.stream.id,
      author_name: 'Researchium',
      author_role: 'system',
      body: 'You are now live.',
      is_private: false,
      created_at: new Date().toISOString(),
    });
  }
  return room.stream;
}

export function addDevScene(roomSlug, { name, layout_type }) {
  const room = rooms.get(roomSlug);
  if (!room) return null;
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const scene = {
    id: sceneId(),
    name,
    slug: slug || 'scene',
    layout_type: layout_type || room.session.layout,
    sort_order: room.scenes.length,
    config: {},
    created_at: new Date().toISOString(),
  };
  room.scenes.push(scene);
  return mapScene(scene, room.stream.id, room.session.active_scene_id);
}

export function patchDevScene(roomSlug, sceneId, patch) {
  const room = rooms.get(roomSlug);
  if (!room) return null;
  const scene = room.scenes.find((s) => s.id === sceneId);
  if (!scene) return null;
  if (patch.name) scene.name = patch.name;
  if (patch.layout_type) scene.layout_type = patch.layout_type;
  if (patch.active) room.session.active_scene_id = sceneId;
  return mapScene(scene, room.stream.id, room.session.active_scene_id);
}

export function deleteDevScene(roomSlug, sceneId) {
  const room = rooms.get(roomSlug);
  if (!room) return false;
  if (room.scenes.length <= 1) {
    const err = new Error('last_scene');
    err.status = 400;
    throw err;
  }
  const idx = room.scenes.findIndex((s) => s.id === sceneId);
  if (idx < 0) return false;
  room.scenes.splice(idx, 1);
  if (room.session.active_scene_id === sceneId) {
    room.session.active_scene_id = room.scenes[0].id;
  }
  return true;
}

export function addDevMessage(roomSlug, { author_name, author_role, body, is_private }) {
  const room = rooms.get(roomSlug);
  if (!room) return null;
  const msg = {
    id: crypto.randomUUID(),
    stream_id: room.stream.id,
    author_name,
    author_role: author_role || 'host',
    body,
    is_private: Boolean(is_private),
    created_at: new Date().toISOString(),
  };
  room.messages.push(msg);
  return msg;
}

export function createDevGuestInvite(roomSlug) {
  const room = rooms.get(roomSlug);
  if (!room) return null;
  const guest = {
    id: crypto.randomUUID(),
    stream_id: room.stream.id,
    invite_token: guestToken(),
    display_name: null,
    status: 'invited',
    joined_at: null,
    created_at: new Date().toISOString(),
  };
  room.guests.push(guest);
  return guest;
}

export function joinDevGuest(roomSlug, { invite_token, display_name }) {
  const room = rooms.get(roomSlug);
  if (!room) return null;
  const guest = room.guests.find((g) => g.invite_token === invite_token);
  if (!guest) {
    const err = new Error('invalid_invite');
    err.status = 404;
    throw err;
  }
  guest.display_name = display_name;
  guest.status = 'joined';
  guest.joined_at = new Date().toISOString();
  room.messages.push({
    id: crypto.randomUUID(),
    stream_id: room.stream.id,
    author_name: display_name,
    author_role: 'guest',
    body: 'joined the studio.',
    is_private: false,
    created_at: new Date().toISOString(),
  });
  return guest;
}

export function saveDevNotes(roomSlug, content) {
  const room = rooms.get(roomSlug);
  if (!room) return null;
  room.notes.content = content;
  room.notes.updated_at = new Date().toISOString();
  return room.notes;
}

export function addDevSource(roomSlug, { kind, label, config }) {
  const room = rooms.get(roomSlug);
  if (!room) return null;
  const source = {
    id: crypto.randomUUID(),
    stream_id: room.stream.id,
    kind,
    label,
    config: config || {},
    created_at: new Date().toISOString(),
  };
  room.sources.push(source);
  return source;
}

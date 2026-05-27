import { createPeerId, signRoomToken } from '../../../shared/auth.js';
import { formatPublicState } from '../services/studio.js';

export function slugifyTitle(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base || 'stream'}-${Date.now().toString(36)}`;
}

export function signalingPayload(roomSlug, role = 'presenter') {
  const peerId = createPeerId();
  const signalingToken = signRoomToken({ peerId, roomId: roomSlug, role });
  const signalingUrl =
    process.env.SIGNALING_PUBLIC_URL ||
    `http://${process.env.PUBLIC_HOST || '127.0.0.1'}:${process.env.SIGNALING_PORT || 4001}`;
  return { peerId, signalingToken, signalingUrl };
}

export function formatStreamRow(row) {
  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    status: row.status,
    roomSlug: row.room_slug,
    isGated: row.is_gated,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hostName: row.host_name,
    channel: row.channel || (row.topic === 'Studio' ? 'Studio' : 'RTMP'),
  };
}

export function buildMeetingResponse({ stream, roomSlug, state, origin }) {
  const sig = signalingPayload(roomSlug, 'presenter');
  return {
    stream: formatStreamRow({ ...stream, room_slug: roomSlug }),
    roomSlug,
    ...sig,
    inviteUrl: `${origin}/join.html?room=${encodeURIComponent(roomSlug)}`,
    isLive: Boolean(state?.isLive),
    studio: state ? formatPublicState(state, { includeInviteTokens: true }) : null,
  };
}

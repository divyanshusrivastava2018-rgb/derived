import { pool } from '../db/pool.js';
import * as devAuth from '../dev-auth.js';
import * as streams from './streams.js';
import * as studio from './studio.js';
import { sanitizeShortText } from '../../../shared/validate.js';
import {
  slugifyTitle,
  formatStreamRow,
  buildMeetingResponse,
} from '../lib/meeting-payload.js';

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

export async function listHostStreams(researcherId, { limit = 50, offset = 0 } = {}) {
  return useDb(
    async () => {
      const { rows } = await pool.query(
        `SELECT s.id, s.title, s.topic, s.status, s.room_slug, s.is_gated,
                s.created_at, s.updated_at, r.name AS host_name
         FROM streams s
         JOIN researchers r ON r.id = s.host_id
         WHERE s.host_id = $1
         ORDER BY s.created_at DESC
         LIMIT $2 OFFSET $3`,
        [researcherId, limit, offset]
      );
      return rows.map((r) => formatStreamRow({ ...r, channel: r.topic === 'Studio' ? 'Studio' : 'RTMP' }));
    },
    () =>
      devAuth.listDevStreamsByHost(researcherId).map((r) =>
        formatStreamRow({ ...r, channel: r.channel || 'Studio' })
      )
  );
}

async function findResumableStream(researcherId) {
  const list = await listHostStreams(researcherId, { limit: 20 });
  return list.find((s) => s.status === 'live') || list.find((s) => s.status === 'scheduled') || null;
}

export async function getDashboard(researcherId) {
  const streamList = await listHostStreams(researcherId);
  const active =
    streamList.find((s) => s.status === 'live') ||
    streamList.find((s) => s.status === 'scheduled') ||
    null;

  let activeMeeting = null;
  if (active) {
    const state = await studio.getRoomState(active.roomSlug);
    if (state) {
      activeMeeting = {
        ...active,
        isLive: Boolean(state.isLive),
        layout: state.session?.layout,
        recordingEnabled: state.session?.recording_enabled,
      };
    }
  }

  return {
    streams: streamList,
    activeMeeting,
    stats: {
      total: streamList.length,
      live: streamList.filter((s) => s.status === 'live').length,
      scheduled: streamList.filter((s) => s.status === 'scheduled').length,
    },
  };
}

export async function openMeeting(
  researcherId,
  hostName,
  { title, forceNew = false, origin = '' } = {}
) {
  if (!forceNew) {
    const resumable = await findResumableStream(researcherId);
    if (resumable) {
      const state = await studio.getRoomState(resumable.roomSlug);
      if (state) {
        const stream = state.stream;
        return {
          ...buildMeetingResponse({
            stream,
            roomSlug: resumable.roomSlug,
            state,
            origin,
          }),
          resumed: true,
        };
      }
    }
  }

  const streamTitle =
    sanitizeShortText(title, 300) ||
    `Live with Researchium, ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const roomSlug = slugifyTitle(streamTitle);

  let stream;
  try {
    stream = await streams.createStream({
      hostId: researcherId,
      title: streamTitle,
      topic: 'Studio',
      roomSlug,
      status: 'scheduled',
      isGated: false,
    });
  } catch (e) {
    if (devAuth.devAuthEnabled() && (devAuth.isDbConnectionError(e) || !(await devAuth.isDatabaseAvailable()))) {
      devAuth.markDatabaseUnavailable();
      stream = devAuth.createDevStream({
        title: streamTitle,
        roomSlug,
        hostId: researcherId,
      });
      stream.host_name = hostName;
    } else {
      throw e;
    }
  }

  const state = await studio.bootstrapStudio(stream);
  return {
    ...buildMeetingResponse({ stream, roomSlug, state, origin }),
    resumed: false,
  };
}

export async function setMeetingLive(researcherId, roomSlug, live) {
  await studio.setLive(roomSlug, researcherId, live);
  const state = await studio.getRoomState(roomSlug);
  return {
    roomSlug,
    isLive: Boolean(state?.isLive),
    status: live ? 'live' : 'scheduled',
  };
}

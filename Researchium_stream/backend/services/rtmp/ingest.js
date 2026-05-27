import { randomBytes } from 'crypto';

const activeIngests = new Map();

export function getRtmpPublicBase() {
  const host = process.env.RTMP_PUBLIC_HOST || '127.0.0.1';
  const port = process.env.RTMP_PUBLIC_PORT || '1935';
  const app = process.env.RTMP_APP_NAME || 'live';
  return { host, port, app, baseUrl: `rtmp://${host}:${port}/${app}` };
}

export function getRtmpInternalBase() {
  const url =
    process.env.RTMP_INTERNAL_URL ||
    `rtmp://${process.env.RTMP_SERVICE_HOST || 'rtmp'}:1935/${process.env.RTMP_APP_NAME || 'live'}`;
  return url.replace(/\/$/, '');
}

export function createIngestSession({ userId, roomSlug, title }) {
  const slug = String(roomSlug || 'room')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 48);
  const key = `${slug}_${randomBytes(4).toString('hex')}`;
  const { baseUrl } = getRtmpPublicBase();

  const session = {
    streamKey: key,
    roomSlug,
    userId,
    title: title || 'Researchium Live',
    rtmpUrl: baseUrl,
    publishUrl: `${baseUrl}/${key}`,
    playUrl: `${getRtmpInternalBase()}/${key}`,
    createdAt: Date.now(),
  };

  activeIngests.set(key, session);
  return session;
}

export function getIngestSession(streamKey) {
  return activeIngests.get(streamKey) || null;
}

export function endIngestSession(streamKey) {
  activeIngests.delete(streamKey);
}

export function listActiveIngests(userId) {
  return [...activeIngests.values()].filter((s) => s.userId === userId);
}

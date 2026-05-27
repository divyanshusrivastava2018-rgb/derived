import { streamSessionRepo } from './repository.js';

const roomIndex = new Map();

export class StreamSessionManager {
  async start(userId, { roomSlug, broadcastId, title, metadata } = {}) {
    if (roomSlug) {
      const existing = await streamSessionRepo.getActiveByRoom(roomSlug);
      if (existing) return existing;
    }

    const session = await streamSessionRepo.create({
      userId,
      roomSlug,
      broadcastId,
      title,
      metadata,
    });

    if (roomSlug) roomIndex.set(roomSlug, session.id);
    return session;
  }

  async end(sessionId, status = 'ended') {
    const session = await streamSessionRepo.end(sessionId, status);
    if (session?.roomSlug) roomIndex.delete(session.roomSlug);
    return session;
  }

  async endByBroadcast(userId, broadcastId) {
    const sessions = await streamSessionRepo.listByUser(userId, { limit: 5, status: 'live' });
    const match = sessions.find((s) => s.broadcastId === broadcastId);
    if (match) return this.end(match.id);
    return null;
  }

  async get(sessionId) {
    return streamSessionRepo.getById(sessionId);
  }

  async list(userId, query) {
    return streamSessionRepo.listByUser(userId, query);
  }

  async getActive(roomSlug) {
    return streamSessionRepo.getActiveByRoom(roomSlug);
  }

  async recordViewers(roomSlug, analyticsPayload) {
    const sessionId = roomIndex.get(roomSlug) || (await streamSessionRepo.getActiveByRoom(roomSlug))?.id;
    if (!sessionId) return null;

    return streamSessionRepo.recordViewers(sessionId, {
      totalViewers: analyticsPayload.totalViewers || 0,
      breakdown: analyticsPayload.breakdown || {},
    });
  }

  async samples(sessionId) {
    return streamSessionRepo.listSamples(sessionId);
  }
}

export const streamSessionManager = new StreamSessionManager();

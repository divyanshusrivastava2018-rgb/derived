import { RoomChatAggregator } from './aggregator.js';
import { unifiedChatRepo } from './repository.js';
import { multistreamRepo } from '../multistream/repository.js';

const rooms = new Map();

export class UnifiedChatManager {
  getAggregator(roomSlug, userId, io) {
    const key = roomSlug;
    if (!rooms.has(key)) {
      rooms.set(key, new RoomChatAggregator({ roomSlug, userId, io }));
    }
    const agg = rooms.get(key);
    agg.userId = userId;
    agg.io = io;
    return agg;
  }

  async start(roomSlug, userId, io, config = {}) {
    const enriched = await this.enrichConfig(userId, config);
    const agg = this.getAggregator(roomSlug, userId, io);
    return agg.start(enriched);
  }

  async enrichConfig(userId, config) {
    const platforms = config.platforms || ['youtube', 'twitch', 'facebook'];
    const out = { ...config, platforms };

    const broadcast = config.broadcastId
      ? await multistreamRepo.getBroadcast(config.broadcastId)
      : null;

    for (const platform of platforms) {
      const target = broadcast?.targets?.find((t) => t.platform === platform);
      out[platform] = {
        ...(config[platform] || {}),
        externalBroadcastId: target?.external_broadcast_id,
        videoId: target?.external_broadcast_id,
      };

      if (platform === 'youtube' && target?.metadata?.streamId) {
        out[platform].videoId = config.youtube?.videoId;
      }

      const secrets = await multistreamRepo.getConnectionSecrets(userId, platform);
      if (secrets?.connection.metadata?.login && platform === 'twitch') {
        out[platform].channel = secrets.connection.metadata.login;
      }
    }

    return out;
  }

  async send(roomSlug, userId, io, text, authorName) {
    const agg = this.getAggregator(roomSlug, userId, io);
    if (!agg.running) throw new Error('aggregator_not_running');
    return agg.sendToAll(text, authorName);
  }

  async moderate(roomSlug, userId, io, action, target) {
    const agg = this.getAggregator(roomSlug, userId, io);
    return agg.moderate(userId, action, target);
  }

  async stop(roomSlug) {
    const agg = rooms.get(roomSlug);
    if (agg) {
      await agg.stop();
      rooms.delete(roomSlug);
    }
  }

  status(roomSlug) {
    return rooms.get(roomSlug)?.status() || { roomSlug, running: false, platforms: [] };
  }

  async history(roomSlug, query = {}) {
    return unifiedChatRepo.listMessages(roomSlug, {
      since: query.since,
      platform: query.platform,
      limit: query.limit,
    });
  }
}

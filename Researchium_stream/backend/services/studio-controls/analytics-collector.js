import { httpRequest } from '../multistream/platforms/base.js';
import { getFreshConnectionSecrets } from '../multistream/token-refresher.js';
import { google } from 'googleapis';
import { platformConfig } from '../multistream/config.js';
import { streamSessionManager } from '../stream-sessions/manager.js';

function parseMeta(meta) {
  if (!meta) return {};
  if (typeof meta === 'string') {
    try {
      return JSON.parse(meta);
    } catch {
      return {};
    }
  }
  return meta;
}

export class AnalyticsCollector {
  constructor() {
    this.rooms = new Map();
  }

  start(roomSlug, userId, io, intervalMs = 10000) {
    this.stop(roomSlug);
    const timer = setInterval(() => {
      void this.collect(roomSlug, userId, io).catch(() => {});
    }, intervalMs);
    if (timer.unref) timer.unref();
    this.rooms.set(roomSlug, { timer, userId });
    void this.collect(roomSlug, userId, io);
  }

  stop(roomSlug) {
    const entry = this.rooms.get(roomSlug);
    if (entry?.timer) clearInterval(entry.timer);
    this.rooms.delete(roomSlug);
  }

  async collect(roomSlug, userId, io) {
    const platforms = ['youtube', 'twitch', 'facebook'];
    const breakdown = {};
    let total = 0;

    await Promise.all(
      platforms.map(async (platform) => {
        try {
          const count = await this.fetchPlatformViewers(userId, platform);
          breakdown[platform] = { viewers: count, live: count > 0 };
          total += count;
        } catch {
          breakdown[platform] = { viewers: 0, live: false, error: true };
        }
      })
    );

    const payload = {
      roomSlug,
      totalViewers: total,
      breakdown,
      at: Date.now(),
    };

    if (io) io.to(roomSlug).emit('analytics-update', payload);
    await streamSessionManager.recordViewers(roomSlug, payload).catch(() => {});
    return payload;
  }

  async fetchPlatformViewers(userId, platform) {
    const secrets = await getFreshConnectionSecrets(userId, platform);
    if (!secrets) return 0;

    if (platform === 'twitch') {
      const data = await httpRequest({
        method: 'GET',
        url: 'https://api.twitch.tv/helix/streams',
        headers: {
          Authorization: `Bearer ${secrets.accessToken}`,
          'Client-Id': process.env.TWITCH_CLIENT_ID,
        },
        params: { user_id: secrets.connection.accountId },
      });
      return data.data?.[0]?.viewer_count || 0;
    }

    if (platform === 'youtube') {
      const cfg = platformConfig.youtube;
      const oauth2 = new google.auth.OAuth2(cfg.clientId(), cfg.clientSecret(), cfg.redirectUri());
      oauth2.setCredentials({
        access_token: secrets.accessToken,
        refresh_token: secrets.refreshToken,
      });
      const youtube = google.youtube({ version: 'v3', auth: oauth2 });
      const res = await youtube.search.list({
        part: ['snippet'],
        forMine: true,
        eventType: 'live',
        type: ['video'],
        maxResults: 1,
      });
      const videoId = res.data.items?.[0]?.id?.videoId;
      if (!videoId) return 0;
      const detail = await youtube.videos.list({
        part: ['liveStreamingDetails'],
        id: [videoId],
      });
      return parseInt(detail.data.items?.[0]?.liveStreamingDetails?.concurrentViewers || '0', 10);
    }

    if (platform === 'facebook') {
      const meta = parseMeta(secrets.connection.metadata);
      const videoId = meta.videoId || meta.liveVideoId;
      if (!videoId) return 0;
      try {
        const data = await httpRequest({
          method: 'GET',
          url: `https://graph.facebook.com/v18.0/${videoId}`,
          params: {
            access_token: secrets.accessToken,
            fields: 'live_views,views',
          },
        });
        return data.live_views || data.views || 0;
      } catch {
        return 0;
      }
    }

    return 0;
  }
}

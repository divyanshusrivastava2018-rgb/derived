import { getFreshConnectionSecrets } from '../multistream/token-refresher.js';
import { platformConfig } from '../multistream/config.js';
import { unifiedChatRepo } from './repository.js';
import { TwitchChatConnector } from './connectors/twitch.js';
import { YouTubeChatConnector } from './connectors/youtube.js';
import { FacebookChatConnector } from './connectors/facebook.js';

export class RoomChatAggregator {
  constructor({ roomSlug, userId, io }) {
    this.roomSlug = roomSlug;
    this.userId = userId;
    this.io = io;
    this.connectors = new Map();
    this.running = false;
    this.config = {};
  }

  async start(config = {}) {
    if (this.running) return this.status();
    this.config = config;
    this.running = true;

    const platforms = config.platforms || ['youtube', 'twitch', 'facebook'];
    const results = [];

    for (const platform of platforms) {
      try {
        await this.startPlatform(platform, config[platform] || {});
        results.push({ platform, ok: true });
      } catch (e) {
        results.push({ platform, ok: false, error: e.message });
      }
    }

    return { roomSlug: this.roomSlug, running: true, platforms: results };
  }

  async startPlatform(platform, platformConfig) {
    const secrets = await getFreshConnectionSecrets(this.userId, platform);
    if (!secrets) throw new Error(`${platform}_not_connected`);

    let connector;
    const meta = secrets.connection.metadata || {};

    if (platform === 'twitch') {
      connector = new TwitchChatConnector({
        accessToken: secrets.accessToken,
        channel: platformConfig.channel || meta.login,
        clientId: platformConfig.clientId || process.env.TWITCH_CLIENT_ID,
        broadcasterId: secrets.connection.accountId,
      });
    } else if (platform === 'youtube') {
      connector = new YouTubeChatConnector({
        accessToken: secrets.accessToken,
        refreshToken: secrets.refreshToken,
        liveChatId: platformConfig.liveChatId,
        videoId: platformConfig.videoId || platformConfig.externalBroadcastId,
      });
    } else if (platform === 'facebook') {
      connector = new FacebookChatConnector({
        accessToken: secrets.accessToken,
        videoId: platformConfig.videoId || platformConfig.externalBroadcastId,
        pageId: secrets.connection.accountId,
      });
    } else {
      throw new Error(`chat_not_supported:${platform}`);
    }

    await connector.start((msg) => this.ingestMessage(msg));
    this.connectors.set(platform, connector);
  }

  async ingestMessage(msg) {
    const saved = await unifiedChatRepo.saveMessage({
      roomSlug: this.roomSlug,
      platform: msg.platform,
      externalId: msg.externalId,
      authorId: msg.authorId,
      authorName: msg.authorName,
      body: msg.body,
      at: msg.at,
      metadata: msg.metadata,
    });

    if (this.io) {
      this.io.to(this.roomSlug).emit('unified-chat-message', saved);
      this.io.to(`chat:${this.roomSlug}`).emit('chat-relay-message', saved);
      this.io.to(this.roomSlug).emit('studio-chat', {
        authorName: `[${msg.platform}] ${msg.authorName}`,
        body: msg.body,
        at: saved.at,
        platform: msg.platform,
      });
    }

    return saved;
  }

  async sendToAll(text, asHost = 'Host') {
    const body = String(text || '').trim();
    if (!body) throw new Error('empty_message');

    const results = [];
    for (const [platform, connector] of this.connectors) {
      try {
        await connector.sendMessage(body);
        const echo = await this.ingestMessage({
          platform,
          externalId: `out-${Date.now()}-${platform}`,
          authorId: this.userId,
          authorName: asHost,
          body,
          at: Date.now(),
          metadata: { outbound: true },
        });
        results.push({ platform, ok: true, id: echo.id });
      } catch (e) {
        results.push({ platform, ok: false, error: e.message });
      }
    }

    return results;
  }

  async moderate(moderatorId, action, target) {
    const platforms =
      target.platform && target.platform !== 'all'
        ? [target.platform]
        : [...this.connectors.keys()];

    const results = [];
    for (const platform of platforms) {
      const connector = this.connectors.get(platform);
      if (!connector) {
        results.push({ platform, ok: false, error: 'not_connected' });
        continue;
      }
      try {
        await connector.moderate(action, {
          userId: target.userId,
          username: target.username,
          durationSec: target.durationSec,
          messageId: target.externalMessageId || target.messageId,
        });

        if (action === 'delete' && target.messageId) {
          await unifiedChatRepo.markDeleted(target.messageId);
        }

        await unifiedChatRepo.logModeration({
          room_slug: this.roomSlug,
          moderator_id: moderatorId,
          action,
          target_platform: platform,
          target_user_id: target.userId,
          target_username: target.username,
          message_id: target.messageId,
          duration_sec: target.durationSec,
          success: true,
        });

        if (this.io) {
          this.io.to(this.roomSlug).emit('unified-chat-moderation', {
            action,
            platform,
            target,
            at: Date.now(),
          });
        }

        results.push({ platform, ok: true });
      } catch (e) {
        await unifiedChatRepo.logModeration({
          room_slug: this.roomSlug,
          moderator_id: moderatorId,
          action,
          target_platform: platform,
          target_user_id: target.userId,
          target_username: target.username,
          message_id: target.messageId,
          duration_sec: target.durationSec,
          success: false,
          error_message: e.message,
        });
        results.push({ platform, ok: false, error: e.message });
      }
    }

    return results;
  }

  async stop() {
    for (const connector of this.connectors.values()) {
      await connector.stop();
    }
    this.connectors.clear();
    this.running = false;
  }

  status() {
    return {
      roomSlug: this.roomSlug,
      running: this.running,
      platforms: [...this.connectors.keys()],
    };
  }
}

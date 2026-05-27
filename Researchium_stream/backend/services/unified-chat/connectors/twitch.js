import tmi from 'tmi.js';
import { withRetry } from '../../multistream/lib/retry.js';
import { httpRequest } from '../../multistream/platforms/base.js';

export class TwitchChatConnector {
  constructor({ accessToken, channel, clientId, broadcasterId }) {
    this.accessToken = accessToken;
    this.channel = (channel || '').replace(/^#/, '').toLowerCase();
    this.clientId = clientId;
    this.broadcasterId = broadcasterId;
    this.client = null;
    this.onMessage = null;
  }

  async start(onMessage) {
    this.onMessage = onMessage;
    const username = await this.fetchLogin();
    this.client = new tmi.Client({
      options: { debug: false },
      connection: { secure: true, reconnect: true },
      identity: { username, password: `oauth:${this.accessToken}` },
      channels: [this.channel],
    });
    this.client.on('message', (channel, tags, message, self) => {
      if (self) return;
      onMessage({
        platform: 'twitch',
        externalId: tags.id,
        authorId: tags['user-id'],
        authorName: tags['display-name'] || tags.username,
        body: message,
        at: parseInt(tags['tmi-sent-ts'], 10) || Date.now(),
        metadata: {
          color: tags.color,
          badges: tags.badges,
          mod: tags.mod,
          subscriber: tags.subscriber,
        },
      });
    });
    await this.client.connect();
  }

  async fetchLogin() {
    const data = await httpRequest({
      method: 'GET',
      url: 'https://api.twitch.tv/helix/users',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Client-Id': this.clientId,
      },
    });
    return data.data?.[0]?.login;
  }

  async sendMessage(text) {
    if (!this.client) throw new Error('twitch_not_connected');
    await this.client.say(this.channel, text.slice(0, 500));
  }

  async moderate(action, { userId, username, durationSec, messageId }) {
    const channel = this.channel;
    if (action === 'delete' && messageId) {
      await httpRequest({
        method: 'DELETE',
        url: 'https://api.twitch.tv/helix/moderation/chat',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Client-Id': this.clientId,
        },
        params: {
          broadcaster_id: this.broadcasterId,
          moderator_id: this.broadcasterId,
          message_id: messageId,
        },
      });
      return;
    }
    if (!this.client) throw new Error('twitch_not_connected');
    const user = username || userId;
    if (action === 'timeout') {
      await this.client.timeout(channel, user, durationSec || 600, 'Researchium moderation');
    } else if (action === 'ban') {
      await this.client.ban(channel, user, 'Researchium moderation');
    } else if (action === 'untimeout') {
      await this.client.timeout(channel, user, 1);
    }
  }

  async stop() {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }
}

import { google } from 'googleapis';
import { platformConfig } from '../../multistream/config.js';

export class YouTubeChatConnector {
  constructor({ accessToken, refreshToken, liveChatId, videoId }) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.liveChatId = liveChatId;
    this.videoId = videoId;
    this.pollTimer = null;
    this.nextPageToken = null;
    this.onMessage = null;
    this.youtube = null;
    this.auth = null;
  }

  async ensureApi() {
    if (this.youtube) return;
    const cfg = platformConfig.youtube;
    this.auth = new google.auth.OAuth2(cfg.clientId(), cfg.clientSecret(), cfg.redirectUri());
    this.auth.setCredentials({
      access_token: this.accessToken,
      refresh_token: this.refreshToken,
    });
    this.youtube = google.youtube({ version: 'v3', auth: this.auth });
  }

  async resolveLiveChatId() {
    await this.ensureApi();
    if (this.liveChatId) return this.liveChatId;
    if (!this.videoId) throw new Error('youtube_live_chat_id_required');
    const res = await this.youtube.videos.list({
      part: ['liveStreamingDetails'],
      id: [this.videoId],
    });
    this.liveChatId = res.data.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
    if (!this.liveChatId) throw new Error('youtube_no_active_chat');
    return this.liveChatId;
  }

  async start(onMessage) {
    this.onMessage = onMessage;
    await this.resolveLiveChatId();
    const poll = async () => {
      try {
        const res = await this.youtube.liveChatMessages.list({
          liveChatId: this.liveChatId,
          part: ['snippet', 'authorDetails'],
          pageToken: this.nextPageToken,
        });
        this.nextPageToken = res.data.nextPageToken;
        for (const item of res.data.items || []) {
          if (item.snippet?.type !== 'textMessageEvent') continue;
          onMessage({
            platform: 'youtube',
            externalId: item.id,
            authorId: item.authorDetails?.channelId,
            authorName: item.authorDetails?.displayName || 'YouTube User',
            body: item.snippet.displayMessage,
            at: new Date(item.snippet.publishedAt).getTime(),
            metadata: {
              isChatOwner: item.authorDetails?.isChatOwner,
              isModerator: item.authorDetails?.isChatModerator,
            },
          });
        }
      } catch (e) {
        /* chat may end */
      }
    };
    await poll();
    this.pollTimer = setInterval(poll, 3000);
  }

  async sendMessage(text) {
    await this.ensureApi();
    await this.resolveLiveChatId();
    await this.youtube.liveChatMessages.insert({
      liveChatId: this.liveChatId,
      part: ['snippet'],
      requestBody: { snippet: { type: 'textMessageEvent', messageText: text.slice(0, 200) } },
    });
  }

  async moderate(action, { userId, messageId }) {
    await this.ensureApi();
    await this.resolveLiveChatId();
    if (action === 'delete' && messageId) {
      await this.youtube.liveChatMessages.delete({ id: messageId });
      return;
    }
    if ((action === 'ban' || action === 'timeout') && userId) {
      await this.youtube.liveChatBans.insert({
        liveChatId: this.liveChatId,
        part: ['snippet'],
        requestBody: {
          snippet: {
            type: action === 'ban' ? 'permanent' : 'temporary',
            bannedUserDetails: { channelId: userId },
          },
        },
      });
    }
  }

  async stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
}

import { httpRequest } from '../../multistream/platforms/base.js';

export class FacebookChatConnector {
  constructor({ accessToken, videoId, pageId }) {
    this.accessToken = accessToken;
    this.videoId = videoId;
    this.pageId = pageId;
    this.pollTimer = null;
    this.seen = new Set();
    this.onMessage = null;
  }

  async start(onMessage) {
    if (!this.videoId) throw new Error('facebook_video_id_required');
    this.onMessage = onMessage;
    const poll = async () => {
      try {
        const data = await httpRequest({
          method: 'GET',
          url: `https://graph.facebook.com/v18.0/${this.videoId}/comments`,
          params: {
            access_token: this.accessToken,
            fields: 'from,message,created_time,id',
            order: 'reverse_chronological',
            limit: 50,
          },
        });
        const items = (data.data || []).reverse();
        for (const item of items) {
          if (this.seen.has(item.id)) continue;
          this.seen.add(item.id);
          onMessage({
            platform: 'facebook',
            externalId: item.id,
            authorId: item.from?.id,
            authorName: item.from?.name || 'Facebook User',
            body: item.message,
            at: new Date(item.created_time).getTime(),
            metadata: {},
          });
        }
      } catch {
        /* ignore poll errors */
      }
    };
    await poll();
    this.pollTimer = setInterval(poll, 4000);
  }

  async sendMessage(text) {
    await httpRequest({
      method: 'POST',
      url: `https://graph.facebook.com/v18.0/${this.videoId}/comments`,
      params: {
        access_token: this.accessToken,
        message: text.slice(0, 8000),
      },
    });
  }

  async moderate(action, { messageId }) {
    if (action === 'delete' && messageId) {
      await httpRequest({
        method: 'DELETE',
        url: `https://graph.facebook.com/v18.0/${messageId}`,
        params: { access_token: this.accessToken },
      });
    }
  }

  async stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
}

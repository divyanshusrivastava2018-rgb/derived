import { log } from '../lib/logger.js';

export class YouTubeLiveService {
  constructor(redisClient = null) {
    this.redis = redisClient;
    this.memoryStreams = new Map();
    this.streamKey = process.env.YOUTUBE_STREAM_KEY;
    this.channelId = process.env.YOUTUBE_CHANNEL_ID;
    this.youtube = null;
    this.oauth2Client = null;
  }

  isOAuthConfigured() {
    return Boolean(
      process.env.YOUTUBE_CLIENT_ID &&
        process.env.YOUTUBE_CLIENT_SECRET &&
        process.env.YOUTUBE_REFRESH_TOKEN
    );
  }

  async ensureApi() {
    if (this.youtube && this.oauth2Client) {
      return { youtube: this.youtube, auth: this.oauth2Client };
    }
    const { google } = await import('googleapis');
    this.youtube = google.youtube('v3');
    this.oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI
    );
    this.oauth2Client.setCredentials({
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    });
    return { youtube: this.youtube, auth: this.oauth2Client };
  }

  async createLiveStream(title, description = '', privacyStatus = 'public') {
    if (!this.isOAuthConfigured()) {
      return this.createMockStream(title, description, privacyStatus);
    }

    try {
      const { youtube, auth } = await this.ensureApi();

      const broadcast = await youtube.liveBroadcasts.insert({
        auth,
        part: ['snippet', 'status', 'contentDetails'],
        requestBody: {
          snippet: {
            title,
            description,
            scheduledStartTime: new Date().toISOString(),
            scheduledEndTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          },
          status: {
            privacyStatus,
            selfDeclaredMadeForKids: false,
          },
          contentDetails: {
            enableAutoStart: true,
            enableAutoStop: true,
            enableDvr: true,
            recordFromStart: true,
            latencyPreference: 'ultraLow',
          },
        },
      });

      const liveStream = await youtube.liveStreams.insert({
        auth,
        part: ['snippet', 'cdn'],
        requestBody: {
          snippet: { title: `${title} - Stream` },
          cdn: {
            format: '1080p',
            ingestionType: 'rtmp',
            frameRate: '30fps',
            resolution: '1080p',
          },
        },
      });

      await youtube.liveBroadcasts.bind({
        auth,
        id: broadcast.data.id,
        streamId: liveStream.data.id,
        part: ['id', 'snippet'],
      });

      const ingestion = liveStream.data.cdn?.ingestionInfo || {};
      const channelId = broadcast.data.snippet?.channelId || this.channelId;
      const record = {
        broadcastId: broadcast.data.id,
        streamId: liveStream.data.id,
        streamUrl: ingestion.ingestionAddress || '',
        streamKey: ingestion.streamName || '',
        title,
        description,
        privacyStatus,
        channelId: channelId || '',
        status: 'ready',
        createdAt: String(Date.now()),
      };

      await this.persistStream(broadcast.data.id, record);
      return this.formatStreamResponse(record, channelId);
    } catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        throw new Error('googleapis not installed — run: npm install (in backend/)');
      }
      log.error(`YouTube API Error: ${error.message}`);
      throw new Error(`YouTube stream creation failed: ${error.message}`);
    }
  }

  createMockStream(title, description, privacyStatus) {
    const id = `yt-${Date.now()}`;
    const ingestAddress = 'rtmp://a.rtmp.youtube.com/live2';
    const key = this.streamKey || '(set YOUTUBE_STREAM_KEY)';
    const record = {
      broadcastId: id,
      streamId: id,
      streamUrl: ingestAddress,
      streamKey: key,
      title: title || 'Researchium Live',
      description,
      privacyStatus,
      channelId: this.channelId || '',
      status: 'ready',
      createdAt: String(Date.now()),
      mock: 'true',
    };
    this.memoryStreams.set(id, record);
    return {
      ...this.formatStreamResponse(record, this.channelId),
      mock: true,
      message:
        'Configure YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN for live API',
    };
  }

  formatStreamResponse(record, channelId) {
    const address = record.streamUrl || 'rtmp://a.rtmp.youtube.com/live2';
    const key = record.streamKey || '';
    const rtmpUrl = key.includes('(') ? address : `${address.replace(/\/$/, '')}/${key}`;
    const embedChannel = channelId || record.channelId;
    const embedHtml = embedChannel
      ? `<iframe width="560" height="315" src="https://www.youtube.com/embed/live_stream?channel=${embedChannel}" frameborder="0" allowfullscreen></iframe>`
      : '';

    return {
      broadcastId: record.broadcastId,
      streamId: record.streamId,
      streamUrl: address,
      streamKey: key,
      rtmpUrl,
      title: record.title,
      privacyStatus: record.privacyStatus,
      embedHtml,
    };
  }

  async persistStream(broadcastId, record) {
    if (this.redis) {
      await this.redis.hSet(`youtube:stream:${broadcastId}`, record);
    }
    this.memoryStreams.set(broadcastId, record);
  }

  async getStoredStream(broadcastId) {
    if (this.redis) {
      try {
        const hash = await this.redis.hGetAll(`youtube:stream:${broadcastId}`);
        if (hash && Object.keys(hash).length) return hash;
      } catch {
        /* use memory */
      }
    }
    return this.memoryStreams.get(broadcastId) || null;
  }

  async endLiveStream(broadcastId) {
    if (!broadcastId) {
      throw new Error('broadcastId required');
    }

    if (!this.isOAuthConfigured()) {
      const stored = await this.getStoredStream(broadcastId);
      if (stored) {
        stored.status = 'ended';
        await this.persistStream(broadcastId, stored);
      }
      this.memoryStreams.delete(broadcastId);
      return { success: true, mock: true };
    }

    try {
      const { youtube, auth } = await this.ensureApi();
      await youtube.liveBroadcasts.transition({
        auth,
        id: broadcastId,
        broadcastStatus: 'complete',
        part: ['id', 'status'],
      });

      if (this.redis) {
        await this.redis.hSet(`youtube:stream:${broadcastId}`, 'status', 'ended');
        await this.redis.expire(`youtube:stream:${broadcastId}`, 86400);
      }
      const stored = await this.getStoredStream(broadcastId);
      if (stored) {
        stored.status = 'ended';
        this.memoryStreams.set(broadcastId, stored);
      }

      return { success: true };
    } catch (error) {
      log.error(`End stream error: ${error.message}`);
      throw error;
    }
  }

  async getStreamStatus(broadcastId) {
    if (!this.isOAuthConfigured()) {
      const stored = await this.getStoredStream(broadcastId);
      return stored?.status || 'unknown';
    }

    const { youtube, auth } = await this.ensureApi();
    const response = await youtube.liveBroadcasts.list({
      auth,
      id: [broadcastId],
      part: ['status', 'snippet'],
    });

    return response.data.items?.[0]?.status?.lifeCycleStatus || 'unknown';
  }

  async updateStreamMetadata(broadcastId, title, description) {
    if (!this.isOAuthConfigured()) {
      const stored = await this.getStoredStream(broadcastId);
      if (!stored) throw new Error('stream_not_found');
      if (title) stored.title = title;
      if (description !== undefined) stored.description = description;
      await this.persistStream(broadcastId, stored);
      return { broadcastId, title: stored.title };
    }

    const { youtube, auth } = await this.ensureApi();
    await youtube.liveBroadcasts.update({
      auth,
      part: ['snippet', 'status'],
      requestBody: {
        id: broadcastId,
        snippet: { title, description },
      },
    });

    const stored = await this.getStoredStream(broadcastId);
    if (stored) {
      if (title) stored.title = title;
      if (description !== undefined) stored.description = description;
      await this.persistStream(broadcastId, stored);
    }

    return { broadcastId, title };
  }
}

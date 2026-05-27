import { google } from 'googleapis';
import { platformConfig } from '../config.js';
import { buildRtmpUrl } from './base.js';

export function getAuthUrl(state) {
  const cfg = platformConfig.youtube;
  const oauth2 = new google.auth.OAuth2(cfg.clientId(), cfg.clientSecret(), cfg.redirectUri());
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: cfg.scopes,
    state,
  });
}

export async function exchangeCode(code) {
  const cfg = platformConfig.youtube;
  const oauth2 = new google.auth.OAuth2(cfg.clientId(), cfg.clientSecret(), cfg.redirectUri());
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  const youtube = google.youtube({ version: 'v3', auth: oauth2 });
  const ch = await youtube.channels.list({ part: ['snippet'], mine: true });
  const channel = ch.data.items?.[0];

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    accountId: channel?.id,
    accountName: channel?.snippet?.title || 'YouTube',
    metadata: { channelId: channel?.id },
  };
}

export async function createLive({ accessToken, refreshToken, title, description, privacyStatus = 'public' }) {
  const cfg = platformConfig.youtube;
  const oauth2 = new google.auth.OAuth2(cfg.clientId(), cfg.clientSecret(), cfg.redirectUri());
  oauth2.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  const youtube = google.youtube({ version: 'v3', auth: oauth2 });

  const broadcast = await youtube.liveBroadcasts.insert({
    part: ['snippet', 'status', 'contentDetails'],
    requestBody: {
      snippet: { title, description: description || '' },
      status: { privacyStatus, selfDeclaredMadeForKids: false },
      contentDetails: { enableAutoStart: true, enableAutoStop: true, latencyPreference: 'low' },
    },
  });

  const stream = await youtube.liveStreams.insert({
    part: ['snippet', 'cdn'],
    requestBody: {
      snippet: { title: `${title} ingest` },
      cdn: { frameRate: '30fps', ingestionType: 'rtmp', resolution: '1080p' },
    },
  });

  await youtube.liveBroadcasts.bind({
    id: broadcast.data.id,
    streamId: stream.data.id,
    part: ['id'],
  });

  const ingest = stream.data.cdn?.ingestionInfo;
  const streamKey = ingest?.streamName;
  const rtmpUrl = buildRtmpUrl(ingest?.ingestionAddress || cfg.rtmpIngest, streamKey);

  return {
    externalBroadcastId: broadcast.data.id,
    streamKey,
    rtmpUrl,
    playbackUrl: `https://www.youtube.com/watch?v=${broadcast.data.id}`,
    metadata: { streamId: stream.data.id },
  };
}

export async function endLive({ accessToken, refreshToken, externalBroadcastId }) {
  const cfg = platformConfig.youtube;
  const oauth2 = new google.auth.OAuth2(cfg.clientId(), cfg.clientSecret(), cfg.redirectUri());
  oauth2.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  const youtube = google.youtube({ version: 'v3', auth: oauth2 });
  await youtube.liveBroadcasts.transition({
    id: externalBroadcastId,
    broadcastStatus: 'complete',
    part: ['id'],
  });
}

import { platformConfig } from '../config.js';
import { httpRequest, buildRtmpUrl } from './base.js';

export function getAuthUrl(state) {
  const cfg = platformConfig.facebook;
  const params = new URLSearchParams({
    client_id: cfg.clientId(),
    redirect_uri: cfg.redirectUri(),
    state,
    scope: cfg.scopes.join(','),
    response_type: 'code',
  });
  return `${cfg.authUrl}?${params}`;
}

export async function exchangeCode(code) {
  const cfg = platformConfig.facebook;
  const token = await httpRequest({
    method: 'GET',
    url: cfg.tokenUrl,
    params: {
      client_id: cfg.clientId(),
      client_secret: cfg.clientSecret(),
      redirect_uri: cfg.redirectUri(),
      code,
    },
  });

  const pages = await httpRequest({
    method: 'GET',
    url: 'https://graph.facebook.com/v18.0/me/accounts',
    params: { access_token: token.access_token },
  });

  const page = pages.data?.[0];
  const expiresIn = token.expires_in || 60 * 24 * 3600;
  return {
    accessToken: page?.access_token || token.access_token,
    refreshToken: page?.access_token || token.access_token,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    accountId: page?.id,
    accountName: page?.name || 'Facebook Page',
    metadata: { pageId: page?.id },
  };
}

export async function createLive({ accessToken, accountId, title, description }) {
  const cfg = platformConfig.facebook;
  const pageId = accountId || null;
  if (!pageId) throw new Error('facebook_page_required');

  const live = await httpRequest({
    method: 'POST',
    url: `https://graph.facebook.com/v18.0/${pageId}/live_videos`,
    params: {
      access_token: accessToken,
      title: title || 'Researchium Live',
      description: description || '',
      status: 'LIVE_NOW',
    },
  });

  const streamKey = live.stream_url?.split('/').pop() || live.secure_stream_url;
  const rtmpUrl = live.stream_url || live.secure_stream_url || buildRtmpUrl(cfg.rtmpIngest, streamKey);

  return {
    externalBroadcastId: live.id,
    streamKey: live.stream_key || streamKey,
    rtmpUrl,
    playbackUrl: `https://facebook.com/${pageId}`,
    metadata: { videoId: live.id },
  };
}

export async function endLive({ accessToken, externalBroadcastId }) {
  await httpRequest({
    method: 'POST',
    url: `https://graph.facebook.com/v18.0/${externalBroadcastId}`,
    params: { access_token: accessToken, end_live_video: true },
  }).catch(() => {});
}

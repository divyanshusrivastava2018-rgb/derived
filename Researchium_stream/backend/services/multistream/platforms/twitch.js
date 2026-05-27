import { platformConfig } from '../config.js';
import { httpRequest, buildRtmpUrl } from './base.js';

export function getAuthUrl(state) {
  const cfg = platformConfig.twitch;
  const params = new URLSearchParams({
    client_id: cfg.clientId(),
    redirect_uri: cfg.redirectUri(),
    response_type: 'code',
    scope: cfg.scopes.join(' '),
    state,
  });
  return `${cfg.authUrl}?${params}`;
}

export async function exchangeCode(code) {
  const cfg = platformConfig.twitch;
  const token = await httpRequest({
    method: 'POST',
    url: cfg.tokenUrl,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: new URLSearchParams({
      client_id: cfg.clientId(),
      client_secret: cfg.clientSecret(),
      code,
      grant_type: 'authorization_code',
      redirect_uri: cfg.redirectUri(),
    }).toString(),
  });

  const user = await httpRequest({
    method: 'GET',
    url: 'https://api.twitch.tv/helix/users',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Client-Id': cfg.clientId(),
    },
  });

  const u = user.data?.[0];
  const keyRes = await httpRequest({
    method: 'GET',
    url: `https://api.twitch.tv/helix/streams/key?broadcaster_id=${u.id}`,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Client-Id': cfg.clientId(),
    },
  });

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
    accountId: u?.id,
    accountName: u?.display_name || 'Twitch',
    streamKey: keyRes.data?.[0]?.stream_key,
    metadata: { login: u?.login },
  };
}

export async function createLive({ accessToken, title, accountId, streamKey }) {
  const cfg = platformConfig.twitch;
  await httpRequest({
    method: 'PATCH',
    url: 'https://api.twitch.tv/helix/channels',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': cfg.clientId(),
      'Content-Type': 'application/json',
    },
    data: { title: title?.slice(0, 140) || 'Researchium Live' },
  }).catch(() => {});

  let key = streamKey;
  if (!key && accountId) {
    const keyRes = await httpRequest({
      method: 'GET',
      url: `https://api.twitch.tv/helix/streams/key?broadcaster_id=${accountId}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': cfg.clientId(),
      },
    });
    key = keyRes.data?.[0]?.stream_key;
  }

  return {
    externalBroadcastId: accountId,
    streamKey: key,
    rtmpUrl: buildRtmpUrl(cfg.rtmpIngest, key),
    playbackUrl: null,
    metadata: { broadcasterId: accountId },
  };
}

export async function endLive() {
  /* Twitch ends when RTMP disconnects */
}

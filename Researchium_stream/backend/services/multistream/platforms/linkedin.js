import { platformConfig } from '../config.js';
import { httpRequest } from './base.js';

export function getAuthUrl(state) {
  const cfg = platformConfig.linkedin;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId(),
    redirect_uri: cfg.redirectUri(),
    state,
    scope: cfg.scopes.join(' '),
  });
  return `${cfg.authUrl}?${params}`;
}

export async function exchangeCode(code) {
  const cfg = platformConfig.linkedin;
  const token = await httpRequest({
    method: 'POST',
    url: cfg.tokenUrl,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: cfg.redirectUri(),
      client_id: cfg.clientId(),
      client_secret: cfg.clientSecret(),
    }).toString(),
  });

  const profile = await httpRequest({
    method: 'GET',
    url: 'https://api.linkedin.com/v2/me',
    headers: { Authorization: `Bearer ${token.access_token}` },
  }).catch(() => ({ localizedFirstName: 'LinkedIn' }));

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(Date.now() + (token.expires_in || 3600) * 1000),
    accountId: profile.id,
    accountName: `${profile.localizedFirstName || ''} ${profile.localizedLastName || ''}`.trim() || 'LinkedIn',
    metadata: { note: 'LinkedIn Live RTMP requires approved Live Events API partner access' },
  };
}

export async function createLive({ title, description }) {
  return {
    externalBroadcastId: `li-${Date.now()}`,
    streamKey: null,
    rtmpUrl: null,
    playbackUrl: null,
    metadata: {
      title,
      description,
      message:
        'LinkedIn Live stream creation requires LinkedIn Marketing API / Live Events approval. Connection saved; configure RTMP in LinkedIn Live Producer manually.',
    },
  };
}

export async function endLive() {}

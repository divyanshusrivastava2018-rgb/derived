import { google } from 'googleapis';
import { platformConfig } from './config.js';
import { httpRequest } from './platforms/base.js';
import { multistreamRepo } from './repository.js';
import { log } from '../../lib/logger.js';

const REFRESH_BUFFER_MS = Number(process.env.OAUTH_REFRESH_BUFFER_MS) || 5 * 60 * 1000;

function needsRefresh(expiresAt) {
  if (!expiresAt) return false;
  const t = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return Date.now() >= t - REFRESH_BUFFER_MS;
}

async function refreshYouTube(secrets) {
  const cfg = platformConfig.youtube;
  const oauth2 = new google.auth.OAuth2(cfg.clientId(), cfg.clientSecret(), cfg.redirectUri());
  oauth2.setCredentials({
    access_token: secrets.accessToken,
    refresh_token: secrets.refreshToken,
  });
  const { credentials } = await oauth2.refreshAccessToken();
  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token || secrets.refreshToken,
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
  };
}

async function refreshTwitch(secrets) {
  const cfg = platformConfig.twitch;
  if (!secrets.refreshToken) throw new Error('twitch_refresh_token_missing');
  const token = await httpRequest({
    method: 'POST',
    url: cfg.tokenUrl,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: secrets.refreshToken,
      client_id: cfg.clientId(),
      client_secret: cfg.clientSecret(),
    }).toString(),
  });
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || secrets.refreshToken,
    expiresAt: new Date(Date.now() + (token.expires_in || 3600) * 1000),
  };
}

async function refreshLinkedIn(secrets) {
  const cfg = platformConfig.linkedin;
  if (!secrets.refreshToken) throw new Error('linkedin_refresh_token_missing');
  const token = await httpRequest({
    method: 'POST',
    url: cfg.tokenUrl,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: secrets.refreshToken,
      client_id: cfg.clientId(),
      client_secret: cfg.clientSecret(),
    }).toString(),
  });
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || secrets.refreshToken,
    expiresAt: new Date(Date.now() + (token.expires_in || 3600) * 1000),
  };
}

async function refreshFacebook(secrets) {
  const cfg = platformConfig.facebook;
  const token = await httpRequest({
    method: 'GET',
    url: 'https://graph.facebook.com/v18.0/oauth/access_token',
    params: {
      grant_type: 'fb_exchange_token',
      client_id: cfg.clientId(),
      client_secret: cfg.clientSecret(),
      fb_exchange_token: secrets.accessToken,
    },
  });
  const expiresIn = token.expires_in || 60 * 24 * 3600;
  return {
    accessToken: token.access_token,
    refreshToken: secrets.refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

const refreshers = {
  youtube: refreshYouTube,
  twitch: refreshTwitch,
  linkedin: refreshLinkedIn,
  facebook: refreshFacebook,
};

export async function refreshPlatformTokens(userId, platform, secrets) {
  const fn = refreshers[platform];
  if (!fn) return secrets;
  if (!secrets.refreshToken && platform !== 'facebook') {
    if (!needsRefresh(secrets.connection?.tokenExpiresAt)) return secrets;
    throw new Error(`${platform}_refresh_token_missing`);
  }

  const refreshed = await fn(secrets);
  await multistreamRepo.saveConnection(
    userId,
    platform,
    {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      streamKey: secrets.streamKey,
      expiresAt: refreshed.expiresAt,
    },
    {
      accountId: secrets.connection.accountId,
      accountName: secrets.connection.accountName,
      metadata: secrets.connection.metadata,
    }
  );

  log.info(`Refreshed OAuth token for ${platform} user=${userId}`);
  return multistreamRepo.getConnectionSecrets(userId, platform);
}

export async function getFreshConnectionSecrets(userId, platform) {
  const secrets = await multistreamRepo.getConnectionSecrets(userId, platform);
  if (!secrets) return null;

  const expiresAt = secrets.connection?.tokenExpiresAt;
  if (!needsRefresh(expiresAt)) return secrets;

  try {
    return await refreshPlatformTokens(userId, platform, secrets);
  } catch (e) {
    log.warn(`Token refresh failed ${platform}: ${e.message}`);
    if (secrets.accessToken) return secrets;
    throw e;
  }
}

export const PLATFORMS = ['youtube', 'twitch', 'facebook', 'linkedin'];

export const platformConfig = {
  youtube: {
    label: 'YouTube Live',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.force-ssl',
    ],
    clientId: () => process.env.YOUTUBE_CLIENT_ID,
    clientSecret: () => process.env.YOUTUBE_CLIENT_SECRET,
    redirectUri: () =>
      process.env.YOUTUBE_OAUTH_REDIRECT_URI ||
      `${process.env.PUBLIC_STUDIO_URL || 'http://127.0.0.1:5050'}/api/multistream/oauth/youtube/callback`,
    rtmpIngest: 'rtmp://a.rtmp.youtube.com/live2',
  },
  twitch: {
    label: 'Twitch',
    authUrl: 'https://id.twitch.tv/oauth2/authorize',
    tokenUrl: 'https://id.twitch.tv/oauth2/token',
    scopes: ['channel:manage:broadcast', 'channel:read:stream_key', 'user:read:email'],
    clientId: () => process.env.TWITCH_CLIENT_ID,
    clientSecret: () => process.env.TWITCH_CLIENT_SECRET,
    redirectUri: () =>
      process.env.TWITCH_OAUTH_REDIRECT_URI ||
      `${process.env.PUBLIC_STUDIO_URL || 'http://127.0.0.1:5050'}/api/multistream/oauth/twitch/callback`,
    rtmpIngest: 'rtmp://live.twitch.tv/app',
  },
  facebook: {
    label: 'Facebook Live',
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
    clientId: () => process.env.FACEBOOK_APP_ID,
    clientSecret: () => process.env.FACEBOOK_APP_SECRET,
    redirectUri: () =>
      process.env.FACEBOOK_OAUTH_REDIRECT_URI ||
      `${process.env.PUBLIC_STUDIO_URL || 'http://127.0.0.1:5050'}/api/multistream/oauth/facebook/callback`,
    rtmpIngest: 'rtmps://live-api-s.facebook.com:443/rtmp',
  },
  linkedin: {
    label: 'LinkedIn Live',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    scopes: ['w_member_social', 'r_liteprofile'],
    clientId: () => process.env.LINKEDIN_CLIENT_ID,
    clientSecret: () => process.env.LINKEDIN_CLIENT_SECRET,
    redirectUri: () =>
      process.env.LINKEDIN_OAUTH_REDIRECT_URI ||
      `${process.env.PUBLIC_STUDIO_URL || 'http://127.0.0.1:5050'}/api/multistream/oauth/linkedin/callback`,
    rtmpIngest: null,
  },
};

export function isPlatformConfigured(platform) {
  const cfg = platformConfig[platform];
  if (!cfg) return false;
  return Boolean(cfg.clientId() && cfg.clientSecret());
}

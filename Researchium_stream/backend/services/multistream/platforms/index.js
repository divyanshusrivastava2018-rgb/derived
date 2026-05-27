import * as youtube from './youtube.js';
import * as twitch from './twitch.js';
import * as facebook from './facebook.js';
import * as linkedin from './linkedin.js';

export const platformAdapters = {
  youtube,
  twitch,
  facebook,
  linkedin,
};

export function getAdapter(platform) {
  const adapter = platformAdapters[platform];
  if (!adapter) throw new Error(`unsupported_platform:${platform}`);
  return adapter;
}

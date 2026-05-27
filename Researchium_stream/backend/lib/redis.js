import { log } from './logger.js';

let client = null;
let subClient = null;

export async function connectRedis() {
  if (process.env.REDIS_URL === '0' || process.env.SKIP_REDIS === '1' || process.env.REDIS_URL === '') {
    log.info('Redis disabled (in-memory mode)');
    return { client: null, subClient: null };
  }
  try {
    const { createClient } = await import('redis');
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    client = createClient({ url });
    subClient = client.duplicate();
    client.on('error', (e) => log.warn(`Redis: ${e.message}`));
    await client.connect();
    await subClient.connect();
    log.info('Redis connected');
    return { client, subClient };
  } catch (e) {
    log.warn(`Redis unavailable (${e.message}); using in-memory stores`);
    client = null;
    subClient = null;
    return { client: null, subClient: null };
  }
}

export function getRedis() {
  return client;
}

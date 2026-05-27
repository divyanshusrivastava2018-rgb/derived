/**
 * Optional encoding / RTMP relay worker.
 * Requires fluent-ffmpeg on PATH and optional Redis/Bull when configured.
 */
import { config } from '../config.js';
import { log } from '../lib/logger.js';

log.info('Encoding worker started (stub).');
log.info(`API: ${config.apiUrl}`);
log.info('Set ENCODING_WORKER_ENABLED=1 and install optional deps for full pipeline.');

if (process.env.ENCODING_WORKER_ENABLED === '1') {
  try {
    const { default: ffmpeg } = await import('fluent-ffmpeg');
    log.info(`ffmpeg bindings loaded: ${typeof ffmpeg}`);
  } catch {
    log.warn('fluent-ffmpeg not installed — run: npm install fluent-ffmpeg');
  }
}

setInterval(() => {
  /* heartbeat for process supervisors */
}, 60_000);

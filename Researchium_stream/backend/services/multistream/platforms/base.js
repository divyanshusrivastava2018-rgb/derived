import axios from 'axios';
import { withRetry } from '../lib/retry.js';

export class PlatformApiError extends Error {
  constructor(message, { status, platform, retryable = false, response } = {}) {
    super(message);
    this.name = 'PlatformApiError';
    this.status = status;
    this.platform = platform;
    this.retryable = retryable;
    this.response = response;
  }
}

function isRetryableStatus(status) {
  return !status || status === 429 || status >= 500;
}

export async function httpRequest(config, retryOpts = {}) {
  const platform = retryOpts.platform;
  return withRetry(
    async () => {
      const res = await axios({
        timeout: Number(process.env.PLATFORM_HTTP_TIMEOUT_MS) || 20000,
        validateStatus: () => true,
        ...config,
      });
      if (res.status >= 400) {
        const msg =
          res.data?.error?.message ||
          res.data?.error ||
          res.data?.message ||
          `HTTP ${res.status}`;
        throw new PlatformApiError(String(msg), {
          status: res.status,
          platform,
          retryable: isRetryableStatus(res.status),
          response: res.data,
        });
      }
      return res.data;
    },
    {
      maxAttempts: retryOpts.maxAttempts || Number(process.env.PLATFORM_API_RETRY_MAX) || 3,
      shouldRetry: (err) => {
        if (err instanceof PlatformApiError) return err.retryable;
        return true;
      },
    }
  );
}

export function buildRtmpUrl(ingest, streamKey) {
  if (!ingest || !streamKey) return null;
  if (streamKey.includes('rtmp://') || streamKey.includes('rtmps://')) return streamKey;
  if (ingest.includes('/') && streamKey.length > 20 && !streamKey.includes(' ')) {
    return `${ingest.replace(/\/$/, '')}/${streamKey}`;
  }
  return `${ingest.replace(/\/$/, '')}/${streamKey}`;
}

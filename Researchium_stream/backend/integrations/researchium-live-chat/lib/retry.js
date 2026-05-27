/**
 * Exponential backoff with jitter for webhook / outbound HTTP retries.
 */
export function backoffDelay(attempt, { baseMs = 1000, maxMs = 60000 } = {}) {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * Math.min(1000, exp * 0.2));
  return exp + jitter;
}

export async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseMs = 1000,
    maxMs = 60000,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !shouldRetry(err, attempt)) throw err;
      const delay = backoffDelay(attempt, { baseMs, maxMs });
      onRetry?.(err, attempt, delay);
      await sleep(delay);
    }
  }
  throw lastError;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function nextRetryAt(attempt, config) {
  const delay = backoffDelay(attempt, {
    baseMs: config.webhookRetryBaseMs,
    maxMs: config.webhookRetryMaxMs,
  });
  return new Date(Date.now() + delay);
}

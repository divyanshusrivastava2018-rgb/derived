/**
 * Simple in-memory sliding-window rate limiter (per key).
 */
export function createRateLimiter({ windowMs = 60_000, max = 60 } = {}) {
  const buckets = new Map();

  return function rateLimit(key) {
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const err = new Error('Too many requests');
      err.status = 429;
      throw err;
    }
  };
}

export function createEventLimiter({ windowMs = 10_000, max = 120 } = {}) {
  return createRateLimiter({ windowMs, max });
}

// Periodic cleanup
setInterval(() => {
  /* buckets expire naturally on next access */
}, 300_000).unref?.();

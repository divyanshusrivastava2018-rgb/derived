import rateLimit from 'express-rate-limit';

function createLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max: Number(process.env[message.envKey] || max),
    message: { error: message.code, retryable: true },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, _next, options) => {
      res.status(429).json({
        error: message.code,
        retryable: true,
        retryAfter: Math.ceil(options.windowMs / 1000),
      });
    },
  });
}

export const oauthLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { code: 'oauth_rate_limited', envKey: 'OAUTH_RATE_LIMIT_MAX' },
});

export const chatLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: { code: 'chat_rate_limited', envKey: 'CHAT_RATE_LIMIT_MAX' },
});

export const rtmpLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: { code: 'rtmp_rate_limited', envKey: 'RTMP_RATE_LIMIT_MAX' },
});

export const goLiveLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { code: 'golive_rate_limited', envKey: 'GOLIVE_RATE_LIMIT_MAX' },
});

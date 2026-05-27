import rateLimit from 'express-rate-limit';

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_auth_attempts' },
});

export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.PASSWORD_RESET_RATE_LIMIT_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_reset_attempts' },
});

export const guestChatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.GUEST_CHAT_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited' },
});

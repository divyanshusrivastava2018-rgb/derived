import { log } from '../lib/logger.js';

export class ApiError extends Error {
  constructor(message, { status = 500, code, retryable = false, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || message;
    this.retryable = retryable;
    this.details = details;
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'not_found',
    path: req.originalUrl,
  });
}

export function apiErrorHandler(err, req, res, _next) {
  const status =
    err.status ||
    err.statusCode ||
    (err.name === 'ApiError' ? err.status : undefined) ||
    500;

  const retryable =
    err.retryable === true ||
    status === 429 ||
    status >= 500;

  if (status >= 500) {
    log.error(`${req.method} ${req.path}: ${err.message}`, { stack: err.stack });
  } else {
    log.warn(`${req.method} ${req.path}: ${err.message}`);
  }

  res.status(status).json({
    error: err.code || err.message || 'internal_error',
    retryable,
    ...(process.env.NODE_ENV !== 'production' && err.details ? { details: err.details } : {}),
  });
}

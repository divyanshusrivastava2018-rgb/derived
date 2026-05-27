export function notFound(_req, res) {
  res.status(404).json({ error: 'not_found' });
}

import * as devAuth from '../dev-auth.js';

export function errorHandler(err, _req, res, _next) {
  if (err.message === 'CORS not allowed') {
    return res.status(403).json({ error: 'cors_forbidden' });
  }
  if (devAuth.isDbConnectionError(err)) {
    return res.status(503).json({
      error: 'database_unavailable',
      hint: devAuth.devAuthEnabled()
        ? 'Database unreachable; using in-memory dev mode.'
        : 'Set DEV_AUTH_FALLBACK=1 in .env and restart: npm run dev:api',
    });
  }
  const status = err.status || 500;
  if (status >= 500) console.error('[api]', err.message || 'internal_error');
  const error = status < 500 ? err.message || 'request_failed' : 'internal_error';
  res.status(status).json({ error });
}

import { isProduction } from './env.js';

export function parseAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) {
    if (!isProduction()) {
      return [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
      ];
    }
    return [];
  }
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

export function createCorsOptions() {
  const allowed = parseAllowedOrigins();

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      callback(new Error('CORS not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  };
}

export function createSocketCors() {
  const allowed = parseAllowedOrigins();
  return {
    origin: allowed,
    methods: ['GET', 'POST'],
    credentials: true,
  };
}

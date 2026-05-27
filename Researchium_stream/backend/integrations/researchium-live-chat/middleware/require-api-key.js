import crypto from 'crypto';
import { integrationConfig } from '../config.js';

export function requireResearchiumApiKey(req, res, next) {
  const key = req.get('X-API-Key') || req.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const expected = integrationConfig.apiKey;

  if (!expected) {
    return res.status(503).json({
      error: 'integration_not_configured',
      message: 'Set RESEARCHIUM_INTEGRATION_API_KEY',
    });
  }

  if (!key || typeof key !== 'string') {
    return res.status(401).json({ error: 'unauthorized', message: 'API key required' });
  }

  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid API key' });
  }

  next();
}

import { verifyApiKey } from '../../../shared/auth.js';

export function requireApiKey(req, res, next) {
  if (!verifyApiKey(req.get('X-API-Key'))) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

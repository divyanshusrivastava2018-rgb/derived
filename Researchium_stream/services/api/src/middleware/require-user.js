import { verifySessionToken } from '../../../shared/auth.js';
import * as users from '../services/users.js';

export async function requireUser(req, res, next) {
  const header = req.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const payload = verifySessionToken(header.slice(7));
    const user = await users.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'unauthorized' });
    req.user = users.publicUser(user);
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

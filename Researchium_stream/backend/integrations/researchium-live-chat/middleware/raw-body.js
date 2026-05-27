/**
 * Capture raw body for webhook HMAC verification (must run before express.json).
 */
export function rawBodyMiddleware(req, res, next) {
  if (!req.path?.includes('/webhooks')) return next();

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks).toString('utf8');
    try {
      req.body = req.rawBody ? JSON.parse(req.rawBody) : {};
    } catch {
      req.body = {};
    }
    next();
  });
  req.on('error', next);
}

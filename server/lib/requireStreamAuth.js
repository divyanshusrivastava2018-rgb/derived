const streamStudioJwt = require('./streamStudioJwt');

function requireStreamAuth(req, res, next) {
  const token = streamStudioJwt.parseBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const payload = streamStudioJwt.verifyHostToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.streamAuth = payload;
  return next();
}

module.exports = { requireStreamAuth };

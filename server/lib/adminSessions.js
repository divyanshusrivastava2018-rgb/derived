const crypto = require('crypto');

const TTL_MS = 24 * 60 * 60 * 1000;
const sessions = new Map();

function createSession() {
  const token = crypto.randomBytes(48).toString('base64url');
  sessions.set(token, Date.now() + TTL_MS);
  return token;
}

function isValidSession(token) {
  if (!token || typeof token !== 'string') return false;
  const exp = sessions.get(token);
  if (!exp) return false;
  if (Date.now() > exp) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function revokeSession(token) {
  if (token) sessions.delete(token);
}

function sweepExpired() {
  const now = Date.now();
  for (const [t, exp] of sessions) {
    if (now > exp) sessions.delete(t);
  }
}

const sweepTimer = setInterval(sweepExpired, 60 * 60 * 1000);
if (sweepTimer.unref) sweepTimer.unref();

module.exports = { createSession, isValidSession, revokeSession, TTL_MS };

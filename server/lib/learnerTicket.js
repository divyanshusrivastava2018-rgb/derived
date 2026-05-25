/**
 * HMAC-signed learner tokens for /api/platform/progress (prevents IDOR on raw learnerId).
 */
const crypto = require('crypto');
const { nanoid } = require('nanoid');
const memberCookie = require('./memberCookie');

const TTL_MS = 400 * 24 * 60 * 60 * 1000;

function signingSecret() {
  const s =
    String(process.env.RESEARCHIUM_PROGRESS_SECRET || '').trim() ||
    memberCookie.getMemberSecret();
  return s || null;
}

function sign(data) {
  const secret = signingSecret();
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

function mintLearnerToken() {
  const secret = signingSecret();
  if (!secret) return null;
  const payload = {
    id: `lr_${nanoid(18)}`,
    exp: Date.now() + TTL_MS
  };
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = sign(data);
  return `${data}.${sig}`;
}

function verifyLearnerToken(token) {
  const secret = signingSecret();
  if (!secret || !token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(data);
  if (!expected) return null;
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload.id !== 'string') return null;
  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(payload.id)) return null;
  return payload.id;
}

module.exports = {
  mintLearnerToken,
  verifyLearnerToken,
  signingSecret
};

const crypto = require('crypto');

const COOKIE_NAME = 'researchium_member';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function getMemberSecret() {
  return String(process.env.RESEARCHIUM_MEMBER_SECRET || '').trim();
}

function signMemberPayload(payload) {
  const secret = getMemberSecret();
  if (!secret) return null;
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyMemberToken(token) {
  if (!token || typeof token !== 'string') return null;
  const secret = getMemberSecret();
  if (!secret) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
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
  if (!payload || payload.paid !== true) return null;
  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
  return payload;
}

function createMemberCookieValue() {
  return signMemberPayload({ paid: true, exp: Date.now() + TTL_MS });
}

function parseCookies(header) {
  const out = {};
  if (!header || typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function isPaidMember(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  return !!verifyMemberToken(token);
}

function memberCookieOptions() {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(createMemberCookieValue())}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(TTL_MS / 1000)}`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearMemberCookieOptions() {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function demoUnlockAllowed() {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.ALLOW_DEMO_MEMBER === '1';
}

module.exports = {
  COOKIE_NAME,
  isPaidMember,
  memberCookieOptions,
  clearMemberCookieOptions,
  demoUnlockAllowed,
  getMemberSecret
};

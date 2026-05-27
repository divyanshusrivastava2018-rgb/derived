const crypto = require('crypto');
const memberCookie = require('./memberCookie');

const TOKEN_TTL_SEC = 8 * 60 * 60;

function getSigningSecret() {
  return memberCookie.getMemberSecret();
}

function signHostToken(email) {
  const secret = getSigningSecret();
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    role: 'host',
    email: String(email || '').trim().toLowerCase(),
    iat: now,
    exp: now + TOKEN_TTL_SEC
  };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString(
    'base64url'
  );
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyHostToken(token) {
  if (!token || typeof token !== 'string') return null;
  const secret = getSigningSecret();
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');

  const a = Buffer.from(sigB64, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length) return null;
  try {
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') return null;
  if (!payload || payload.role !== 'host') return null;
  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    role: payload.role,
    email: payload.email,
    exp: payload.exp,
    iat: payload.iat
  };
}

function parseBearerToken(req) {
  const raw = req.headers.authorization || req.headers.Authorization || '';
  if (typeof raw !== 'string') return null;
  const m = /^Bearer\s+(\S+)$/i.exec(raw.trim());
  return m ? m[1] : null;
}

module.exports = {
  TOKEN_TTL_SEC,
  signHostToken,
  verifyHostToken,
  parseBearerToken,
  getSigningSecret
};

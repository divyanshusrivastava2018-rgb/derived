import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { requireEnv } from './env.js';

const ISSUER = 'researchium-stream';

function getJwtSecret() {
  return requireEnv(
    'JWT_SECRET',
    'dev-only-change-me-before-any-shared-network-use'
  );
}

export function createPeerId() {
  return crypto.randomUUID();
}

export function signRoomToken({ peerId, roomId, role = 'viewer' }) {
  return jwt.sign(
    { sub: peerId, roomId, role },
    getJwtSecret(),
    { expiresIn: '2h', issuer: ISSUER, audience: 'researchium-signaling' }
  );
}

export function verifyRoomToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    issuer: ISSUER,
    audience: 'researchium-signaling',
  });
}

export function signSessionToken({ userId, email, name }) {
  return jwt.sign(
    { sub: userId, email, name },
    getJwtSecret(),
    { expiresIn: '7d', issuer: ISSUER, audience: 'researchium-session' }
  );
}

export function verifySessionToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    issuer: ISSUER,
    audience: 'researchium-session',
  });
}

export function verifyInternalKey(headerValue) {
  const expected = requireEnv('INTERNAL_SERVICE_KEY', 'dev-internal-service-key');
  if (!headerValue || typeof headerValue !== 'string') return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyApiKey(headerValue) {
  const expected = requireEnv('API_KEY', 'dev-api-key-change-in-production');
  if (!headerValue || typeof headerValue !== 'string') return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

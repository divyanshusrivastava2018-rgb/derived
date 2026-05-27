import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { isProduction } from '../../shared/env.js';
import { pingDb } from './db/pool.js';
import { assertEmail, assertPassword, sanitizeShortText } from '../../shared/validate.js';

export const DEV_USER_ID = 'a0000000-0000-4000-8000-000000000001';
export const DEV_RESEARCHER_ID = 'a0000000-0000-4000-8000-000000000002';

const DEV_USERS = [
  {
    id: DEV_USER_ID,
    email: 'demo@gmail.com',
    name: 'Demo Researcher',
    password_hash: '$2b$12$yb4hqTso7zAEMFjg.FXbO.c2Hn/lq10mR9PEfsFb6VJhxcDr8VVwe', // Demo@1234
    researcher_id: DEV_RESEARCHER_ID,
    researcher_name: 'Demo Researcher',
    institution: 'Researchium Lab',
  },
];

/** @type {Map<string, { userId: string, expires: number }>} */
const devResetTokens = new Map();

let dbAvailableCache = null;

export function devAuthEnabled() {
  if (isProduction()) return false;
  return process.env.DEV_AUTH_FALLBACK === '1';
}

export function markDatabaseUnavailable() {
  dbAvailableCache = false;
}

export async function isDatabaseAvailable() {
  if (!devAuthEnabled()) return true;
  if (dbAvailableCache === false) return false;
  try {
    dbAvailableCache = await pingDb();
  } catch {
    dbAvailableCache = false;
  }
  return dbAvailableCache;
}

export function isDbConnectionError(err) {
  const code = err?.code;
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === '57P03' ||
    code === 'ECONNRESET'
  );
}

export function findDevUserByEmail(email) {
  const e = email.trim().toLowerCase();
  return DEV_USERS.find((u) => u.email === e) || null;
}

export function findDevUserById(id) {
  return DEV_USERS.find((u) => u.id === id) || null;
}

export async function registerDevUser({ email, password, name, institution }) {
  const cleanEmail = assertEmail(email);
  assertPassword(password);
  if (findDevUserByEmail(cleanEmail)) {
    const err = new Error('email_exists');
    err.status = 409;
    throw err;
  }
  const cleanName = sanitizeShortText(name, 120);
  if (!cleanName) {
    const err = new Error('name_required');
    err.status = 400;
    throw err;
  }
  const researcherId = crypto.randomUUID();
  const user = {
    id: crypto.randomUUID(),
    email: cleanEmail,
    name: cleanName,
    password_hash: await bcrypt.hash(String(password), 12),
    researcher_id: researcherId,
    researcher_name: cleanName,
    institution: institution ? sanitizeShortText(institution, 200) : null,
  };
  DEV_USERS.push(user);
  return user;
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createDevPasswordReset(email) {
  const user = findDevUserByEmail(email);
  if (!user) return null;
  const token = crypto.randomBytes(32).toString('hex');
  devResetTokens.set(hashResetToken(token), {
    userId: user.id,
    expires: Date.now() + 60 * 60 * 1000,
  });
  return token;
}

export async function consumeDevPasswordReset(token, newPassword) {
  assertPassword(newPassword);
  const key = hashResetToken(token);
  const entry = devResetTokens.get(key);
  if (!entry || entry.expires < Date.now()) return null;
  devResetTokens.delete(key);
  const user = findDevUserById(entry.userId);
  if (!user) return null;
  user.password_hash = await bcrypt.hash(String(newPassword), 12);
  return entry.userId;
}

const devStreams = [];

export function createDevStream({ title, roomSlug, hostId }) {
  const stream = {
    id: crypto.randomUUID(),
    title,
    topic: 'Studio',
    status: 'scheduled',
    room_slug: roomSlug,
    is_gated: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    host_id: hostId,
    host_name: 'Demo Researcher',
    channel: 'Studio',
  };
  devStreams.unshift(stream);
  return stream;
}

export function listDevStreamsByHost(hostId) {
  return devStreams.filter((s) => s.host_id === hostId);
}

export function getDevStreamByRoomSlug(roomSlug) {
  return devStreams.find((s) => s.room_slug === roomSlug) || null;
}

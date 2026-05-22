const crypto = require('crypto');
const adminSessions = require('./adminSessions');

const ADMIN_COOKIE = 'researchium_admin';
const DEV_DEFAULT_SECRET = 'researchium-dev-secret';

function getAdminSecret() {
  return process.env.RESEARCHIUM_ADMIN_SECRET || DEV_DEFAULT_SECRET;
}

/** Login ID (default admin) */
function getAdminUsername() {
  const raw =
    process.env.RESEARCHIUM_ADMIN_USERNAME || process.env.ADMIN_USERNAME || 'admin';
  return String(raw).trim();
}

/** Login password — must be set explicitly (no fallback to admin secret). */
function getAdminPassword() {
  const raw =
    process.env.RESEARCHIUM_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
  return String(raw).trim();
}

function normalizeLoginId(v) {
  return String(v == null ? '' : v).trim().toLowerCase();
}

function normalizePassword(v) {
  return String(v == null ? '' : v).trim();
}

function uniq(arr) {
  return [...new Set(arr)];
}

/**
 * Primary username plus optional comma-separated aliases (RESEARCHIUM_ADMIN_LOGIN_ALIASES).
 * No substring or dash-split matching — prevents "x-admin" style bypasses.
 */
function getAcceptedLoginIds() {
  const primary = normalizeLoginId(getAdminUsername());
  const rawAliases = process.env.RESEARCHIUM_ADMIN_LOGIN_ALIASES || '';
  const aliasList = rawAliases
    .split(',')
    .map((x) => normalizeLoginId(x))
    .filter(Boolean);
  return uniq([primary, ...aliasList].filter(Boolean));
}

function getAcceptedPasswords() {
  return uniq([getAdminPassword()].map(normalizePassword).filter(Boolean));
}

function authenticateAdminCredentials(username, password) {
  const u = normalizeLoginId(username);
  const p = normalizePassword(password);
  if (!u || !p) return false;
  const passwords = getAcceptedPasswords();
  if (!passwords.length) return false;
  const acceptedUsers = getAcceptedLoginIds();
  const okUser = acceptedUsers.some((x) => timingSafeEqual(u, x));
  if (!okUser) return false;
  return passwords.some((x) => timingSafeEqual(p, x));
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function extractBearer(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return '';
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

/** Bearer header (legacy) or httpOnly admin cookie. */
function extractAdminToken(req) {
  const bearer = extractBearer(req);
  if (bearer) return bearer;
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[ADMIN_COOKIE];
  return raw && typeof raw === 'string' ? raw.trim() : '';
}

function adminCookieOptions(token) {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(adminSessions.TTL_MS / 1000)}`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearAdminCookieOptions() {
  const secure = process.env.NODE_ENV === 'production';
  const parts = [`${ADMIN_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/** Requires a valid session from POST /api/admin/login (cookie or Bearer). */
function requireAdmin(req, res, next) {
  const token = extractAdminToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (adminSessions.isValidSession(token)) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = {
  requireAdmin,
  ADMIN_COOKIE,
  getAdminSecret,
  DEV_DEFAULT_SECRET,
  getAdminUsername,
  getAdminPassword,
  getAcceptedLoginIds,
  authenticateAdminCredentials,
  timingSafeEqual,
  extractBearer,
  extractAdminToken,
  adminCookieOptions,
  clearAdminCookieOptions
};

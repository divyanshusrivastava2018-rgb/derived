const crypto = require('crypto');
const adminSessions = require('./adminSessions');

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

/** Requires a valid session token from POST /api/admin/login. */
function requireAdmin(req, res, next) {
  const token = extractBearer(req);
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
  getAdminSecret,
  DEV_DEFAULT_SECRET,
  getAdminUsername,
  getAdminPassword,
  getAcceptedLoginIds,
  authenticateAdminCredentials,
  timingSafeEqual,
  extractBearer
};

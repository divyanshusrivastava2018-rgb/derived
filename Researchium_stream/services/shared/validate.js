const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_ID_RE = /^[a-zA-Z0-9_-]{3,64}$/;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function isRoomId(value) {
  return typeof value === 'string' && ROOM_ID_RE.test(value);
}

export function assertUuid(value, label = 'id') {
  if (!isUuid(value)) {
    const err = new Error(`invalid_${label.replace(/\s+/g, '_')}`);
    err.status = 400;
    throw err;
  }
}

export function assertRoomId(value) {
  if (!isRoomId(value)) {
    const err = new Error('invalid_room');
    err.status = 400;
    throw err;
  }
}

/** Strip control chars; cap length for logs / storage */
export function sanitizeShortText(value, max = 200) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\x00-\x1f\x7f]/g, '').slice(0, max);
}

/** Chat / user-visible text: strip tags and control chars */
export function sanitizeChatBody(value, max = 2000) {
  if (typeof value !== 'string') return '';
  const stripped = value.replace(/<[^>]*>/g, '').replace(/[\x00-\x1f\x7f]/g, '');
  return stripped.trim().slice(0, max);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

export function assertEmail(value) {
  const email = normalizeEmail(value);
  if (!EMAIL_RE.test(email)) {
    const err = new Error('invalid_email');
    err.status = 400;
    throw err;
  }
  return email;
}

export function assertPassword(value, { min = 8, max = 128 } = {}) {
  if (typeof value !== 'string' || value.length < min) {
    const err = new Error('password_too_short');
    err.status = 400;
    throw err;
  }
  if (value.length > max) {
    const err = new Error('password_too_long');
    err.status = 400;
    throw err;
  }
  return value;
}

export function escapeHtml(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

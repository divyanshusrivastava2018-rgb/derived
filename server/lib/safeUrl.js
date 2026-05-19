/**
 * Reject javascript:, data:, and protocol-relative URLs for stored link fields.
 */

function isSafeHttpUrl(s) {
  if (!s || typeof s !== 'string') return false;
  let u;
  try {
    u = new URL(s.trim());
  } catch {
    return false;
  }
  return u.protocol === 'https:' || u.protocol === 'http:';
}

/** Relative site paths or http(s) URLs only. */
function isSafePublicHref(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  if (!t) return false;
  if (t.startsWith('/')) {
    return !t.startsWith('//') && !t.includes('\\');
  }
  return isSafeHttpUrl(t);
}

module.exports = { isSafeHttpUrl, isSafePublicHref };

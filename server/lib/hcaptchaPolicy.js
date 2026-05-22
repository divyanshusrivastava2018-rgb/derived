/**
 * hCaptcha policy for public forms (contact, leads, doubts).
 * - Production: HCAPTCHA_SECRET_KEY required (enforced in server/index.js).
 * - Development: set ALLOW_CONTACT_WITHOUT_CAPTCHA=1 to skip verification locally.
 */

function secret() {
  return (process.env.HCAPTCHA_SECRET_KEY || '').trim();
}

function allowBypass() {
  return process.env.ALLOW_CONTACT_WITHOUT_CAPTCHA === '1';
}

function isConfigured() {
  return Boolean(secret()) || allowBypass();
}

function assertFormsEnabled(res) {
  if (secret()) return true;
  if (allowBypass()) return true;
  res.status(503).json({
    error:
      'Forms are disabled until HCAPTCHA_SECRET_KEY is set, or ALLOW_CONTACT_WITHOUT_CAPTCHA=1 for local development.'
  });
  return false;
}

async function verifyToken(token) {
  const s = secret();
  if (!s) {
    return allowBypass();
  }
  if (!token) return false;
  const params = new URLSearchParams({ secret: s, response: String(token) });
  const res = await fetch('https://hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const data = await res.json();
  return Boolean(data && data.success);
}

async function enforce(body, res) {
  if (!assertFormsEnabled(res)) return false;
  if (!secret() && allowBypass()) return true;
  const token = (body && (body.hcaptchaToken || body['h-captcha-response'])) || '';
  const ok = await verifyToken(token);
  if (!ok) {
    res.status(400).json({ error: 'Please complete the captcha verification.' });
    return false;
  }
  return true;
}

module.exports = {
  secret,
  allowBypass,
  isConfigured,
  assertFormsEnabled,
  verifyToken,
  enforce
};

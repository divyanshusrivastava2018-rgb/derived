/**
 * Obfuscates GATE answer keys for optional offline bundle (not cryptographic secrecy).
 * Real exam integrity requires server-side scoring via /api/mcq/gate.
 */
const DEFAULT_PEPPER = 'researchium-gate-bundle-v1';

function pepper() {
  return String(process.env.GATE_OFFLINE_BUNDLE_PEPPER || DEFAULT_PEPPER).trim();
}

function paperKey(slug) {
  const s = `${pepper()}:${String(slug)}`;
  const out = Buffer.alloc(32);
  for (let i = 0; i < 32; i += 1) {
    out[i] = s.charCodeAt(i % s.length) ^ ((i * 31) & 255);
  }
  return out;
}

function encodeAnswers(slug, answerKey) {
  const entries = Object.entries(answerKey || {}).map(([qid, idx]) => [qid, idx]);
  const buf = Buffer.from(JSON.stringify(entries), 'utf8');
  const key = paperKey(slug);
  for (let i = 0; i < buf.length; i += 1) {
    buf[i] ^= key[i % key.length];
  }
  return buf.toString('base64url');
}

function decodeAnswers(slug, enc) {
  if (!enc || typeof enc !== 'string') return {};
  const key = paperKey(slug);
  const buf = Buffer.from(enc, 'base64url');
  for (let i = 0; i < buf.length; i += 1) {
    buf[i] ^= key[i % key.length];
  }
  let entries;
  try {
    entries = JSON.parse(buf.toString('utf8'));
  } catch {
    return {};
  }
  if (!Array.isArray(entries)) return {};
  const out = {};
  entries.forEach((pair) => {
    if (Array.isArray(pair) && pair.length >= 2) {
      out[String(pair[0])] = Number(pair[1]);
    }
  });
  return out;
}

module.exports = {
  VERSION: 1,
  encodeAnswers,
  decodeAnswers
};

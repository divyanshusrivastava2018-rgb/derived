const fs = require('fs');

const PRIVATE_MODE = 0o600;

function writeJsonPrivate(filePath, data) {
  const dir = require('path').dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: PRIVATE_MODE });
  try {
    fs.chmodSync(filePath, PRIVATE_MODE);
  } catch {
    /* ignore on platforms without chmod */
  }
}

function readJsonPrivate(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

module.exports = { writeJsonPrivate, readJsonPrivate, PRIVATE_MODE };

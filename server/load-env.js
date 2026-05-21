const fs = require('fs');
const path = require('path');

/** Load project root `.env` (fallback `.env.example`) into process.env (does not override existing vars). */
function loadEnv() {
  try {
    const envCandidates = [
      path.join(__dirname, '..', '.env'),
      path.join(__dirname, '..', '.env.example')
    ];
    for (const envPath of envCandidates) {
      if (!fs.existsSync(envPath)) continue;
      const text = fs.readFileSync(envPath, 'utf8');
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
        let val = line.slice(eq + 1).trim();
        const quoted =
          (val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"));
        if (quoted) {
          val = val.slice(1, -1).trim();
        } else {
          // Strip trailing inline comment only after whitespace (so Div#1234 stays intact).
          const m = val.match(/^(.+?)\s+#(?:\s|$)/);
          if (m) val = m[1].trim();
        }
        val = val.trim();
        if (process.env[key] === undefined) process.env[key] = val;
      }
    }
  } catch (_) {
    /* ignore */
  }
}

module.exports = { loadEnv };

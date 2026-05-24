#!/usr/bin/env node
/**
 * Writes public/data/runtime-config.json for static frontends (GitHub Pages).
 * Set GATE_API_BASE to your Node host, e.g. https://researchium.onrender.com
 */
const fs = require('fs');
const path = require('path');

const outFile = path.join(__dirname, '..', '..', 'public', 'data', 'runtime-config.json');
const gateApiBase = String(process.env.GATE_API_BASE || process.env.RENDER_EXTERNAL_URL || '')
  .trim()
  .replace(/\/$/, '');

const payload = {
  gateApiBase,
  updatedAt: new Date().toISOString()
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log('[runtime-config] gateApiBase:', gateApiBase || '(same-origin only)');

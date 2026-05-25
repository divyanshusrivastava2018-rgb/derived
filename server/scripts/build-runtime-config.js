#!/usr/bin/env node
/**
 * Writes public/data/runtime-config.json for static frontends (GitHub Pages).
 */
const fs = require('fs');
const path = require('path');

const outFile = path.join(__dirname, '..', '..', 'public', 'data', 'runtime-config.json');
const gateApiBase = String(process.env.GATE_API_BASE || process.env.RENDER_EXTERNAL_URL || '')
  .trim()
  .replace(/\/$/, '');

function resolveOfflineScoring() {
  if (process.env.GATE_OFFLINE_SCORING === '1') return true;
  if (process.env.GATE_OFFLINE_SCORING === '0') return false;
  if (process.env.NODE_ENV === 'production') return false;
  return !gateApiBase;
}

const offlineScoring = resolveOfflineScoring();

const payload = {
  gateApiBase,
  offlineScoring,
  requireLiveApi: process.env.GATE_REQUIRE_LIVE_API === '1',
  updatedAt: new Date().toISOString()
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log('[runtime-config]', JSON.stringify({ gateApiBase: gateApiBase || '(same-origin)', offlineScoring }));

#!/usr/bin/env node
/**
 * Regenerate public/data/offline-mock-tests.json and offline-gate-papers.json
 * for static / offline GET fallbacks in api-client.js.
 */
const fs = require('fs');
const path = require('path');
const mockTestCatalog = require('../lib/mockTestCatalog');
const gateMcqBank = require('../lib/gateMcqBank');

const outDir = path.join(__dirname, '..', '..', 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'offline-mock-tests.json'),
  JSON.stringify(mockTestCatalog.listMockTests(), null, 2),
  'utf8'
);

fs.writeFileSync(
  path.join(outDir, 'offline-gate-papers.json'),
  JSON.stringify({ papers: gateMcqBank.listPapers() }, null, 2),
  'utf8'
);

const tokens = mockTestCatalog.listMockTests().tokens;
console.log('Wrote offline mock catalog:', tokens.length, 'tokens');

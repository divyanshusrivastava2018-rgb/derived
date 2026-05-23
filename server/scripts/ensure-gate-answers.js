#!/usr/bin/env node
/**
 * Ensure server/data/gate-mcq-answers.json exists (from seed or legacy bank migration).
 * Run on deploy: npm run prepare:gate
 */
const gateMcqBank = require('../lib/gateMcqBank');

const result = gateMcqBank.ensureAnswersFile();
if (!result.ok) {
  console.error(
    '[prepare:gate] Failed — no answer keys. Add gate-mcq-answers.seed.json or migrate:gate-answers.'
  );
  process.exit(1);
}
console.log('[prepare:gate] OK —', result.count, 'keys via', result.source);

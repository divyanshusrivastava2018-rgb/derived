#!/usr/bin/env node
/**
 * One-time: move answerIndex out of gate-mcq-bank.json into server-only gate-mcq-answers.json.
 * Run: node server/scripts/split-gate-mcq-answers.js
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BANK_FILE = path.join(DATA_DIR, 'gate-mcq-bank.json');
const ANSWERS_FILE = path.join(DATA_DIR, 'gate-mcq-answers.json');

function main() {
  const bank = JSON.parse(fs.readFileSync(BANK_FILE, 'utf8'));
  const answers = {};
  const questions = (bank.questions || []).map((q) => {
    if (q && q.id != null && typeof q.answerIndex === 'number') {
      answers[q.id] = q.answerIndex;
    }
    const { answerIndex, ...rest } = q;
    return rest;
  });
  bank.questions = questions;
  fs.writeFileSync(BANK_FILE, JSON.stringify(bank, null, 2), 'utf8');
  fs.writeFileSync(ANSWERS_FILE, JSON.stringify({ answers }, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(ANSWERS_FILE, 0o600);
  } catch {
    /* ignore */
  }
  console.log('Wrote', Object.keys(answers).length, 'answers to', ANSWERS_FILE);
  console.log('Stripped answerIndex from', BANK_FILE);
}

main();

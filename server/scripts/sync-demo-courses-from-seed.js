/**
 * Sync demo courses (d1, d3, d4, d7) from seed-default.json into server/data/courses.json.
 * Run on the live server after git pull so production matches the repo seed.
 *
 *   node server/scripts/sync-demo-courses-from-seed.js
 *
 * Replace the entire catalog from seed (fresh install):
 *
 *   node server/scripts/sync-demo-courses-from-seed.js --full
 */
const fs = require('fs');
const path = require('path');

const DEMO_IDS = ['d1', 'd3', 'd4', 'd7'];
const DATA_DIR = path.join(__dirname, '..', 'data');
const SEED_FILE = path.join(DATA_DIR, 'seed-default.json');
const COURSES_FILE = path.join(DATA_DIR, 'courses.json');

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data : fallback;
  } catch {
    return fallback;
  }
}

function withTimestamps(seed) {
  const now = Date.now();
  return seed.map((c, i) => ({
    ...c,
    createdAt: c.createdAt && c.createdAt > 0 ? c.createdAt : now - (seed.length - i) * 86400000
  }));
}

function main() {
  const full = process.argv.includes('--full');
  const seed = readJson(SEED_FILE, []);
  if (!seed.length) {
    console.error('seed-default.json is missing or empty.');
    process.exit(1);
  }

  if (full) {
    const courses = withTimestamps(seed);
    fs.writeFileSync(COURSES_FILE, JSON.stringify(courses, null, 2), 'utf8');
    console.log(`Wrote ${courses.length} courses to ${COURSES_FILE} (full seed).`);
    return;
  }

  const demos = seed.filter((c) => DEMO_IDS.includes(c.id));
  if (!demos.length) {
    console.error('No demo courses (d1, d3, d4, d7) found in seed-default.json.');
    process.exit(1);
  }

  let courses = readJson(COURSES_FILE, []);
  const byId = new Map(courses.map((c) => [c.id, c]));

  for (const demo of demos) {
    const prev = byId.get(demo.id);
    byId.set(demo.id, {
      ...demo,
      createdAt: prev && prev.createdAt ? prev.createdAt : demo.createdAt || Date.now()
    });
  }

  courses = Array.from(byId.values());
  fs.writeFileSync(COURSES_FILE, JSON.stringify(courses, null, 2), 'utf8');
  console.log(`Updated demo courses in ${COURSES_FILE}: ${DEMO_IDS.join(', ')}`);
  console.log(`Total courses: ${courses.length}`);
}

main();

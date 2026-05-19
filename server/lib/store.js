const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'courses.json');
const SEED_FILE = path.join(DATA_DIR, 'seed-default.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultSeed() {
  const now = Date.now();
  return [
    { id: 'd1', type: 'youtube', ytId: '2mwpT329K2k', title: 'Complete JEE Physics – Mechanics to Thermodynamics', category: 'JEE / NEET', level: 'Advanced', instructor: 'Motion IIT JEE', lang: 'Hindi', price: 0, duration: '48 hrs', desc: 'Full JEE Physics syllabus covered with problem-solving sessions.', rating: 4.8, students: 12400, thumbUrl: null, fileUrl: null, extUrl: null, createdAt: now - 86400000 * 5 },
    { id: 'd2', type: 'youtube', ytId: 'rfscVS0vtbw', title: 'Python for Beginners – Full Course', category: 'Coding & AI', level: 'Beginner', instructor: 'freeCodeCamp', lang: 'English', price: 0, duration: '4.5 hrs', desc: 'Learn Python programming from scratch with hands-on projects.', rating: 4.9, students: 89000, thumbUrl: null, fileUrl: null, extUrl: null, createdAt: now - 86400000 * 4 },
    { id: 'd3', type: 'youtube', ytId: 'M576WGiDBdQ', title: 'Full Stack Web Development Bootcamp 2024', category: 'Coding & AI', level: 'Intermediate', instructor: 'Traversy Media', lang: 'English', price: 0, duration: '11 hrs', desc: 'Complete web dev course covering HTML, CSS, JS, React and Node.', rating: 4.7, students: 34000, thumbUrl: null, fileUrl: null, extUrl: null, createdAt: now - 86400000 * 3 },
    { id: 'd4', type: 'youtube', ytId: 'GjNp0bBrjmU', title: 'UPSC Prelims GS Paper 1 – Complete Strategy', category: 'UPSC / SSC', level: 'Intermediate', instructor: 'StudyIQ IAS', lang: 'Hindi', price: 0, duration: '6 hrs', desc: 'Comprehensive strategy guide for UPSC CSE Prelims GS Paper 1.', rating: 4.6, students: 21000, thumbUrl: null, fileUrl: null, extUrl: null, createdAt: now - 86400000 * 2 },
    { id: 'd5', type: 'youtube', ytId: 'HXV3zeQKqGY', title: 'SQL Full Course – Database for Beginners', category: 'Coding & AI', level: 'Beginner', instructor: 'freeCodeCamp', lang: 'English', price: 0, duration: '4.2 hrs', desc: 'Learn SQL from scratch — queries, joins, aggregations and more.', rating: 4.8, students: 56000, thumbUrl: null, fileUrl: null, extUrl: null, createdAt: now - 86400000 },
    { id: 'd6', type: 'external', ytId: null, title: 'Research Methodology Masterclass', category: 'Research & Science', level: 'Advanced', instructor: 'Dr. Anika Verma', lang: 'English', price: 2499, duration: '20 hrs', desc: 'In-depth course on research design, statistical analysis and publishing.', rating: 4.9, students: 3200, thumbUrl: null, fileUrl: null, extUrl: 'https://example.com/course', createdAt: now }
  ];
}

function readAll() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    let seed = defaultSeed();
    if (fs.existsSync(SEED_FILE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
        if (Array.isArray(parsed) && parsed.length > 0) seed = parsed;
      } catch {
        seed = defaultSeed();
      }
    }
    const now = Date.now();
    seed = seed.map((c, i) => ({
      ...c,
      createdAt: c.createdAt && c.createdAt > 0 ? c.createdAt : now - (seed.length - i) * 86400000
    }));
    writeAll(seed);
    return seed;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : defaultSeed();
  } catch {
    return defaultSeed();
  }
}

function writeAll(courses) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(courses, null, 2), 'utf8');
}

module.exports = { readAll, writeAll, DATA_FILE };

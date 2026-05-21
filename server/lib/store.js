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
    { id: 'd1', type: 'youtube', ytId: '9jhxdr_qmaM', ytListId: 'PLIowxflsb4xC5P98ChXATyDaGEAPpV4RN', title: 'CHEMISTRY DEMO VIDEO', category: 'JEE / NEET', level: 'Advanced', instructor: 'Researchium', lang: 'Hindi', price: 0, duration: 'Playlist', desc: 'Chemistry demo video series — watch the full YouTube playlist in order.', rating: 4.8, students: 12400, thumbUrl: null, fileUrl: null, extUrl: null, createdAt: now - 86400000 * 6 },
    { id: 'd7', type: 'youtube', ytId: 'yGDeKcdpaLs', ytListId: 'PLIowxflsb4xDrjtyb5ON5AGyRzrWmfuxp', title: 'BIOLOGY DEMO VIDEO', category: 'JEE / NEET', level: 'Advanced', instructor: 'Researchium', lang: 'Hindi', price: 0, duration: 'Playlist', desc: 'Biology demo video series — watch the full YouTube playlist in order.', rating: 4.8, students: 11800, thumbUrl: null, fileUrl: null, extUrl: null, createdAt: now - 86400000 * 5 },
    { id: 'd2', type: 'youtube', ytId: 'rfscVS0vtbw', title: 'Python for Beginners – Full Course', category: 'Coding & AI', level: 'Beginner', instructor: 'freeCodeCamp', lang: 'English', price: 0, duration: '4.5 hrs', desc: 'Learn Python programming from scratch with hands-on projects.', rating: 4.9, students: 89000, thumbUrl: null, fileUrl: null, extUrl: null, createdAt: now - 86400000 * 4 },
    { id: 'd3', type: 'youtube', ytId: 'zwuSJWd-JAM', ytListId: 'PLIowxflsb4xDremjV66Zw4lyNh4zq6o3j', title: 'PHYSICS DEMO VIDEO', category: 'JEE / NEET', level: 'Advanced', instructor: 'Researchium', lang: 'Hindi', price: 0, duration: 'Playlist', desc: 'Physics demo video series — watch the full YouTube playlist in order.', rating: 4.8, students: 11200, thumbUrl: null, fileUrl: null, extUrl: null, createdAt: now - 86400000 * 3 },
    { id: 'd4', type: 'youtube', ytId: 'Wwlu7i2Mygw', ytListId: 'PLIowxflsb4xC5meAS5MW21PHFnqVPokPc', title: 'MATHEMATICS DEMO VIDEO', category: 'JEE / NEET', level: 'Advanced', instructor: 'Researchium', lang: 'Hindi', price: 0, duration: 'Playlist', desc: 'Mathematics demo video series — watch the full YouTube playlist in order.', rating: 4.8, students: 10600, thumbUrl: null, fileUrl: null, extUrl: null, createdAt: now - 86400000 * 2 },
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

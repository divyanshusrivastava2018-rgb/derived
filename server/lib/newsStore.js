const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'news.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultNews() {
  const now = Date.now();
  return [
    {
      id: 'n1',
      title: 'New Research Methodology Workshop Launched',
      content:
        'We are excited to announce a comprehensive workshop on modern research methodologies starting next month. Register from the live classes page.',
      status: 'current',
      date: new Date(now - 2 * 86400000).toISOString(),
      image: ''
    },
    {
      id: 'n2',
      title: 'Researchium Partners with Leading Universities',
      content:
        'Strategic partnerships bring exclusive content, guest lectures, and research opportunities to our students.',
      status: 'current',
      date: new Date(now - 5 * 86400000).toISOString(),
      image: ''
    },
    {
      id: 'n3',
      title: '2024 Research Paper Submission Guidelines Updated',
      content: 'Streamlined submission process and new templates are available in the blog section.',
      status: 'archive',
      date: new Date(now - 30 * 86400000).toISOString(),
      image: ''
    }
  ];
}

function readAll() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    const seed = defaultNews();
    writeAll(seed);
    return seed;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : defaultNews();
  } catch {
    return defaultNews();
  }
}

function writeAll(items) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
}

module.exports = { readAll, writeAll, DATA_FILE };

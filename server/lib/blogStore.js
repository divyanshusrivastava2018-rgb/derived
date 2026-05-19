const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'blog.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultPosts() {
  const now = Date.now();
  return [
    {
      id: 'b1',
      tag: 'LITERATURE REVIEW',
      title: 'Mapping papers without drowning in PDFs',
      excerpt: 'A lightweight workflow: skim matrices, claim charts, and how to know when you have “enough” background.',
      href: '/courses.html',
      order: 0,
      createdAt: now
    },
    {
      id: 'b2',
      tag: 'LIVE SESSION',
      title: 'Why we teach IMRAD in a Saturday lab',
      excerpt: 'Structure mirrors how reviewers read. Join the weekend live walkthrough and bring your draft outline.',
      href: '/live-classes.html',
      order: 1,
      createdAt: now
    },
    {
      id: 'b3',
      tag: 'PRODUCT',
      title: 'Free vs Pro for researchers',
      excerpt: 'When mentor feedback and small-group edits are worth the upgrade — transparent comparison inside.',
      href: '/pricing.html',
      order: 2,
      createdAt: now
    },
    {
      id: 'b4',
      tag: 'ACCOUNT',
      title: 'Save reading lists across devices',
      excerpt: 'Sign in to sync bookmarks between the blog, course notes, and live class handouts.',
      href: '/signin.html',
      order: 3,
      createdAt: now
    }
  ];
}

function readAll() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    const seed = defaultPosts();
    writeAll(seed);
    return seed;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : defaultPosts();
  } catch {
    return defaultPosts();
  }
}

function writeAll(posts) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2), 'utf8');
}

module.exports = { readAll, writeAll, DATA_FILE };

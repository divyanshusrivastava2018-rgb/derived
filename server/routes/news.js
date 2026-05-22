const express = require('express');
const { nanoid } = require('nanoid');
const newsStore = require('../lib/newsStore');
const { requireAdmin } = require('../lib/adminAuth');
const { isSafeHttpUrl } = require('../lib/safeUrl');

const router = express.Router();
const jsonParser = express.json({ limit: '256kb' });

router.get('/', (_req, res) => {
  const items = readAllSorted();
  res.json(items);
});

router.get('/:id', (req, res) => {
  const items = newsStore.readAll();
  const item = items.find((x) => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'News not found' });
  res.json(item);
});

router.post('/', requireAdmin, jsonParser, (req, res) => {
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }
  const status = body.status === 'archive' ? 'archive' : 'current';
  const imageRaw = typeof body.image === 'string' ? body.image.trim() : '';
  if (imageRaw && !isSafeHttpUrl(imageRaw)) {
    return res.status(400).json({ error: 'image must be a valid http(s) URL or empty' });
  }
  const item = {
    id: nanoid(12),
    title,
    content,
    status,
    date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
    image: imageRaw
  };
  const items = newsStore.readAll();
  items.unshift(item);
  newsStore.writeAll(items);
  res.status(201).json(item);
});

router.put('/:id', requireAdmin, jsonParser, (req, res) => {
  const items = newsStore.readAll();
  const idx = items.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'News not found' });
  const body = req.body || {};
  const cur = items[idx];
  const title = body.title !== undefined ? String(body.title).trim() : cur.title;
  const content = body.content !== undefined ? String(body.content).trim() : cur.content;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }
  items[idx] = {
    ...cur,
    title,
    content,
    status: body.status === 'archive' ? 'archive' : body.status === 'current' ? 'current' : cur.status,
    date: body.date ? new Date(body.date).toISOString() : cur.date,
    image:
      body.image !== undefined
        ? (() => {
            const img = String(body.image).trim();
            if (img && !isSafeHttpUrl(img)) return null;
            return img;
          })()
        : cur.image
  };
  if (items[idx].image === null) {
    return res.status(400).json({ error: 'image must be a valid http(s) URL or empty' });
  }
  newsStore.writeAll(items);
  res.json(items[idx]);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const items = newsStore.readAll();
  const idx = items.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'News not found' });
  const [removed] = items.splice(idx, 1);
  newsStore.writeAll(items);
  res.json({ ok: true, id: removed.id });
});

function readAllSorted() {
  return newsStore
    .readAll()
    .slice()
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

module.exports = router;

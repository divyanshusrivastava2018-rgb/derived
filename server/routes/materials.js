const express = require('express');
const { nanoid } = require('nanoid');
const materialsStore = require('../lib/materialsStore');
const { requireAdmin } = require('../lib/adminAuth');
const { isSafePublicHref } = require('../lib/safeUrl');

const router = express.Router();
const jsonParser = express.json({ limit: '128kb' });

router.get('/', (_req, res) => {
  res.json(materialsStore.readAll());
});

router.post('/', requireAdmin, jsonParser, (req, res) => {
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const fileUrl = String(body.fileUrl || '').trim();
  if (!title || !fileUrl) {
    return res.status(400).json({ error: 'Title and file URL are required' });
  }
  if (!isSafePublicHref(fileUrl)) {
    return res.status(400).json({ error: 'fileUrl must be a site path or http(s) URL' });
  }
  const item = { id: nanoid(12), title, fileUrl };
  const items = materialsStore.readAll();
  items.push(item);
  materialsStore.writeAll(items);
  res.status(201).json(item);
});

router.put('/:id', requireAdmin, jsonParser, (req, res) => {
  const items = materialsStore.readAll();
  const idx = items.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Material not found' });
  const body = req.body || {};
  const cur = items[idx];
  const title = body.title !== undefined ? String(body.title).trim() : cur.title;
  const fileUrl = body.fileUrl !== undefined ? String(body.fileUrl).trim() : cur.fileUrl;
  if (!title || !fileUrl) {
    return res.status(400).json({ error: 'Title and file URL are required' });
  }
  if (!isSafePublicHref(fileUrl)) {
    return res.status(400).json({ error: 'fileUrl must be a site path or http(s) URL' });
  }
  items[idx] = { ...cur, title, fileUrl };
  materialsStore.writeAll(items);
  res.json(items[idx]);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const items = materialsStore.readAll();
  const idx = items.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Material not found' });
  const [removed] = items.splice(idx, 1);
  materialsStore.writeAll(items);
  res.json({ ok: true, id: removed.id });
});

module.exports = router;

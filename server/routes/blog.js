const express = require('express');
const { nanoid } = require('nanoid');
const blogStore = require('../lib/blogStore');
const { requireAdmin } = require('../lib/adminAuth');
const { isSafePublicHref } = require('../lib/safeUrl');

const router = express.Router();
const jsonParser = express.json({ limit: '256kb' });

router.get('/', (_req, res) => {
  const posts = blogStore.readAll().slice().sort((a, b) => {
    const oa = a.order ?? 0;
    const ob = b.order ?? 0;
    if (oa !== ob) return oa - ob;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  res.json(posts);
});

router.get('/:id', (req, res) => {
  const posts = blogStore.readAll();
  const p = posts.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Post not found' });
  res.json(p);
});

router.post('/', requireAdmin, jsonParser, (req, res) => {
  const body = req.body || {};
  const title = (body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const tag = (body.tag || 'UPDATE').trim() || 'UPDATE';
  const excerpt = (body.excerpt || '').trim();
  const href = (body.href || '/').trim() || '/';
  if (!isSafePublicHref(href)) {
    return res.status(400).json({ error: 'Invalid href (use a site path or http(s) URL)' });
  }
  const order = Number(body.order);
  const post = {
    id: nanoid(12),
    tag,
    title,
    excerpt,
    href,
    order: Number.isFinite(order) ? order : Date.now(),
    createdAt: Date.now()
  };
  const posts = blogStore.readAll();
  posts.push(post);
  blogStore.writeAll(posts);
  res.status(201).json(post);
});

router.put('/:id', requireAdmin, jsonParser, (req, res) => {
  const posts = blogStore.readAll();
  const idx = posts.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Post not found' });
  const body = req.body || {};
  const cur = posts[idx];
  const title = body.title !== undefined ? String(body.title).trim() : cur.title;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const hrefNext =
    body.href !== undefined ? String(body.href).trim() || cur.href : cur.href;
  if (!isSafePublicHref(hrefNext)) {
    return res.status(400).json({ error: 'Invalid href (use a site path or http(s) URL)' });
  }
  posts[idx] = {
    ...cur,
    title,
    tag: body.tag !== undefined ? String(body.tag).trim() || cur.tag : cur.tag,
    excerpt: body.excerpt !== undefined ? String(body.excerpt).trim() : cur.excerpt,
    href: hrefNext,
    order: body.order !== undefined && Number.isFinite(Number(body.order)) ? Number(body.order) : cur.order
  };
  blogStore.writeAll(posts);
  res.json(posts[idx]);
});

router.delete('/:id', requireAdmin, (req, res) => {
  const posts = blogStore.readAll();
  const idx = posts.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Post not found' });
  const [removed] = posts.splice(idx, 1);
  blogStore.writeAll(posts);
  res.json({ ok: true, id: removed.id });
});

module.exports = router;

const express = require('express');
const blogStore = require('../lib/blogStore');

const router = express.Router();

function escXml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toAbsoluteUrl(base, href) {
  const raw = String(href || '/').trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const normalized = raw.startsWith('/') ? raw : `/${raw}`;
  return `${base}${normalized}`;
}

router.get('/', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const siteUrl = `${baseUrl}/`;
  const feedUrl = `${baseUrl}/rss.xml`;
  const posts = blogStore
    .readAll()
    .slice()
    .sort((a, b) => {
      const oa = a.order ?? 0;
      const ob = b.order ?? 0;
      if (oa !== ob) return oa - ob;
      return (b.createdAt || 0) - (a.createdAt || 0);
    })
    .slice(0, 50);

  const itemsXml = posts
    .map((p) => {
      const title = escXml(p.title || 'Untitled');
      const link = escXml(toAbsoluteUrl(baseUrl, p.href));
      const guid = escXml(p.id || toAbsoluteUrl(baseUrl, p.href));
      const description = escXml(p.excerpt || '');
      const pubDate = new Date(Number(p.createdAt) || Date.now()).toUTCString();
      return [
        '<item>',
        `<title>${title}</title>`,
        `<link>${link}</link>`,
        `<guid isPermaLink="false">${guid}</guid>`,
        `<description>${description}</description>`,
        `<pubDate>${escXml(pubDate)}</pubDate>`,
        '</item>'
      ].join('');
    })
    .join('');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '<channel>',
    '<title>Researchium Blog</title>',
    `<link>${escXml(siteUrl)}</link>`,
    '<description>Practical notes for students crossing into papers, theses, and technical writing.</description>',
    '<language>en-us</language>',
    `<atom:link href="${escXml(feedUrl)}" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom" />`,
    itemsXml,
    '</channel>',
    '</rss>'
  ].join('');

  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(xml);
});

module.exports = router;

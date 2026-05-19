const express = require('express');

const router = express.Router();

const STATIC_PATHS = [
  '/',
  '/about.html',
  '/pricing.html',
  '/courses.html',
  '/watch.html',
  '/live-classes.html',
  '/blog.html',
  '/signin.html',
  '/admin.html',
  '/rss.xml'
];

router.get('/', (req, res) => {
  const base = (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  const urls = STATIC_PATHS.map((p) => {
    return `<url><loc>${base}${p}</loc></url>`;
  }).join('');
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls +
    '</urlset>';
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

module.exports = router;

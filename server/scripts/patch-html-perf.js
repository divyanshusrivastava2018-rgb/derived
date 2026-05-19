/**
 * One-off: faster head + deferred scripts on main marketing pages.
 * node server/scripts/patch-html-perf.js
 */
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', '..', 'public');

const GTAG_BLOCK = /[\s\S]*?<!-- Google tag \(gtag\.js\) -->[\s\S]*?<script defer src="\/js\/gtag-init\.js"><\/script>\s*/i;
const GTAG_BLOCK2 = /[\s\S]*?<!-- Google tag \(gtag\.js\) -->[\s\S]*?<\/script>\s*<script>\s*window\.dataLayer[\s\S]*?<\/script>\s*/i;

const OLD_FONTS =
  /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com" \/>\s*<link[^>]*fonts\.googleapis\.com\/css2\?family=Poppins[^>]*>\s*<link rel="stylesheet" href="\/css\/app\.css" \/>/gi;

const NEW_FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="preload" href="/css/app.css" as="style" />
    <link rel="stylesheet" href="/css/app.css" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" />`;

const FILES = [
  'about.html',
  'pricing.html',
  'signin.html',
  '404.html',
  'why-feature.html',
  'live-classes.html',
  'watch.html',
  'study-materials.html',
  'admin.html'
];

function patchFile(name) {
  const fp = path.join(PUBLIC, name);
  let html = fs.readFileSync(fp, 'utf8');
  let changed = false;

  if (GTAG_BLOCK.test(html)) {
    html = html.replace(GTAG_BLOCK, '');
    changed = true;
  }
  if (GTAG_BLOCK2.test(html)) {
    html = html.replace(GTAG_BLOCK2, '');
    changed = true;
  }

  if (OLD_FONTS.test(html)) {
    html = html.replace(OLD_FONTS, NEW_FONTS);
    changed = true;
  }

  if (!html.includes('site-data.js')) {
    html = html.replace(
      /<script src="\/js\/site-shell\.js"><\/script>/,
      '<script defer src="/js/site-data.js"></script>\n    <script defer src="/js/site-shell.js"></script>'
    );
    html = html.replace(
      /<script defer src="\/js\/site-shell\.js"><\/script>/,
      '<script defer src="/js/site-data.js"></script>\n    <script defer src="/js/site-shell.js"></script>'
    );
    changed = true;
  }

  html = html.replace(/<script src="\/js\//g, '<script defer src="/js/');

  if (!html.includes('gtag-lazy.js') && name !== 'admin.html') {
    html = html.replace(/<\/body>/i, '    <script defer src="/js/gtag-lazy.js"></script>\n  </body>');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(fp, html, 'utf8');
    console.log('patched', name);
  } else {
    console.log('skip', name);
  }
}

FILES.forEach(patchFile);
console.log('done');

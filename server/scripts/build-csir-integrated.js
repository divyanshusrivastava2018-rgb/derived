/**
 * Build integrated public/csir-net.html + public/css/csir-net.css
 * from derived-csir-ugc-net/index.html (body content source).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const srcHtml = path.join(root, 'derived-csir-ugc-net', 'index.html');
const outHtml = path.join(root, 'public', 'csir-net.html');
const outCss = path.join(root, 'public', 'css', 'csir-net.css');

const html = fs.readFileSync(srcHtml, 'utf8');

const styleStart = html.indexOf('<style>');
const styleEnd = html.indexOf('</style>');
if (styleStart < 0 || styleEnd < 0) {
  console.error('Missing <style> in source HTML');
  process.exit(1);
}

let css = html.slice(styleStart + 7, styleEnd);
const navFooterRules =
  /^\s*(nav\s*\{|\.nav-|\.call-bar|footer\s*\{|\.footer-|\.social-btn)[\s\S]*?(?=\n\s*\.|\n\s*@media|\n\s*h1\s*\{|\n\s*\.hero\s*\{)/gm;
css = css
  .replace(navFooterRules, '')
  .replace(/^(\s*)body\s*\{/m, '$1.csir-main {')
  .replace(/^(\s*)html\s*\{[^}]*\}/m, '')
  .replace(/\n\s*\.nav-links \{ display: none; \}\n/, '\n')
  .replace(
    /^\s*\*, \*::before, \*::after \{[\s\S]*?\}/m,
    '.csir-main, .csir-main *, .csir-main *::before, .csir-main *::after { box-sizing: border-box; }'
  );

fs.mkdirSync(path.dirname(outCss), { recursive: true });
fs.writeFileSync(
  outCss,
  '/* CSIR UGC NET landing — scoped inside .csir-main on the main site */\n' +
    '.csir-page { background: #0a0f1e; }\n\n' +
    css.trim() +
    '\n'
);

const start = html.indexOf('<div class="goal-tabs">');
const footerStart = html.indexOf('<footer>');
if (start < 0 || footerStart < 0) {
  console.error('Could not find goal-tabs or footer in source');
  process.exit(1);
}
const aiEnd = html.lastIndexOf('</section>', footerStart);
let mainContent = html.slice(start, aiEnd + '</section>'.length);

mainContent = mainContent
  .replace(/href="#register"/g, 'href="/signin.html"')
  .replace(
    '<a class="goal-tab" href="#plans">Subscription</a>',
    '<a class="goal-tab" href="/pricing.html">Subscription</a>'
  )
  .replace(/with Derived/g, 'with Researchium')
  .replace(/Toppers who trusted <em>Derived<\/em>/, 'Toppers who trusted <em>Researchium</em>')
  .replace(/Derived covers/g, 'Researchium covers')
  .replace(/Derived offers/g, 'Researchium offers')
  .replace(/Derived —/g, 'Researchium —')
  .replace(/Derived doubt/g, 'Researchium doubt')
  .replace(/Derived's/g, "Researchium's");

const integratedHtml = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '  <head>',
  '    <meta charset="UTF-8" />',
  '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '    <title>CSIR UGC NET 2026 Coaching | Live Classes – Researchium</title>',
  '    <meta name="description" content="Crack CSIR UGC NET 2026 with Researchium. Live classes, full syllabus, mock tests and expert educators for NET aspirants." />',
  '    <meta name="robots" content="index, follow" />',
  '    <link rel="canonical" href="https://www.derived.co.in/csir-net.html" />',
  '    <meta property="og:type" content="website" />',
  '    <meta property="og:title" content="CSIR UGC NET 2026 Coaching – Researchium" />',
  '    <meta property="og:description" content="Live CSIR NET classes, full syllabus, mock tests, and expert educators on Researchium." />',
  '    <meta property="og:url" content="https://www.derived.co.in/csir-net.html" />',
  '    <meta property="og:site_name" content="Researchium" />',
  '    <link rel="preconnect" href="https://fonts.googleapis.com" />',
  '    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
  '    <link rel="preload" href="/css/app.css" as="style" />',
  '    <link rel="stylesheet" href="/css/app.css" />',
  '    <link rel="stylesheet" href="/css/csir-net.css" />',
  '    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap" rel="stylesheet" />',
  '  </head>',
  '  <body class="site-page csir-page" data-page="csir">',
  '    <header id="site-header" class="site-header-mount"></header>',
  '    <main class="csir-main">',
  mainContent,
  '    </main>',
  '    <footer class="site-footer site-footer-extended">',
  '      <div id="site-footer-main"></motion>',
  '      <div class="et-container">',
  '        <div class="footer-bar">',
  '          <span>© 2026 Researchium Learning Pvt. Ltd. All rights reserved.</span>',
  '          <div class="footer-bar-links">',
  '            <a href="/about.html">Privacy Policy</a>',
  '            <a href="/about.html">Terms of Service</a>',
  '            <a href="/csir-net.html">CSIR NET</a>',
  '          </div>',
  '        </div>',
  '      </div>',
  '    </footer>',
  '    <script defer src="/js/api-client.js"></script>',
  '    <script defer src="/js/site-shell.js"></script>',
  '    <script defer src="/js/csir-net.js"></script>',
  '  </body>',
  '</html>'
]
  .join('\n')
  .replace(/<\/?motion>/g, (tag) => tag.replace(/motion/g, 'div'));

fs.writeFileSync(outHtml, integratedHtml);

const appSrc = path.join(root, 'public', 'js', 'csir-net.js');
const appDest = path.join(root, 'derived-csir-ugc-net', 'app.js');
fs.copyFileSync(appSrc, appDest);

console.log('Built', path.relative(root, outHtml));
console.log('Built', path.relative(root, outCss));
console.log('Synced', path.relative(root, appDest));

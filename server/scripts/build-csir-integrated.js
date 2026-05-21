/**
 * Build integrated public/csir-net.html from derived-csir-ugc-net/index.html.
 * Premium hero + sections use shared CSS under public/css/.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const srcHtml = path.join(root, 'derived-csir-ugc-net', 'index.html');
const outHtml = path.join(root, 'public', 'csir-net.html');

const html = fs.readFileSync(srcHtml, 'utf8');

const start = html.indexOf('<section class="csir-hero"');
const footerStart = html.indexOf('<footer class="csir-page-footer">');
if (start < 0 || footerStart < 0) {
  console.error('Could not find csir-hero or csir-page-footer in source');
  process.exit(1);
}
const aiEnd = html.lastIndexOf('</section>', footerStart);
const mainContent = html.slice(start, aiEnd + '</section>'.length);

const integratedHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CSIR UGC NET 2026 Coaching | Live Classes – Researchium</title>
    <meta name="description" content="Crack CSIR UGC NET 2026 with Researchium. Expert mentorship, PYQ analysis, AI mock tests, and live doubt solving for all five science streams." />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://www.derived.co.in/csir-net.html" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="CSIR UGC NET 2026 Coaching – Researchium" />
    <meta property="og:description" content="Live CSIR NET classes, PYQ analysis, mock tests, and expert mentorship on Researchium." />
    <meta property="og:url" content="https://www.derived.co.in/csir-net.html" />
    <meta property="og:site_name" content="Researchium" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Poppins:wght@500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="preload" href="/css/app.css" as="style" />
    <link rel="stylesheet" href="/css/app.css" />
    <link rel="stylesheet" href="/css/csir-premium-hero.css" />
    <link rel="stylesheet" href="/css/csir-net-sections.css" />
  </head>
  <body class="site-page csir-page" data-page="csir">
    <header id="site-header" class="site-header-mount"></header>
    <main class="csir-main">
${mainContent}
    </main>
    <footer class="site-footer site-footer-extended">
      <div id="site-footer-main"></div>
      <div class="et-container">
        <motion class="footer-bar">
          <span>© 2026 Researchium Learning Pvt. Ltd. All rights reserved.</span>
          <div class="footer-bar-links">
            <a href="/about.html">Privacy Policy</a>
            <a href="/about.html">Terms of Service</a>
            <a href="/csir-net.html">CSIR NET</a>
          </div>
        </div>
      </div>
    </footer>
    <script defer src="/js/api-client.js"></script>
    <script defer src="/js/site-shell.js"></script>
    <script defer src="/js/csir-net.js"></script>
  </body>
</html>`;

fs.writeFileSync(outHtml, integratedHtml.replace(/motion/g, 'div'));

const appSrc = path.join(root, 'public', 'js', 'csir-net.js');
const appDest = path.join(root, 'derived-csir-ugc-net', 'app.js');
fs.copyFileSync(appSrc, appDest);

console.log('Built', path.relative(root, outHtml));
console.log('Synced', path.relative(root, appDest));

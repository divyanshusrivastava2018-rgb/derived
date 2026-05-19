const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', '..', 'derived-csir-ugc-net', 'index.html');

let html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('<section class="section plans-section" id="plans">');
const end = html.indexOf('<section class="section" id="faq"');
if (start < 0 || end < 0) {
  console.error('Could not find plans or success section');
  process.exit(1);
}
html = html.slice(0, start) + html.slice(end);
html = html.replace(/href="#plans"/g, 'href="/pricing.html"');
html = html.replace(/<li><a href="\/pricing\.html">Plans<\/a><\/li>\s*/g, '');
html = html.replace(/\s*<a class="goal-tab" href="\/pricing\.html">Subscription<\/a>\s*/g, '\n');
html = html.replace(/\s*<a class="goal-tab" href="#plans">Subscription<\/a>\s*/g, '\n');
fs.writeFileSync(htmlPath, html);
console.log('Removed plans section from', htmlPath);

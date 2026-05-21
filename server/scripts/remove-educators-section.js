const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const htmlPath = path.join(root, 'derived-csir-ugc-net', 'index.html');

let html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('<section class="section" id="educators">');
const end = html.indexOf('<section class="section plans-section" id="plans">');
if (start < 0 || end < 0) {
  console.error('Could not find educators or plans section');
  process.exit(1);
}
html = html.slice(0, start) + html.slice(end);
html = html.replace(/href="#educators"/g, 'href="#features"');
html = html.replace(
  /<a href="#educators" style="color:var\(--accent\)">live classes<\/a>/,
  '<a href="/live-classes.html" style="color:var(--accent)">live classes</a>'
);
fs.writeFileSync(htmlPath, html);
console.log('Removed educators section from', htmlPath);

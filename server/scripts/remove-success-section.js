const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', '..', 'derived-csir-ugc-net', 'index.html');

let html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('<section class="section" id="success">');
const end = html.indexOf('<section class="section" id="faq"');
if (start < 0 || end < 0) {
  console.error('Could not find success or faq section');
  process.exit(1);
}
html = html.slice(0, start) + html.slice(end);
html = html.replace(/\s*<a class="goal-tab" href="#success">Success stories<\/a>\s*/g, '\n');
fs.writeFileSync(htmlPath, html);
console.log('Removed success stories section from', htmlPath);

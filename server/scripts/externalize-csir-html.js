const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const htmlPath = path.join(root, 'derived-csir-ugc-net', 'index.html');
const appJsSrc = path.join(root, 'public', 'js', 'csir-net.js');
const appJsDest = path.join(root, 'derived-csir-ugc-net', 'app.js');

let html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('<script>');
const scriptEnd = html.lastIndexOf('</script>');
const end = html.indexOf('</body>', scriptEnd);
if (start < 0 || scriptEnd < 0 || end < 0) {
  console.error('Could not find inline script markers');
  process.exit(1);
}
html =
  html.slice(0, start) +
  '<script defer src="app.js"></script>' +
  html.slice(end);
html = html.replace('<body>', '<body data-csir-standalone="true">');
fs.writeFileSync(htmlPath, html);
fs.copyFileSync(appJsSrc, appJsDest);
console.log('externalized CSIR HTML, size', fs.statSync(htmlPath).size);

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '..', 'public', 'js', 'csir-net.js');
let js = fs.readFileSync(file, 'utf8');
const start = js.indexOf('  function loadEducators() {');
const end = js.indexOf('  function loadPlans() {');
if (start < 0 || end < 0) {
  console.error('loadEducators block not found');
  process.exit(1);
}
js = js.slice(0, start) + js.slice(end);
js = js.replace(/\s*loadEducators\(\),\n/, '\n');
fs.writeFileSync(file, js);
fs.copyFileSync(file, path.join(__dirname, '..', '..', 'derived-csir-ugc-net', 'app.js'));
console.log('Removed loadEducators from csir-net.js');

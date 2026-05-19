const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '..', 'public', 'js', 'csir-net.js');
let js = fs.readFileSync(file, 'utf8');

const loadPlansStart = js.indexOf('  function loadPlans() {');
const loadPlansEnd = js.indexOf('  function loadTestimonials() {');
if (loadPlansStart < 0 || loadPlansEnd < 0) {
  console.error('loadPlans block not found');
  process.exit(1);
}
js = js.slice(0, loadPlansStart) + js.slice(loadPlansEnd);

const bindStart = js.indexOf('  function bindPlanSubscribe() {');
const bindEnd = js.indexOf('  bindLeadForm();');
if (bindStart >= 0 && bindEnd > bindStart) {
  js = js.slice(0, bindStart) + js.slice(bindEnd);
}

js = js.replace(/\s*loadPlans\(\),\n/, '\n');
js = js.replace(/\)\.then\(bindPlanSubscribe\);\n/, ');\n');
js = js.replace(/\s*loadPlans\(\),\n/, '\n');
js = js.replace('        "/pricing.html": "#plans",\n', '        "/pricing.html": "/pricing.html",\n');

const planCtaStart = js.indexOf('  function planCta(plan) {');
const planCtaEnd = js.indexOf('  function esc(s) {');
if (planCtaStart >= 0 && planCtaEnd > planCtaStart) {
  js = js.slice(0, planCtaStart) + js.slice(planCtaEnd);
}

fs.writeFileSync(file, js);
fs.copyFileSync(file, path.join(__dirname, '..', '..', 'derived-csir-ugc-net', 'app.js'));
console.log('Removed loadPlans from csir-net.js');

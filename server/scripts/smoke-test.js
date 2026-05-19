/**
 * HTTP smoke tests — starts the app on a random port, hits APIs, exits non-zero on failure.
 * Run: node server/scripts/smoke-test.js
 */
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PORT = Number(process.env.SMOKE_PORT) || 38447 + Math.floor(Math.random() * 1000);

function req(method, urlPath, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, `http://127.0.0.1:${PORT}`);
    const opt = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: { ...headers }
    };
    if (body != null) {
      const raw = typeof body === 'string' ? body : JSON.stringify(body);
      opt.headers['Content-Type'] = 'application/json';
      opt.headers['Content-Length'] = Buffer.byteLength(raw);
      const r = http.request(opt, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          let json = null;
          try {
            json = d ? JSON.parse(d) : null;
          } catch {
            /* text/html etc. */
          }
          resolve({ status: res.statusCode, json, text: d });
        });
      });
      r.on('error', reject);
      r.write(raw);
      r.end();
    } else {
      http
        .request(opt, (res) => {
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => {
            let json = null;
            try {
              json = d ? JSON.parse(d) : null;
            } catch {
              /* ok */
            }
            resolve({ status: res.statusCode, json, text: d });
          });
        })
        .on('error', reject)
        .end();
    }
  });
}

async function waitForServer(maxMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    try {
      const res = await req('GET', '/healthz');
      if (res.status === 200 && res.json && res.json.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server did not become ready in time');
}

async function main() {
  const env = {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'development',
    RESEARCHIUM_ADMIN_USERNAME: 'smoke_admin',
    RESEARCHIUM_ADMIN_PASSWORD: 'smoke_pass_9',
    RESEARCHIUM_MEMBER_SECRET: 'smoke_member_secret_9'
  };
  delete env.SMOKE_PORT;

  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderr = '';
  let stdout = '';
  child.stderr.on('data', (c) => (stderr += c));
  child.stdout.on('data', (c) => (stdout += c));

  const fail = (msg) => {
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    if (stderr.trim()) console.error(stderr.trim());
    if (stdout.trim()) console.error(stdout.trim());
    console.error('FAIL:', msg);
    process.exit(1);
  };

  let serverExited = false;
  child.on('exit', (code) => {
    if (serverExited) return;
    if (code != null && code !== 0) {
      fail(`server exited with code ${code}`);
    }
  });

  try {
    await waitForServer();
  } catch (e) {
    fail(e.message || String(e));
  }

  try {
    let res;

    res = await req('GET', '/api/courses');
    if (res.status !== 200 || !Array.isArray(res.json)) {
      fail(`/api/courses expected 200 + array, got ${res.status}`);
    }

    res = await req('GET', '/api/home/summary');
    if (res.status !== 200 || !res.json || typeof res.json.learnerCount !== 'number') {
      fail(`/api/home/summary expected 200 + learnerCount`);
    }

    res = await req('GET', '/');
    if (res.status !== 200 || !res.text.includes('etCoursesGrid') || !res.text.includes('home-eduthink.js')) {
      fail(`/ should serve Eduthink homepage`);
    }

    res = await req('POST', '/api/member/interest', {
      body: { email: `interest-${Date.now()}@example.com`, source: 'smoke' }
    });
    if (res.status !== 201 && res.status !== 200) {
      fail(`POST /api/member/interest should succeed, got ${res.status}`);
    }

    res = await req('GET', '/api/site');
    if (res.status !== 200 || !res.json || !res.json.youtubePlaylist) {
      fail(`/api/site expected 200 + site object`);
    }

    res = await req('GET', '/api/blog');
    if (res.status !== 200 || !Array.isArray(res.json)) {
      fail(`/api/blog expected 200 + array`);
    }

    res = await req('GET', '/rss.xml');
    if (res.status !== 200 || typeof res.text !== 'string' || !res.text.includes('<rss version="2.0">')) {
      fail(`/rss.xml expected 200 + rss xml`);
    }

    res = await req('GET', '/api/youtube/oembed?v=dQw4w9WgXcQ');
    if (res.status !== 200 || !res.json || typeof res.json.title !== 'string') {
      fail(`/api/youtube/oembed expected 200 + title`);
    }

    res = await req('GET', '/api/why');
    if (res.status !== 200 || !Array.isArray(res.json) || res.json.length === 0) {
      fail(`/api/why expected 200 + non-empty array`);
    }

    res = await req('GET', '/api/why/catalog');
    if (res.status !== 200 || !res.json || res.json.slug !== 'catalog') {
      fail(`/api/why/catalog expected 200 + catalog object`);
    }

    res = await req('GET', '/api/mcq/topics');
    if (res.status !== 200 || !res.json || !Array.isArray(res.json.topics) || res.json.topics.length === 0) {
      fail(`/api/mcq/topics expected 200 + topics`);
    }

    res = await req('POST', '/api/mcq/generate', {
      body: { topic: 'JEE / NEET', count: 5 }
    });
    if (res.status !== 200 || !res.json || !Array.isArray(res.json.questions) || !res.json.testId) {
      fail(`/api/mcq/generate expected testId + questions`);
    }
    if ('answerIndex' in (res.json.questions[0] || {})) {
      fail(`/api/mcq/generate must not expose answerIndex`);
    }
    const testId = res.json.testId;
    const answers = (res.json.questions || []).map(() => 0);
    res = await req('POST', '/api/mcq/submit', {
      body: { testId, answers }
    });
    if (res.status !== 200 || !res.json || typeof res.json.score !== 'number') {
      fail(`/api/mcq/submit expected score response`);
    }

    res = await req('POST', '/api/admin/login', {
      body: { username: 'wrong', password: 'wrong' }
    });
    if (res.status !== 401) {
      fail(`login with bad creds should be 401, got ${res.status}`);
    }

    res = await req('POST', '/api/admin/login', {
      body: { username: 'not-smoke_admin', password: 'smoke_pass_9' }
    });
    if (res.status !== 401) {
      fail(`login with suffix trick username must be 401, got ${res.status}`);
    }

    res = await req('POST', '/api/admin/login', {
      body: { username: 'smoke_admin', password: 'smoke_pass_9' }
    });
    if (res.status !== 200 || !res.json || !res.json.token) {
      fail(`login with good creds should return token`);
    }
    const token = res.json.token;

    res = await req('GET', '/api/admin/session', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status !== 200 || !res.json || res.json.ok !== true) {
      fail(`/api/admin/session should be 200 { ok: true }`);
    }

    res = await req('POST', '/api/blog', {
      body: { title: 'Smoke', tag: 'T', excerpt: 'e', href: '/' }
    });
    if (res.status !== 401) {
      fail(`unauthenticated POST /api/blog should be 401, got ${res.status}`);
    }

    res = await req('GET', '/admin.html');
    if (res.status !== 200 || !res.text.includes('adminLoginForm')) {
      fail(`/admin.html should be served`);
    }

    res = await req('GET', '/csir-admin.html');
    if (res.status !== 200 || !res.text.includes('csirAdminLoginForm')) {
      fail(`/csir-admin.html should be served`);
    }

    res = await req('GET', '/mcq-test.html');
    if (res.status !== 200 || !res.text.includes('btnGenerateMcq')) {
      fail(`/mcq-test.html should be served`);
    }

    res = await req('GET', '/api/news');
    if (res.status !== 200 || !Array.isArray(res.json)) {
      fail(`/api/news expected 200 + array`);
    }

    res = await req('GET', '/api/materials');
    if (res.status !== 200 || !Array.isArray(res.json)) {
      fail(`/api/materials expected 200 + array`);
    }

    res = await req('GET', '/blog.html');
    if (res.status !== 200 || !res.text.includes('blog-page.js')) {
      fail(`/blog.html should load blog-page.js`);
    }

    res = await req('GET', '/study-materials.html');
    if (res.status !== 200 || !res.text.includes('materials-page.js')) {
      fail(`/study-materials.html should load materials-page.js`);
    }

    res = await req('GET', '/courses.html');
    if (res.status !== 200 || !res.text.includes('courses-app.js')) {
      fail(`/courses.html should load courses-app.js`);
    }

    res = await req('GET', '/csir-net.html');
    if (res.status !== 200 || !res.text.includes('csir-net.js')) {
      fail(`/csir-net.html should load csir-net.js`);
    }

    res = await req('GET', '/api/health');
    if (res.status !== 200 || res.json.status !== 'ok') {
      fail(`/api/health should return ok`);
    }

    res = await req('GET', '/api/subjects');
    if (res.status !== 200 || !Array.isArray(res.json) || res.json.length < 5) {
      fail(`/api/subjects should return subject list`);
    }

    res = await req('GET', '/api/plans');
    if (res.status !== 200 || !Array.isArray(res.json) || !res.json.find((p) => p.id === 'plus')) {
      fail(`/api/plans should include plus plan`);
    }

    res = await req('POST', '/api/contact', {
      body: {
        name: 'Smoke Test',
        email: `smoke-${Date.now()}@example.com`,
        subject: 'General inquiry',
        message: 'Smoke test contact message for Researchium.',
        privacyAccepted: true
      }
    });
    if (res.status !== 201 || !res.json.contact) {
      fail(`POST /api/contact should create a contact entry`);
    }

    res = await req('GET', '/api/admin/csir-leads', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status !== 200 || !Array.isArray(res.json)) {
      fail(`/api/admin/csir-leads should return array for admin`);
    }

    res = await req('POST', '/api/doubts', { body: { question: 'What is JRF?' } });
    if (res.status !== 200 || !res.json.answer) {
      fail(`POST /api/doubts should return an answer`);
    }

    res = await req('GET', '/why-feature.html?slug=catalog');
    if (res.status !== 200 || !res.text.includes('whyFeatureDetails')) {
      fail(`/why-feature.html should be served`);
    }

    res = await req('DELETE', '/api/courses', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status !== 403) {
      fail(`DELETE /api/courses without confirm header should be 403, got ${res.status}`);
    }

    res = await req('DELETE', '/api/courses', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Researchium-Confirm': 'purge-all-courses'
      }
    });
    if (res.status !== 200 || !res.json || res.json.ok !== true) {
      fail(`DELETE /api/courses with confirm header should clear catalog`);
    }

    res = await req('GET', '/api/courses');
    if (res.status !== 200 || !Array.isArray(res.json) || res.json.length !== 0) {
      fail(`/api/courses should be empty after purge`);
    }
  } catch (e) {
    fail(e.message || String(e));
  }

  serverExited = true;
  child.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 200));
  console.log('OK — smoke tests passed on port', PORT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

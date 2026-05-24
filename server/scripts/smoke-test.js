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
          resolve({ status: res.statusCode, json, text: d, headers: res.headers });
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
            resolve({ status: res.statusCode, json, text: d, headers: res.headers });
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
    RESEARCHIUM_MEMBER_SECRET: 'smoke_member_secret_9',
    ALLOW_CONTACT_WITHOUT_CAPTCHA: '1'
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

    res = await req('GET', '/api/platform/overview');
    if (res.status !== 200 || !res.json || !Array.isArray(res.json.features) || res.json.features.length < 1) {
      fail(`/api/platform/overview expected features array`);
    }

    res = await req('POST', '/api/platform/progress', {
      body: {
        learnerId: 'lr_smoke_test_12345678',
        type: 'quiz_submit',
        label: 'Smoke quiz'
      }
    });
    if (res.status !== 201 || !res.json || !res.json.ok) {
      fail(`POST /api/platform/progress should succeed`);
    }

    res = await req('GET', '/');
    if (res.status !== 200 || !res.text.includes('home-platform.js') || !res.text.includes('Researchium')) {
      fail(`/ should serve Researchium homepage`);
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
    if (res.status === 200 && res.json && typeof res.json.title === 'string') {
      /* ok */
    } else if (res.status >= 500 || res.status === 502) {
      console.warn('SKIP: /api/youtube/oembed (YouTube unreachable in this environment)');
    } else {
      fail(`/api/youtube/oembed expected 200 + title, got ${res.status}`);
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
    if (!Array.isArray(res.json.review) || res.json.review.length === 0) {
      fail(`/api/mcq/submit should include review[] for analysis page`);
    }
    if ('answerIndex' in (res.json.review[0] || {})) {
      fail(`/api/mcq/submit review must not expose answerIndex field name`);
    }

    res = await req('GET', '/api/mcq/mock-tests');
    if (res.status !== 200 || !res.json || !Array.isArray(res.json.tokens) || res.json.tokens.length === 0) {
      fail(`/api/mcq/mock-tests expected tokens`);
    }

    res = await req('GET', '/api/mcq/gate/healthz');
    if (res.status !== 200 || !res.json || res.json.ok !== true) {
      fail(`/api/mcq/gate/healthz expected ok`);
    }

    res = await req('POST', '/api/mcq/gate/paper/2018/start', { body: {} });
    if (res.status !== 200 || !res.json || !res.json.sessionId) {
      fail(`GATE start should return sessionId`);
    }
    const gateSession = res.json.sessionId;
    const gateResponses = {};
    (res.json.paper.sections || []).forEach((sec) => {
      (sec.questions || []).forEach((q) => {
        gateResponses[q.id] = -1;
      });
    });
    res = await req('POST', '/api/mcq/gate/paper/2018/submit', {
      body: { sessionId: gateSession, responses: gateResponses }
    });
    if (res.status !== 200 || !res.json || typeof res.json.score !== 'number') {
      fail(`GATE submit expected score`);
    }
    if (!res.json.reviewToken || typeof res.json.reviewToken !== 'string') {
      fail(`GATE submit should return reviewToken`);
    }
    const gateReviewToken = res.json.reviewToken;
    if (!Array.isArray(res.json.review) || res.json.review.length < 1) {
      fail(`GATE submit should include review[]`);
    }
    if (!Array.isArray(res.json.sections) || res.json.sections.length < 1) {
      fail(`GATE submit should include sections[]`);
    }
    const firstReview = res.json.review[0] || {};
    if (!firstReview.explanation || !Array.isArray(firstReview.optionExplanations)) {
      fail(`GATE review should include explanation and optionExplanations[]`);
    }
    if (typeof firstReview.solutionSource !== 'string') {
      fail(`GATE review should include solutionSource`);
    }

    res = await req('POST', '/api/mcq/gate/paper/2018/solve-question', {
      body: { questionId: firstReview.id }
    });
    if (res.status !== 403) {
      fail(`GATE solve-question without reviewToken should return 403`);
    }

    res = await req('POST', '/api/mcq/gate/paper/2018/solve-question', {
      body: { questionId: firstReview.id, reviewToken: gateReviewToken, difficulty: 'brief' }
    });
    if (res.status !== 200 || !res.json || !res.json.ok || !res.json.explanation) {
      fail(`GATE solve-question should return ok and explanation`);
    }

    res = await req('POST', '/api/mcq/gate/paper/2018/solve-question', {
      body: { questionId: firstReview.id, reviewToken: gateReviewToken, difficulty: 'not-a-valid-mode' }
    });
    if (res.status !== 200 || !res.json || !res.json.ok) {
      fail(`GATE solve-question should accept invalid difficulty by falling back to standard`);
    }

    res = await req('POST', '/api/mcq/gate/paper/2018/start', { body: {} });
    const gateResponses2 = {};
    (res.json.paper.sections || []).forEach((sec) => {
      (sec.questions || []).forEach((q) => {
        gateResponses2[q.id] = -1;
      });
    });
    res = await req('POST', '/api/mcq/gate/paper/2018/submit', {
      body: { sessionId: 'expired-fake-session', responses: gateResponses2 }
    });
    if (res.status !== 200 || typeof res.json.score !== 'number') {
      fail(`GATE submit should score without valid session in development (stateless fallback)`);
    }

    res = await req('POST', '/api/mcq/gate/paper/2018/start', { body: {} });
    if (res.status !== 200 || !res.json.sessionId) {
      fail(`GATE start for response validation should return sessionId`);
    }
    const validateSession = res.json.sessionId;
    const validateResponses = {};
    (res.json.paper.sections || []).forEach((sec) => {
      (sec.questions || []).forEach((q) => {
        validateResponses[q.id] = -1;
      });
    });
    res = await req('POST', '/api/mcq/gate/paper/2018/submit', {
      body: {
        sessionId: validateSession,
        responses: Object.assign({}, validateResponses, { fakeQuestionId: 0, ma1: 99 })
      }
    });
    if (res.status !== 200 || typeof res.json.score !== 'number') {
      fail(`GATE submit should ignore unknown response keys`);
    }

    res = await req('GET', '/mock-analysis.html');
    if (res.status !== 200 || !res.text.includes('mock-analysis.js')) {
      fail(`/mock-analysis.html should be served`);
    }

    res = await req('GET', '/gate-exam.html');
    if (res.status !== 200 || !res.text.includes('gate-exam-submit.js')) {
      fail(`/gate-exam.html should load gate-exam-submit.js`);
    }
    if (!res.text.includes('gate-exam-solution.js')) {
      fail(`/gate-exam.html should load gate-exam-solution.js`);
    }
    if (res.text.includes('id="solutionPanel"')) {
      fail(`/gate-exam.html should not embed inline solutions panel`);
    }
    if (!res.text.includes('btnOpenSolutions')) {
      fail(`/gate-exam.html should link to dedicated solutions page`);
    }

    res = await req('GET', '/gate-solutions.html');
    if (res.status !== 200 || !res.text.includes('gate-solutions.js')) {
      fail(`/gate-solutions.html should load gate-solutions.js`);
    }
    if (!res.text.includes('gate-exam-solution.js')) {
      fail(`/gate-solutions.html should load gate-exam-solution.js`);
    }

    res = await req('GET', '/data/gate-score-bundle.json');
    if (res.status !== 200 || !res.json || !res.json.papers || !res.json.papers['2018']) {
      fail(`/data/gate-score-bundle.json should include paper 2018 for offline scoring`);
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
    if (res.status !== 200 || !res.json || !res.json.ok) {
      fail(`login with good creds should return ok (cookie session)`);
    }
    const setCookie = res.headers && res.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie)
      ? setCookie.map((c) => c.split(';')[0]).join('; ')
      : setCookie
        ? String(setCookie).split(';')[0]
        : '';
    if (!cookieHeader || !cookieHeader.includes('researchium_admin')) {
      fail(`login should set researchium_admin httpOnly cookie`);
    }

    res = await req('GET', '/api/admin/session', {
      headers: { Cookie: cookieHeader }
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
      headers: { Cookie: cookieHeader }
    });
    if (res.status !== 200 || !Array.isArray(res.json)) {
      fail(`/api/admin/csir-leads should return array for admin`);
    }

    res = await req('GET', '/api/admin/dashboard', {
      headers: { Cookie: cookieHeader }
    });
    if (res.status !== 200 || !res.json || !res.json.stats || typeof res.json.stats.courses !== 'number') {
      fail(`/api/admin/dashboard should return stats for admin`);
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
      headers: { Cookie: cookieHeader }
    });
    if (res.status !== 403) {
      fail(`DELETE /api/courses without confirm header should be 403, got ${res.status}`);
    }

    res = await req('DELETE', '/api/courses', {
      headers: {
        Cookie: cookieHeader,
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

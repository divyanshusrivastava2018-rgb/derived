/**
 * electron-bridge.js
 * Drop this <script src="/js/electron-bridge.js"></script> in every page
 * (before closing </body>) to unlock Electron features when the site
 * is loaded inside the desktop app.
 *
 * In a normal browser window.researchiumApp is undefined,
 * so every check here is a safe no-op.
 */

(function () {
  'use strict';

  const app = window.researchiumApp; // injected by preload.js, or undefined in browser
  if (!app) return;                  // running in browser → nothing to do

  // ── 1. Badge the page so CSS / other JS can adapt ──────────────────────────
  document.documentElement.classList.add('is-electron');

  // ── 2. Show app version in footer ─────────────────────────────────────────
  app.getInfo().then(({ name, version, platform }) => {
    const footer = document.querySelector('.footer-bottom p');
    if (footer) {
      footer.textContent += ` · Desktop v${version} (${platform})`;
    }
  });

  // ── 3. Make every external link open in the OS browser ───────────────────
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      const url = new URL(href, location.href);
      if (url.hostname !== location.hostname) {
        e.preventDefault();
        app.openExternal(href);
      }
    }
  });

  // ── 4. Internal nav pill → use Electron navigate (instant, no full reload) ─
  document.querySelectorAll('.program-pill[href], .btn-gold[href], .btn-ghost[href]').forEach((link) => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('/') && !href.startsWith('//')) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        app.navigate(href);
      });
    }
  });

  // ── 5. Native OS notification when MCQ test finishes ─────────────────────
  //    Dispatch a custom event from mcq-test.js: new CustomEvent('mcq:done', { detail: { score } })
  document.addEventListener('mcq:done', (e) => {
    const score = e.detail?.score ?? '';
    app.notify('MCQ Complete 🎉', `You scored ${score}. Keep practising!`);
  });

  // ── 6. Native OS notification for live class reminder ────────────────────
  //    Dispatch from live-schedule.js: new CustomEvent('live:starting', { detail: { title } })
  document.addEventListener('live:starting', (e) => {
    const title = e.detail?.title ?? 'Live class';
    app.notify('Class starting now', `"${title}" is about to begin!`);
  });

  console.log('[electron-bridge] Researchium desktop bridge active.');
})();

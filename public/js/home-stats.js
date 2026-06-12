/* Real stats with count-up animation */
(function () {
  'use strict';

  const FALLBACK = { learners: 2500, educators: 7, mocks: 31, pyqYears: 9 };

  function fmt(n) {
    if (n >= 100000) return (n / 100000).toFixed(1).replace('.0', '') + 'L';
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
    return String(n);
  }

  function countUp(el, target, suffix) {
    const dur = 1400;
    const start = performance.now();
    function frame(t) {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.innerHTML =
        fmt(Math.round(target * eased)) + (suffix ? '<span>' + suffix + '</span>' : '');
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function updateExtras(stats) {
    const proof = document.getElementById('rmProofLearners');
    if (proof) proof.textContent = Number(stats.learners).toLocaleString('en-IN') + '+';
    const mocks = document.getElementById('rmGateBannerMocks');
    if (mocks) mocks.textContent = String(stats.mocks);
    const pyq = document.getElementById('rmGateBannerPyq');
    if (pyq) pyq.textContent = String(stats.pyqYears);
  }

  function render(stats) {
    updateExtras(stats);
    document.querySelectorAll('[data-stat]').forEach(function (el) {
      const key = el.dataset.stat;
      const suffix = el.dataset.suffix || '';
      const val = stats[key] ?? FALLBACK[key] ?? 0;
      const io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              countUp(el, val, suffix);
              io.disconnect();
            }
          });
        },
        { threshold: 0.4 }
      );
      io.observe(el);
    });
  }

  fetch('/api/public/stats')
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      render(j.ok ? j.data : FALLBACK);
    })
    .catch(function () {
      render(FALLBACK);
    });
})();

/**
 * Educator login gate for stream-dashboard.html (client-only; not server auth).
 */
(function () {
  const cfg = window.ResearchiumStudioGateConfig;
  const AUTH_KEY = cfg?.AUTH_KEY || 'studio_authed';
  const AUTH_VALUE = cfg?.AUTH_VALUE || '1';
  const LOCK_CLASS = 'studio-gate-locked';
  const EXPECTED_EMAIL = 'admin@derived.co.in';
  const EXPECTED_PASSWORD_HASH =
    'e6a9f636ebad7b7708072afb35308a7fc1cf9aaaac77b2b8a6576bc383b773a9';

  const SESSION_KEYS_ON_SIGN_OUT = [
    'researchium_studio_session',
    'researchium_join_profile',
    'researchium_media_granted',
    'researchium_studio_no_camera',
  ];

  function isAuthed() {
    try {
      return sessionStorage.getItem(AUTH_KEY) === AUTH_VALUE;
    } catch {
      return false;
    }
  }

  function setLocked(locked) {
    document.documentElement.classList.toggle(LOCK_CLASS, locked);
  }

  async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function showGate() {
    setLocked(true);
    const gate = document.getElementById('studioLoginGate');
    if (gate) gate.hidden = false;
    const app = document.getElementById('streamDashApp');
    if (app) app.setAttribute('aria-hidden', 'true');
    requestAnimationFrame(() => {
      document.getElementById('studioLoginEmail')?.focus();
    });
  }

  function hideGate() {
    setLocked(false);
    const gate = document.getElementById('studioLoginGate');
    if (gate) gate.hidden = true;
    const app = document.getElementById('streamDashApp');
    if (app) app.removeAttribute('aria-hidden');
    const err = document.getElementById('studioLoginError');
    if (err) err.hidden = true;
    const card = document.getElementById('studioLoginCard');
    card?.classList.remove('studio-login-card--shake');
    const form = document.getElementById('studioLoginForm');
    form?.removeAttribute('aria-busy');
    const submit = document.getElementById('studioLoginSubmit');
    if (submit) {
      submit.disabled = false;
      submit.classList.remove('studio-login-submit--loading');
    }
  }

  function setSubmitLoading(loading) {
    const form = document.getElementById('studioLoginForm');
    const submit = document.getElementById('studioLoginSubmit');
    if (form) form.setAttribute('aria-busy', loading ? 'true' : 'false');
    if (submit) {
      submit.disabled = loading;
      submit.classList.toggle('studio-login-submit--loading', loading);
    }
  }

  function unlockDashboard() {
    try {
      sessionStorage.setItem(AUTH_KEY, AUTH_VALUE);
    } catch {
      /* ignore */
    }
    location.reload();
  }

  function clearLocalStudioAuth() {
    try {
      localStorage.removeItem('researchium_session');
      localStorage.removeItem('researchium_user');
    } catch {
      /* ignore */
    }
  }

  function clearStudioSessionStorage() {
    try {
      sessionStorage.removeItem(AUTH_KEY);
      SESSION_KEYS_ON_SIGN_OUT.forEach((key) => sessionStorage.removeItem(key));
    } catch {
      /* ignore */
    }
  }

  function lockDashboard() {
    clearStudioSessionStorage();
    const auth = window.ResearchiumStudio;
    if (auth && typeof auth.logout === 'function') {
      auth.logout();
    } else {
      clearLocalStudioAuth();
    }
    location.reload();
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = String(document.getElementById('studioLoginEmail')?.value || '')
      .trim()
      .toLowerCase();
    const password = String(document.getElementById('studioLoginPassword')?.value || '');
    const errEl = document.getElementById('studioLoginError');
    const card = document.getElementById('studioLoginCard');

    if (errEl) errEl.hidden = true;
    card?.classList.remove('studio-login-card--shake');
    setSubmitLoading(true);

    try {
      const hash = await sha256Hex(password);
      if (email === EXPECTED_EMAIL && hash === EXPECTED_PASSWORD_HASH) {
        unlockDashboard();
        return;
      }
    } catch {
      /* fall through to error */
    }

    setSubmitLoading(false);
    if (errEl) errEl.hidden = false;
    card?.classList.remove('studio-login-card--shake');
    void card?.offsetWidth;
    card?.classList.add('studio-login-card--shake');
    document.getElementById('studioLoginPassword')?.focus();
  }

  function bindGate() {
    document.getElementById('studioLoginForm')?.addEventListener('submit', handleLoginSubmit);
    document.getElementById('btnStudioSignOut')?.addEventListener('click', lockDashboard);
  }

  if (isAuthed()) {
    hideGate();
  } else {
    showGate();
  }

  bindGate();
})();

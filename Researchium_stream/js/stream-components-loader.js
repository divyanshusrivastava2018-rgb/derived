/**
 * Mount React stream components when dist/stream-components/stream-components.js is built.
 */
(function () {
  const BUNDLE = 'dist/stream-components/stream-components.js';
  const CSS = 'dist/stream-components/stream-components.css';

  function roomSlug() {
    const params = new URLSearchParams(location.search);
    if (params.get('room')) return params.get('room');
    try {
      const s = JSON.parse(sessionStorage.getItem('researchium_studio_session') || '{}');
      return s.roomSlug || s.room?.slug;
    } catch {
      return null;
    }
  }

  function showBundleMissing(config) {
    if (typeof config.onBundleMissing === 'function') {
      config.onBundleMissing();
      return;
    }
    const bannerId = config.bundleBannerId || 'reactBuildBanner';
    const banner = document.getElementById(bannerId);
    if (banner) {
      banner.hidden = false;
      return;
    }
    console.warn(
      '[stream-components] Run: cd Researchium_stream/frontend && npm install && npm run build'
    );
  }

  function loadCss() {
    if (document.querySelector('link[data-rs-components]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS;
    link.dataset.rsComponents = '1';
    document.head.appendChild(link);
  }

  function loadScript() {
    return new Promise((resolve, reject) => {
      if (window.ResearchiumStreamComponents) return resolve();
      const s = document.createElement('script');
      s.src = BUNDLE;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('bundle_not_found'));
      document.body.appendChild(s);
    });
  }

  async function init(config) {
    config = config || {};
    try {
      loadCss();
      await loadScript();
    } catch {
      showBundleMissing(config);
      return false;
    }

    const R = window.ResearchiumStreamComponents;
    const slug = config.roomSlug || roomSlug();
    const mount = R.mount;

    if (config.platformsEl) {
      mount.platformConnectionManager(config.platformsEl, {
        showGoLive: config.showGoLive,
        onGoLiveResult: config.onGoLiveResult,
      });
    }
    if (config.chatEl && slug) {
      mount.unifiedChatRoom(config.chatEl, {
        roomSlug: slug,
        authorName: config.authorName || 'Host',
        autoStartRelay: config.autoStartRelay !== false,
        height: config.chatHeight || 400,
      });
    }
    if (config.controlsEl && slug) {
      mount.streamControlPanel(config.controlsEl, {
        roomSlug: slug,
        title: config.title || document.title,
        onLiveChange: config.onLiveChange,
      });
    }
    if (config.viewerEl && slug) {
      mount.viewerCounter(config.viewerEl, {
        roomSlug: slug,
        intervalMs: config.intervalMs || 5000,
        compact: config.viewerCompact,
      });
    }
    return true;
  }

  window.ResearchiumStreamComponentsLoader = { init, roomSlug, showBundleMissing };
})();

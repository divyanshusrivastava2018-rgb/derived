(function () {
  const auth = window.ResearchiumStudio;
  const slug =
    new URLSearchParams(location.search).get('room') ||
    JSON.parse(sessionStorage.getItem('researchium_studio_session') || '{}').roomSlug;

  document.getElementById('roomLabel').textContent = slug
    ? `Room: ${slug}`
    : 'No room — open from dashboard or add ?room=';

  let toastTimer = null;
  function showToast(message, isError) {
    const el = document.getElementById('streamDashToast');
    if (!el) return;
    el.textContent = message;
    el.className = 'stream-toast' + (isError ? ' stream-toast--error' : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 5000);
  }

  auth
    .ensureSignedIn()
    .then(() =>
      window.ResearchiumStreamComponentsLoader.init({
        roomSlug: slug,
        platformsEl: document.getElementById('platformsMount'),
        showGoLive: true,
        controlsEl: document.getElementById('controlsMount'),
        chatEl: document.getElementById('chatMount'),
        viewerEl: document.getElementById('viewerMount'),
        viewerCompact: false,
        intervalMs: 5000,
        onBundleMissing: () => {
          const banner = document.getElementById('reactBuildBanner');
          if (banner) banner.hidden = false;
        },
        onGoLiveResult: (r) => {
          showToast(
            r.status === 'live' ? 'Live!' : `Status: ${r.status}`,
            r.status !== 'live'
          );
        },
      })
    )
    .catch(() => location.replace('studio-lobby.html'));
})();

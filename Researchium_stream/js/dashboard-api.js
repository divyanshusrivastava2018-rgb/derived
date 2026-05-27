/**
 * Meeting dashboard API client.
 */
window.ResearchiumDashboardApi = (function () {
  const auth = window.ResearchiumStudio;

  return {
    getDashboard() {
      return auth.api('/api/dashboard');
    },
    openMeeting(opts = {}) {
      return auth.api('/api/dashboard/meeting', {
        method: 'POST',
        body: JSON.stringify({
          title: opts.title,
          forceNew: Boolean(opts.forceNew),
          origin: location.origin,
        }),
      });
    },
    getMeeting(roomSlug) {
      return auth.api(
        `/api/dashboard/meeting/${encodeURIComponent(roomSlug)}?origin=${encodeURIComponent(location.origin)}`
      );
    },
    setMeetingLive(roomSlug, live) {
      return auth.api(`/api/dashboard/meeting/${encodeURIComponent(roomSlug)}/live`, {
        method: 'POST',
        body: JSON.stringify({ live }),
      });
    },
  };
})();

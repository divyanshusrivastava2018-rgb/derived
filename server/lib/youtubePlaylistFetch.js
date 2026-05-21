/**
 * YouTube Data API v3 helpers — list videos in a playlist (requires YOUTUBE_API_KEY).
 */

function extractPlaylistId(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const fromQuery = s.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (fromQuery) return fromQuery[1];
  if (/^[a-zA-Z0-9_-]{13,}$/.test(s)) return s;
  return null;
}

function suggestCategoryFromPlaylistTitle(title) {
  const t = String(title || '').toLowerCase();
  if (/jee|neet|iit/.test(t)) return 'JEE / NEET';
  if (/upsc|ssc|csat/.test(t)) return 'UPSC / SSC';
  if (/python|javascript|code|programming|dsa|web dev|full stack|bootcamp/.test(t)) return 'Coding & AI';
  if (
    /real analysis|calculus|algebra|topology|linear algebra|mathematics|math|statistics|differential|measure theory/.test(
      t
    )
  ) {
    return 'Research & Science';
  }
  if (/finance|mba|economics/.test(t)) return 'Finance & MBA';
  if (/design|ux|ui/.test(t)) return 'Design & UX';
  if (/school|k-12|cbse|icse/.test(t)) return 'K-12 Schools';
  return null;
}

async function fetchPlaylistSnippet(playlistId, apiKey) {
  const url = new URL('https://www.googleapis.com/youtube/v3/playlists');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('id', playlistId);
  url.searchParams.set('key', apiKey);
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok) {
    const msg = j.error?.message || `YouTube API ${r.status}`;
    throw new Error(msg);
  }
  const item = j.items && j.items[0];
  return { title: item?.snippet?.title || null, channelTitle: item?.snippet?.channelTitle || null };
}

async function fetchAllPlaylistItems(playlistId, apiKey) {
  const items = [];
  let pageToken = '';
  for (;;) {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const r = await fetch(url);
    const j = await r.json();
    if (!r.ok) {
      const msg = j.error?.message || `YouTube API ${r.status}`;
      throw new Error(msg);
    }

    for (const it of j.items || []) {
      const vid = it.contentDetails?.videoId || it.snippet?.resourceId?.videoId;
      if (!vid) continue;
      const title = (it.snippet?.title || '').trim();
      if (!title || title === 'Deleted video' || title === 'Private video') continue;
      items.push({ videoId: vid, title });
    }

    pageToken = j.nextPageToken || '';
    if (!pageToken) break;
  }
  return items;
}

module.exports = {
  extractPlaylistId,
  suggestCategoryFromPlaylistTitle,
  fetchPlaylistSnippet,
  fetchAllPlaylistItems
};

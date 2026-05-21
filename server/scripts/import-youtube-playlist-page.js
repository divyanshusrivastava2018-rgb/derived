/**
 * Fetch a public playlist page, parse ytInitialData, update site-content + public fallback + courses.
 * Usage: node server/scripts/import-youtube-playlist-page.js [playlistUrlOrId]
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { nanoid } = require('nanoid');

const DEFAULT_LIST = 'https://www.youtube.com/playlist?list=PL_SCHWX7ocPwzpCTmagZvWX2BrT9BQiYf';

function fetchText(u) {
  return new Promise((resolve, reject) => {
    https
      .get(
        u,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        },
        (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            const loc = res.headers.location;
            if (!loc) return reject(new Error('redirect without location'));
            return resolve(fetchText(loc.startsWith('http') ? loc : new URL(loc, u).href));
          }
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => resolve(d));
        }
      )
      .on('error', reject);
  });
}

function extractPlaylistId(input) {
  const s = String(input || '').trim();
  const fromQuery = s.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (fromQuery) return fromQuery[1];
  if (/^[a-zA-Z0-9_-]{13,}$/.test(s)) return s;
  return null;
}

function parsePlaylistPage(html) {
  const m = html.match(/var ytInitialData = ({.*?});/s);
  if (!m) throw new Error('Could not find ytInitialData on playlist page');
  const j = JSON.parse(m[1]);
  const items = [];
  let playlistTitle = null;
  function walk(o, depth) {
    if (!o || typeof o !== 'object' || depth > 45) return;
    if (Array.isArray(o)) return o.forEach((x) => walk(x, depth + 1));
    const meta = o.playlistMetadataRenderer;
    if (meta && meta.title) {
      const tr = meta.title;
      const simple = tr.simpleText || (tr.runs && tr.runs[0] && tr.runs[0].text);
      if (simple) playlistTitle = String(simple);
    }
    const r = o.playlistVideoRenderer;
    if (r && r.videoId) {
      const title = (r.title && r.title.runs && r.title.runs[0] && r.title.runs[0].text) || '';
      items.push({ id: r.videoId, title: String(title) });
    }
    Object.values(o).forEach((v) => walk(v, depth + 1));
  }
  walk(j, 0);
  return { items, playlistTitle };
}

async function main() {
  const arg = process.argv[2] || DEFAULT_LIST;
  const playlistId = extractPlaylistId(arg);
  if (!playlistId) throw new Error('Invalid playlist URL or ID');
  const pageUrl = arg.includes('youtube.com') ? arg.split('&')[0] : `https://www.youtube.com/playlist?list=${playlistId}`;

  const html = await fetchText(pageUrl);
  const { items, playlistTitle: metaTitle } = parsePlaylistPage(html);
  if (!items.length) throw new Error('No videos found in playlist');

  const FALLBACK_TITLES = {
    PL_SCHWX7ocPwzpCTmagZvWX2BrT9BQiYf: 'JEE Mains Maths | 2025–26 (CBSE Board)'
  };
  const playlistTitle = metaTitle || FALLBACK_TITLES[playlistId] || 'YouTube playlist';

  const root = path.join(__dirname, '..');
  const sitePath = path.join(root, 'data', 'site-content.json');
  const coursesPath = path.join(root, 'data', 'courses.json');
  const pubPath = path.join(root, '..', 'public', 'data', 'youtube-playlist.json');

  const site = JSON.parse(fs.readFileSync(sitePath, 'utf8'));
  const subheading = `Full series: ${playlistTitle} — Maths with Divyanshu Sir (JEE Mains / CBSE). Open playlist on YouTube · in-page queue below. Optional "views" in JSON enables “Most viewed” sort.`;

  site.youtubePlaylist = {
    heading: playlistTitle,
    subheading,
    playlistId,
    playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
    videos: items.map((v, i) => ({
      id: v.id,
      seq: i + 1,
      title: '',
      views: null,
      note: v.title.length > 130 ? `${v.title.slice(0, 127)}…` : v.title
    }))
  };

  fs.writeFileSync(sitePath, JSON.stringify(site, null, 2));

  fs.mkdirSync(path.dirname(pubPath), { recursive: true });
  fs.writeFileSync(
    pubPath,
    JSON.stringify(
      {
        heading: site.youtubePlaylist.heading,
        subheading: site.youtubePlaylist.subheading,
        videos: site.youtubePlaylist.videos
      },
      null,
      2
    )
  );

  let courses = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));
  const existing = new Set(courses.filter((c) => c.ytId).map((c) => c.ytId));
  const base = Date.now();
  const playlistDesc = `YouTube: ${site.youtubePlaylist.playlistUrl}`;
  const newCourses = [];
  items.forEach((v, i) => {
    if (existing.has(v.id)) return;
    newCourses.push({
      id: nanoid(12),
      type: 'youtube',
      ytId: v.id,
      title: v.title.slice(0, 500),
      category: 'JEE / NEET',
      level: 'Intermediate',
      instructor: 'Maths with Divyanshu Sir',
      lang: 'Hindi',
      price: 0,
      duration: 'JEE Mains Maths · lecture',
      desc: `${playlistDesc}\n\n${v.title}`,
      rating: 4.7,
      students: 0,
      thumbUrl: null,
      fileUrl: null,
      extUrl: null,
      createdAt: base - i
    });
  });
  courses = [...newCourses, ...courses];
  fs.writeFileSync(coursesPath, JSON.stringify(courses, null, 2));

  console.log('OK — playlist title:', playlistTitle);
  console.log('Videos in player JSON:', items.length);
  console.log('New catalog rows added:', newCourses.length, '(skipped duplicates by video ID)');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

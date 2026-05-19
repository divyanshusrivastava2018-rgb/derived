/**
 * Fetch Class-10 Chemistry playlist and attach all videos to course d1 (CHEMISTRY DEMO VIDEO).
 * Usage: node server/scripts/import-chemistry-playlist.js [playlistUrl]
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const DEFAULT_URL =
  'https://www.youtube.com/playlist?list=PLIowxflsb4xC5P98ChXATyDaGEAPpV4RN';
const PLAYLIST_ID = 'PLIowxflsb4xC5P98ChXATyDaGEAPpV4RN';
const COURSE_ID = 'd1';

function fetchText(u) {
  return new Promise((resolve, reject) => {
    https
      .get(
        u,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function patchCourse(course, payload) {
  return {
    ...course,
    ytId: payload.firstVideoId,
    ytListId: payload.playlistId,
    playlistUrl: payload.playlistUrl,
    playlistVideos: payload.videos,
    title: 'CHEMISTRY DEMO VIDEO',
    category: 'JEE / NEET',
    level: 'Advanced',
    instructor: 'Researchium',
    lang: 'Hindi',
    price: 0,
    duration: `Playlist · ${payload.videos.length} videos`,
    desc: `${payload.playlistTitle} — ${payload.videos.length} lectures. Watch in order below or on YouTube.`
  };
}

function upsertCourseList(list, payload) {
  const idx = list.findIndex((c) => c.id === COURSE_ID);
  if (idx === -1) {
    list.unshift({
      id: COURSE_ID,
      type: 'youtube',
      rating: 4.8,
      students: 12400,
      thumbUrl: null,
      fileUrl: null,
      extUrl: null,
      createdAt: Date.now()
    });
    return patchCourse(list[0], payload);
  }
  list[idx] = patchCourse(list[idx], payload);
  return list[idx];
}

/** Remove stray catalog rows that duplicate this playlist (from generic import). */
function pruneDuplicatePlaylistCourses(list, videoIds) {
  const idSet = new Set(videoIds);
  return list.filter((c) => {
    if (c.id === COURSE_ID) return true;
    if (c.type === 'youtube' && c.ytId && idSet.has(c.ytId) && !c.ytListId) return false;
    return true;
  });
}

async function main() {
  const arg = process.argv[2] || DEFAULT_URL;
  const playlistId = extractPlaylistId(arg) || PLAYLIST_ID;
  const pageUrl = arg.includes('youtube.com')
    ? arg.split('&si=')[0].split('&')[0]
    : `https://www.youtube.com/playlist?list=${playlistId}`;

  const html = await fetchText(pageUrl);
  const { items, playlistTitle: metaTitle } = parsePlaylistPage(html);
  if (!items.length) throw new Error('No videos found in playlist');

  const playlistTitle = metaTitle || 'Class-10 Chemistry';
  const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
  const videos = items.map((v, i) => ({
    id: v.id,
    seq: i + 1,
    title: v.title.length > 200 ? `${v.title.slice(0, 197)}…` : v.title
  }));
  const videoIds = videos.map((v) => v.id);

  const payload = {
    playlistId,
    playlistUrl,
    playlistTitle,
    firstVideoId: videos[0].id,
    videos
  };

  const root = path.join(__dirname, '..');
  const pubPath = path.join(root, '..', 'public', 'data', 'chemistry-playlist.json');
  fs.mkdirSync(path.dirname(pubPath), { recursive: true });
  fs.writeFileSync(
    pubPath,
    JSON.stringify(
      {
        heading: playlistTitle,
        subheading: `CHEMISTRY DEMO VIDEO — ${videos.length} lectures from Gene Tutorial / Divyanshu Sir.`,
        playlistId,
        playlistUrl,
        videos
      },
      null,
      2
    ),
    'utf8'
  );

  const seedPath = path.join(root, 'data', 'seed-default.json');
  const offlinePath = path.join(root, '..', 'public', 'data', 'offline-courses.json');
  const coursesPath = path.join(root, 'data', 'courses.json');

  for (const file of [seedPath, offlinePath]) {
    const list = readJson(file, []);
    upsertCourseList(list, payload);
    fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf8');
  }

  if (fs.existsSync(coursesPath)) {
    let courses = readJson(coursesPath, []);
    courses = pruneDuplicatePlaylistCourses(courses, videoIds);
    upsertCourseList(courses, payload);
    fs.writeFileSync(coursesPath, JSON.stringify(courses, null, 2), 'utf8');
  }

  console.log('OK —', playlistTitle);
  console.log('Videos:', videos.length);
  console.log('Course d1 updated; chemistry-playlist.json written.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

/**
 * Fetch a YouTube playlist and attach all videos to a JEE/NEET demo course.
 *
 *   node server/scripts/import-demo-playlist.js chemistry
 *   node server/scripts/import-demo-playlist.js d7
 *   node server/scripts/import-demo-playlist.js --all
 *   node server/scripts/import-demo-playlist.js physics "https://youtube.com/playlist?list=..."
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { DEMOS, getDemoByIdOrSlug, clearBundleCache } = require('../lib/demoPlaylists');

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

function patchCourse(course, demo, payload) {
  return {
    ...course,
    ytId: payload.firstVideoId,
    ytListId: payload.playlistId,
    playlistUrl: payload.playlistUrl,
    playlistVideos: payload.videos,
    title: demo.title,
    category: 'JEE / NEET',
    level: 'Advanced',
    instructor: 'Researchium',
    lang: 'Hindi',
    price: 0,
    duration: `Playlist · ${payload.videos.length} videos`,
    desc: `${payload.playlistTitle} — ${payload.videos.length} lectures. Watch in order below or on YouTube.`
  };
}

function upsertCourseList(list, demo, payload) {
  const idx = list.findIndex((c) => c.id === demo.id);
  if (idx === -1) {
    list.push({
      id: demo.id,
      type: 'youtube',
      rating: 4.8,
      students: 10000,
      thumbUrl: null,
      fileUrl: null,
      extUrl: null,
      createdAt: Date.now()
    });
    const i = list.length - 1;
    list[i] = patchCourse(list[i], demo, payload);
    return list[i];
  }
  list[idx] = patchCourse(list[idx], demo, payload);
  return list[idx];
}

function pruneDuplicatePlaylistCourses(list, courseId, videoIds) {
  const idSet = new Set(videoIds);
  return list.filter((c) => {
    if (c.id === courseId) return true;
    if (c.type === 'youtube' && c.ytId && idSet.has(c.ytId) && !c.ytListId) return false;
    return true;
  });
}

async function importOne(demo, playlistUrlOverride) {
  const playlistId =
    extractPlaylistId(playlistUrlOverride) || demo.playlistId;
  const pageUrl =
    playlistUrlOverride && playlistUrlOverride.includes('youtube.com')
      ? playlistUrlOverride.split('&si=')[0].split('&')[0]
      : `https://www.youtube.com/playlist?list=${playlistId}`;

  const html = await fetchText(pageUrl);
  const { items, playlistTitle: metaTitle } = parsePlaylistPage(html);
  if (!items.length) throw new Error(`No videos found for ${demo.slug}`);

  const playlistTitle = metaTitle || demo.defaultHeading;
  const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
  const videos = items.map((v, i) => ({
    id: v.id,
    seq: i + 1,
    title: v.title.length > 200 ? `${v.title.slice(0, 197)}…` : v.title
  }));

  const payload = {
    playlistId,
    playlistUrl,
    playlistTitle,
    firstVideoId: videos[0].id,
    videos
  };

  const root = path.join(__dirname, '..');
  const pubPath = path.join(root, '..', 'public', 'data', demo.dataFile);
  fs.mkdirSync(path.dirname(pubPath), { recursive: true });
  fs.writeFileSync(
    pubPath,
    JSON.stringify(
      {
        courseId: demo.id,
        heading: playlistTitle,
        subheading: `${demo.title} — ${videos.length} lectures.`,
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
    upsertCourseList(list, demo, payload);
    fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf8');
  }

  if (fs.existsSync(coursesPath)) {
    let courses = readJson(coursesPath, []);
    courses = pruneDuplicatePlaylistCourses(
      courses,
      demo.id,
      videos.map((v) => v.id)
    );
    upsertCourseList(courses, demo, payload);
    fs.writeFileSync(coursesPath, JSON.stringify(courses, null, 2), 'utf8');
  }

  clearBundleCache();
  console.log(`OK [${demo.slug}] ${playlistTitle} — ${videos.length} videos → ${demo.dataFile}`);
  return videos.length;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const all = args.includes('--all');
  const rest = args.filter((a) => a !== '--all');

  if (all) {
    for (const demo of DEMOS) {
      await importOne(demo);
    }
    console.log('All demo playlists synced.');
    return;
  }

  const key = rest[0];
  if (!key) {
    console.error('Usage: node import-demo-playlist.js <chemistry|biology|physics|mathematics|d1|d3|d4|d7> [playlistUrl]');
    console.error('       node import-demo-playlist.js --all');
    process.exit(1);
  }

  const demo = getDemoByIdOrSlug(key);
  if (!demo) {
    console.error('Unknown demo:', key);
    process.exit(1);
  }

  const url = rest[1] && rest[1].includes('youtube') ? rest[1] : null;
  await importOne(demo, url);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

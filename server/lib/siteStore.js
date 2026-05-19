const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'site-content.json');
const LEGACY_PLAYLIST = path.join(__dirname, '..', '..', 'public', 'data', 'youtube-playlist.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultYoutubePlaylist() {
  return {
    heading: 'Divyanshu Sir YouTube playlist',
    subheading:
      'Watch the full playlist on YouTube or use the in-page player below. You can import all public videos into the course catalog from Admin.',
    playlistUrl: 'https://www.youtube.com/watch?v=9jhxdr_qmaM&list=PLIowxflsb4xC5P98ChXATyDaGEAPpV4RN',
    channelUrl: 'https://www.youtube.com/@MathswithDivyanshuSir',
    videos: [
      {
        id: '9jhxdr_qmaM',
        seq: 1,
        title: '',
        views: null,
        note: 'Playlist video — open on YouTube for full details and comments'
      }
    ]
  };
}

function defaultLiveSchedule() {
  return [
    { time: '6:00 PM', title: 'JEE Physics — Rotation & COM', meta: 'Advanced · Hindi · Today', linkHref: '/signin.html', linkLabel: 'Join →' },
    { time: '7:30 PM', title: 'UPSC CSAT — Comprehension drills', meta: 'Intermediate · English · Today', linkHref: '/signin.html', linkLabel: 'Join →' },
    { time: '8:15 PM', title: 'DSA — Graphs & shortest paths', meta: 'Intermediate · English · Tomorrow', linkHref: '/signin.html', linkLabel: 'Remind me' },
    { time: 'Sat 10 AM', title: 'Research writing — IMRAD walkthrough', meta: 'Beginner · English · Weekend', linkHref: '/blog.html', linkLabel: 'Related reads' }
  ];
}

function defaultPageCopy() {
  return {
    home: {
      secTag: 'EDUCATION · RESEARCH · CAREERS',
      titleHtml: 'Your path from <span class="gold">classroom</span> to <span class="gold">career</span>',
      leadHtml:
        'Researchium connects self-paced courses, live teaching, and research writing — so you can prep for JEE &amp; NEET, crack interviews, or publish with clarity.'
    },
    about: {
      secTag: 'MISSION · TEAM · STACK',
      titleHtml: 'About <span class="gold">Researchium</span>',
      leadHtml: 'We build bridges between competitive exams, industry skills, and research literacy — one learner at a time.'
    },
    pricing: {
      secTag: 'SIMPLE · TRANSPARENT',
      titleHtml: 'Choose your <span class="gold">Researchium</span> plan',
      leadHtml: 'Start free with the full course catalog. Add live hours, mentors, and teams when you need them.'
    },
    live: {
      secTag: 'LIVE · INTERACTIVE · DOUBTS',
      titleHtml: 'Live <span class="gold">Classes</span> &amp; doubt labs',
      leadHtml:
        'Join educators in real time — then continue practice on-demand in the <a href="/courses.html" style="color: var(--gold); font-weight: 600">course library</a>.'
    },
    blog: {
      secTag: 'METHODS · WRITING · TOOLS',
      titleHtml: '<span class="gold">Research</span> Blog',
      leadHtml:
        'Practical notes for students crossing into papers, theses, and serious technical writing — then apply skills in <a href="/courses.html" style="color: var(--gold); font-weight: 600">Courses</a>.'
    },
    courses: {
      secTag: '—',
      titleHtml: 'Explore All <span class="gold">Researchium</span> Courses',
      leadHtml: 'From JEE to FAANG — find your perfect learning path and start today'
    }
  };
}

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const bv = base[k];
    if (pv && typeof pv === 'object' && !Array.isArray(pv) && bv && typeof bv === 'object' && !Array.isArray(bv)) {
      out[k] = deepMerge(bv, pv);
    } else if (pv !== undefined) {
      out[k] = pv;
    }
  }
  return out;
}

function readLegacyPlaylist() {
  try {
    if (!fs.existsSync(LEGACY_PLAYLIST)) return null;
    const j = JSON.parse(fs.readFileSync(LEGACY_PLAYLIST, 'utf8'));
    if (j && Array.isArray(j.videos)) return j;
  } catch {
    /* ignore */
  }
  return null;
}

function defaultSite() {
  const legacy = readLegacyPlaylist();
  return {
    youtubePlaylist: legacy || defaultYoutubePlaylist(),
    liveSchedule: defaultLiveSchedule(),
    pageCopy: defaultPageCopy()
  };
}

function readSite() {
  ensureDataDir();
  const base = defaultSite();
  if (!fs.existsSync(DATA_FILE)) {
    writeSite(base);
    return base;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    const defPl = defaultYoutubePlaylist();
    const pl = parsed.youtubePlaylist && typeof parsed.youtubePlaylist === 'object' ? parsed.youtubePlaylist : {};
    const youtubePlaylist = {
      ...defPl,
      ...pl,
      heading: typeof pl.heading === 'string' ? pl.heading : defPl.heading,
      subheading: typeof pl.subheading === 'string' ? pl.subheading : defPl.subheading,
      videos: Array.isArray(pl.videos) ? pl.videos : defPl.videos
    };
    const liveSchedule = Array.isArray(parsed.liveSchedule) ? parsed.liveSchedule : base.liveSchedule;
    const pageCopy = deepMerge(base.pageCopy, parsed.pageCopy || {});

    const { youtubePlaylist: _yp, liveSchedule: _ls, pageCopy: _pc, ...restTop } = parsed;
    return {
      ...restTop,
      youtubePlaylist,
      liveSchedule,
      pageCopy
    };
  } catch {
    return base;
  }
}

function writeSite(site) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(site, null, 2), 'utf8');
}

module.exports = { readSite, writeSite, defaultSite, DATA_FILE };

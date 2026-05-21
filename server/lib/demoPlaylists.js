const fs = require('fs');
const path = require('path');

const PUBLIC_DATA = path.join(__dirname, '..', '..', 'public', 'data');

/** JEE/NEET demo courses with full YouTube playlists */
const DEMOS = [
  {
    id: 'd1',
    slug: 'chemistry',
    title: 'CHEMISTRY DEMO VIDEO',
    titlePattern: /^CHEMISTRY\s+DEMO/i,
    playlistId: 'PLIowxflsb4xC5P98ChXATyDaGEAPpV4RN',
    dataFile: 'chemistry-playlist.json',
    defaultHeading: 'Class-10 Chemistry'
  },
  {
    id: 'd7',
    slug: 'biology',
    title: 'BIOLOGY DEMO VIDEO',
    titlePattern: /^BIOLOGY\s+DEMO/i,
    playlistId: 'PLIowxflsb4xDrjtyb5ON5AGyRzrWmfuxp',
    dataFile: 'biology-playlist.json',
    defaultHeading: 'Class-10 Biology'
  },
  {
    id: 'd3',
    slug: 'physics',
    title: 'PHYSICS DEMO VIDEO',
    titlePattern: /^PHYSICS\s+DEMO/i,
    playlistId: 'PLIowxflsb4xDremjV66Zw4lyNh4zq6o3j',
    dataFile: 'physics-playlist.json',
    defaultHeading: 'Class-10 Physics'
  },
  {
    id: 'd4',
    slug: 'mathematics',
    title: 'MATHEMATICS DEMO VIDEO',
    titlePattern: /^(MATHEMATICS|MATHS)\s+DEMO/i,
    playlistId: 'PLIowxflsb4xC5meAS5MW21PHFnqVPokPc',
    dataFile: 'mathematics-playlist.json',
    defaultHeading: 'Class-10 Mathematics'
  }
];

const bundleCache = new Map();

function getDemoByCourse(course) {
  if (!course) return null;
  return (
    DEMOS.find((d) => d.id === course.id) ||
    DEMOS.find((d) => d.titlePattern.test(String(course.title || '').trim())) ||
    null
  );
}

function isDemoPlaylistCourse(course) {
  return !!getDemoByCourse(course);
}

function getDemoByIdOrSlug(key) {
  const k = String(key || '').trim().toLowerCase();
  return DEMOS.find((d) => d.id === k || d.slug === k) || null;
}

function loadBundle(demo) {
  if (!demo) return null;
  if (bundleCache.has(demo.slug)) return bundleCache.get(demo.slug);
  const file = path.join(PUBLIC_DATA, demo.dataFile);
  if (!fs.existsSync(file)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    bundleCache.set(demo.slug, data);
    return data;
  } catch {
    return null;
  }
}

function clearBundleCache() {
  bundleCache.clear();
}

function enrichDemoCourse(course) {
  const demo = getDemoByCourse(course);
  if (!demo) return course;

  const bundle = loadBundle(demo);
  const videos = bundle && Array.isArray(bundle.videos) ? bundle.videos : [];
  const fromCourse =
    Array.isArray(course.playlistVideos) && course.playlistVideos.length
      ? course.playlistVideos
      : videos;
  const firstId = (fromCourse[0] && fromCourse[0].id) || course.ytId || null;
  const playlistUrl =
    course.playlistUrl ||
    bundle?.playlistUrl ||
    `https://www.youtube.com/playlist?list=${demo.playlistId}`;

  return {
    ...course,
    type: 'youtube',
    title: course.title || demo.title,
    category: course.category || 'JEE / NEET',
    level: course.level || 'Advanced',
    instructor: course.instructor || 'Researchium',
    lang: course.lang || 'Hindi',
    price: course.price != null ? course.price : 0,
    ytId: course.ytId || firstId || null,
    ytListId: course.ytListId || bundle?.playlistId || demo.playlistId,
    playlistUrl,
    playlistVideos: fromCourse.length ? fromCourse : videos,
    duration:
      course.duration ||
      (fromCourse.length ? `Playlist · ${fromCourse.length} videos` : 'Playlist'),
    desc:
      course.desc ||
      bundle?.subheading ||
      `${demo.defaultHeading} — watch all lectures in order.`
  };
}

module.exports = {
  DEMOS,
  getDemoByCourse,
  getDemoByIdOrSlug,
  isDemoPlaylistCourse,
  loadBundle,
  clearBundleCache,
  enrichDemoCourse
};

const fs = require('fs');
const path = require('path');

const CHEMISTRY_COURSE_ID = 'd1';
const CHEMISTRY_PLAYLIST_ID = 'PLIowxflsb4xC5P98ChXATyDaGEAPpV4RN';
const CHEMISTRY_PLAYLIST_URL = `https://www.youtube.com/playlist?list=${CHEMISTRY_PLAYLIST_ID}`;

const DATA_FILE = path.join(__dirname, '..', '..', 'public', 'data', 'chemistry-playlist.json');

let cached = null;

function loadBundle() {
  if (cached) return cached;
  if (!fs.existsSync(DATA_FILE)) return null;
  try {
    cached = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return cached;
  } catch {
    return null;
  }
}

function isChemistryDemoCourse(course) {
  if (!course) return false;
  if (course.id === CHEMISTRY_COURSE_ID) return true;
  return /^CHEMISTRY\s+DEMO/i.test(String(course.title || '').trim());
}

function enrichChemistryCourse(course) {
  if (!isChemistryDemoCourse(course)) return course;
  const bundle = loadBundle();
  const videos = bundle && Array.isArray(bundle.videos) ? bundle.videos : [];
  const firstId = videos[0] && videos[0].id;

  return {
    ...course,
    type: 'youtube',
    title: course.title || 'CHEMISTRY DEMO VIDEO',
    category: course.category || 'JEE / NEET',
    level: course.level || 'Advanced',
    instructor: course.instructor || 'Researchium',
    lang: course.lang || 'Hindi',
    price: course.price != null ? course.price : 0,
    ytId: course.ytId || firstId || null,
    ytListId: course.ytListId || bundle?.playlistId || CHEMISTRY_PLAYLIST_ID,
    playlistUrl: course.playlistUrl || bundle?.playlistUrl || CHEMISTRY_PLAYLIST_URL,
    playlistVideos: videos.length
      ? course.playlistVideos && course.playlistVideos.length
        ? course.playlistVideos
        : videos
      : course.playlistVideos,
    duration:
      course.duration ||
      (videos.length ? `Playlist · ${videos.length} videos` : 'Playlist'),
    desc:
      course.desc ||
      (bundle?.subheading
        ? String(bundle.subheading)
        : 'Class-10 Chemistry — watch all lectures in order.')
  };
}

module.exports = {
  CHEMISTRY_COURSE_ID,
  CHEMISTRY_PLAYLIST_ID,
  isChemistryDemoCourse,
  enrichChemistryCourse,
  loadBundle
};

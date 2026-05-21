/** @deprecated Use demoPlaylists.js — kept for older imports */
const demo = require('./demoPlaylists');

module.exports = {
  CHEMISTRY_COURSE_ID: 'd1',
  CHEMISTRY_PLAYLIST_ID: 'PLIowxflsb4xC5P98ChXATyDaGEAPpV4RN',
  isChemistryDemoCourse: demo.isDemoPlaylistCourse,
  enrichChemistryCourse: demo.enrichDemoCourse,
  loadBundle: () => demo.loadBundle(demo.getDemoByIdOrSlug('chemistry'))
};

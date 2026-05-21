/** Wrapper — use: npm run sync:chemistry */
if (!process.argv.slice(2).some((a) => a === 'chemistry' || a === 'd1')) {
  process.argv.splice(2, 0, 'chemistry');
}
require('./import-demo-playlist.js');

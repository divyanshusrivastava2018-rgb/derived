const platformFeatures = require('./platformFeatures');
const csirData = require('./csirData');
const store = require('./store');

function formatLearnersShort(n) {
  const num = Number(n) || 0;
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return String(num);
}

function formatLearnersProof(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('en-IN') + '+';
}

function educatorCount() {
  const names = new Set();
  csirData.educators.forEach((e) => {
    if (e.name) names.add(String(e.name).trim());
  });
  try {
    store.readAll().forEach((course) => {
      if (course.instructor) names.add(String(course.instructor).trim());
    });
  } catch {
    /* courses unavailable */
  }
  return names.size;
}

function build() {
  const overview = platformFeatures.buildOverview();
  const learnersRaw = overview.learnerCount;
  const mockTests = overview.counts.mockTests;
  const pyqYears = overview.counts.gatePapers;

  return {
    learners: formatLearnersShort(learnersRaw) + '+',
    learnersRaw,
    learnersProof: formatLearnersProof(learnersRaw),
    educators: educatorCount(),
    mockTests,
    pyqYears,
    subjects: csirData.subjects.length,
    materials: overview.counts.materials,
    courses: overview.counts.courses,
    successRate: '98%',
    rating: '4.9★'
  };
}

module.exports = {
  build,
  formatLearnersShort,
  formatLearnersProof,
  educatorCount
};

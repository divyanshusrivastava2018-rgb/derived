const store = require('./store');
const materialsStore = require('./materialsStore');
const siteStore = require('./siteStore');
const gateMcqBank = require('./gateMcqBank');
const mockTestCatalog = require('./mockTestCatalog');
const doubtAssistant = require('./doubtAssistant');
const csirLeadsStore = require('./csirLeadsStore');

/** Homepage “Why Researchium” benefit cards — slugs match /why-feature.html?slug= */
const BENEFIT_FEATURES = [
  {
    slug: 'live-recorded',
    icon: '▶',
    title: 'Live + Recorded',
    summary: 'Join scheduled doubt labs and replay class recordings on your schedule.',
    details: [
      'Live timetable synced from the admin panel.',
      'YouTube playlist player for recorded sessions.',
      'Course library mixes live-oriented and self-paced tracks.'
    ],
    primaryLabel: 'View live schedule',
    primaryHref: '/live-classes.html'
  },
  {
    slug: 'downloadable-pdfs',
    icon: '📄',
    title: 'Downloadable PDFs',
    summary: 'Structured study materials organised by exam category.',
    details: [
      'PDF library grouped by GATE, JEE/NEET, and research topics.',
      'Direct download links from the study materials page.',
      'Admin can add new PDFs without redeploying the site.'
    ],
    primaryLabel: 'Browse PDFs',
    primaryHref: '/study-materials.html'
  },
  {
    slug: 'daily-practice',
    icon: '🎯',
    title: 'Daily practice',
    summary: 'Topic-wise MCQ quizzes for quick daily revision.',
    details: [
      'Category quizzes from the mock test catalog.',
      'Instant scoring with server-side answer keys.',
      'Mix JEE/NEET, coding, and mathematics topics.'
    ],
    primaryLabel: 'Start a quiz',
    primaryHref: '/mcq-test.html'
  },
  {
    slug: 'full-mocks',
    icon: '📊',
    title: 'Full mocks',
    summary: 'Timed GATE Mathematics mocks with CBT-style interface.',
    details: [
      'Year-wise GATE papers with section palette and timer.',
      'Server-side grading — answers never sent to the browser.',
      'Negative marking applied per question type.'
    ],
    primaryLabel: 'Attempt GATE mock',
    primaryHref: '/gate-exam.html?year=2018&name=Candidate'
  },
  {
    slug: 'doubt-support',
    icon: '💬',
    title: 'Doubt support',
    summary: 'Ask exam-focused questions on the CSIR NET program page.',
    details: [
      'Study assistant with CSIR NET–oriented explanations.',
      'hCaptcha-protected in production to reduce abuse.',
      'Fallback answers when AI is not configured on the server.'
    ],
    primaryLabel: 'Ask a doubt',
    primaryHref: '/csir-net.html#ai-doubt'
  },
  {
    slug: 'progress-tracking',
    icon: '📈',
    title: 'Progress tracking',
    summary: 'Save mock and quiz attempts to see your practice history.',
    details: [
      'Anonymous learner key stored in your browser (no account required).',
      'Records mock submissions and quiz scores automatically.',
      'Review recent activity on this device.'
    ],
    primaryLabel: 'View mock series',
    primaryHref: '/mcq-test.html#mock-test-series'
  }
];

const LEARN_ANYWHERE = {
  icon: '📱',
  title: 'Learn anywhere',
  summary: 'Courses, mocks & materials on desktop and mobile.',
  href: '/courses.html'
};

function safeCount(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function buildOverview() {
  let courses = [];
  let materials = [];
  let liveRows = [];
  let gatePapers = [];
  let mockTokens = [];

  try {
    courses = store.readAll();
  } catch {
    courses = [];
  }
  try {
    materials = materialsStore.readAll();
  } catch {
    materials = [];
  }
  try {
    const site = siteStore.readSite();
    liveRows = Array.isArray(site.liveSchedule) ? site.liveSchedule : [];
  } catch {
    liveRows = [];
  }
  try {
    gatePapers = gateMcqBank.listPapers();
  } catch {
    gatePapers = [];
  }
  try {
    mockTokens = mockTestCatalog.listMockTests().tokens || [];
  } catch {
    mockTokens = [];
  }

  let leadCount = 0;
  try {
    leadCount = csirLeadsStore.readLeads().length;
  } catch {
    leadCount = 0;
  }

  const courseCount = courses.length;
  const pdfCount = materials.length;
  const liveCount = liveRows.length;
  const gateCount = gatePapers.length;
  const mockCount = mockTokens.length;
  const doubtsEnabled = true;
  const doubtsAi = doubtAssistant.isConfigured();

  const statFor = {
    'live-recorded': liveCount
      ? `${liveCount} live slot${liveCount === 1 ? '' : 's'}`
      : `${courseCount} course${courseCount === 1 ? '' : 's'}`,
    'downloadable-pdfs': `${pdfCount} PDF${pdfCount === 1 ? '' : 's'}`,
    'daily-practice': `${Math.max(3, mockCount)} quizzes`,
    'full-mocks': `${gateCount} GATE paper${gateCount === 1 ? '' : 's'}`,
    'doubt-support': doubtsAi ? 'AI assistant' : 'Ask doubts',
    'progress-tracking': 'Your activity'
  };

  const features = BENEFIT_FEATURES.map((f) => ({
    slug: f.slug,
    icon: f.icon,
    title: f.title,
    summary: f.summary,
    stat: statFor[f.slug] || 'Available',
    href: `/why-feature.html?slug=${encodeURIComponent(f.slug)}`,
    primaryHref: f.primaryHref,
    available: true
  }));

  const baseLearners = 2400;
  const learnerCount = baseLearners + courseCount * 15 + leadCount * 3;

  return {
    headline: 'Join thousands practising daily',
    subhead: 'Live + recorded learning, structured materials, and exam-ready mocks.',
    learnerCount,
    features,
    learnAnywhere: LEARN_ANYWHERE,
    counts: {
      courses: courseCount,
      materials: pdfCount,
      liveSessions: liveCount,
      gatePapers: gateCount,
      mockTests: mockCount,
      doubtsAi
    },
    updatedAt: new Date().toISOString()
  };
}

function getBenefitBySlug(slug) {
  const key = String(slug || '').trim();
  const base = BENEFIT_FEATURES.find((f) => f.slug === key);
  if (!base) return null;
  const overview = buildOverview();
  const live = overview.features.find((f) => f.slug === key);
  return {
    slug: base.slug,
    title: base.title,
    summary: base.summary,
    details: base.details,
    stat: live ? live.stat : null,
    primaryLabel: base.primaryLabel,
    primaryHref: base.primaryHref
  };
}

function listBenefitSummaries() {
  return buildOverview().features;
}

module.exports = {
  BENEFIT_FEATURES,
  LEARN_ANYWHERE,
  buildOverview,
  getBenefitBySlug,
  listBenefitSummaries
};

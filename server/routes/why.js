const express = require('express');
const { getBenefitBySlug } = require('../lib/platformFeatures');

const router = express.Router();

const WHY_FEATURES = [
  {
    slug: 'catalog',
    title: 'Curated Catalog',
    summary: 'Find JEE / NEET, UPSC, coding, and research tracks in one searchable place.',
    details: [
      'Filter by category, level, language, and price.',
      'Mix YouTube, uploaded, and external resources in one grid.',
      'Keep free and paid options visible together for easy comparison.'
    ],
    primaryLabel: 'Open courses',
    primaryHref: '/courses.html'
  },
  {
    slug: 'live-labs',
    title: 'Live Doubt Labs',
    summary: 'Join scheduled sessions and continue practice with recordings and playlist support.',
    details: [
      'Live timetable for quick access to sessions.',
      'In-page YouTube playlist player for replay and revision.',
      'Bridge live and self-paced learning without changing platforms.'
    ],
    primaryLabel: 'View schedule',
    primaryHref: '/live-classes.html'
  },
  {
    slug: 'research-blog',
    title: 'Research Blog',
    summary: 'Practical writing and methods guidance for students moving toward serious research.',
    details: [
      'IMRAD, reading strategy, and literature workflow guidance.',
      'Short actionable notes designed for immediate application.',
      'Linked to courses and live sessions for deeper follow-through.'
    ],
    primaryLabel: 'Read articles',
    primaryHref: '/blog.html'
  },
  {
    slug: 'plans',
    title: 'Plans That Scale',
    summary: 'Start free and upgrade only when you need live hours or mentorship.',
    details: [
      'Transparent plan differences and upgrade path.',
      'Free catalog access remains available while you explore.',
      'Pro and team options for higher-touch support.'
    ],
    primaryLabel: 'Compare plans',
    primaryHref: '/pricing.html'
  }
];

router.get('/', (_req, res) => {
  res.json(
    WHY_FEATURES.map((x) => ({
      slug: x.slug,
      title: x.title,
      summary: x.summary,
      primaryLabel: x.primaryLabel,
      primaryHref: x.primaryHref
    }))
  );
});

router.get('/:slug', (req, res) => {
  const platformFeature = getBenefitBySlug(req.params.slug);
  if (platformFeature) {
    return res.json(platformFeature);
  }
  const feature = WHY_FEATURES.find((x) => x.slug === req.params.slug);
  if (!feature) {
    return res.status(404).json({ error: 'Feature not found' });
  }
  return res.json(feature);
});

module.exports = router;

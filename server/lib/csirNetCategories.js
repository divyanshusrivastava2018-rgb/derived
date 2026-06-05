/** CSIR-NET JRF folder → normalized study / MCQ categories */
const CSIR_NET_CATEGORIES = [
  {
    name: 'CSIR NET Syllabus',
    slug: 'csir-syllabus',
    code: 'SYL',
    image: '/images/materials/syllabus-keys.svg',
    sourceFolders: ['__root__']
  },
  {
    name: 'Real Analysis',
    slug: 'csir-real-analysis',
    code: 'RA',
    image: '/images/materials/metric-spaces.svg',
    sourceFolders: ['REAL ANALYSIS', 'Real Assingment']
  },
  {
    name: 'Linear Algebra',
    slug: 'csir-linear-algebra',
    code: 'LA',
    image: '/images/materials/linear-algebra.svg',
    sourceFolders: ['LINEAR ALGEBRA', 'Linear Assignment']
  },
  {
    name: 'Complex Analysis',
    slug: 'csir-complex-analysis',
    code: 'CA',
    image: '/images/materials/complex-analysis.svg',
    sourceFolders: ['COMPLEX ANASLYSIS', 'COMPLEX ASSINGMENT']
  },
  {
    name: 'Abstract Algebra',
    slug: 'csir-abstract-algebra',
    code: 'AA',
    image: '/images/materials/reference-books.svg',
    sourceFolders: ['ABASTRACT ALGEBRA']
  },
  {
    name: 'Differential Equations',
    slug: 'csir-differential-equations',
    code: 'DE',
    image: '/images/materials/dips-notes.svg',
    sourceFolders: ['DIFFENTIAL EQUATION', 'ODE Assingnment']
  },
  {
    name: 'Numerical Analysis',
    slug: 'csir-numerical-analysis',
    code: 'NA',
    image: '/images/materials/numerical-analysis.svg',
    sourceFolders: ['numberical analysis ']
  },
  {
    name: 'Integral Equations & COV',
    slug: 'csir-integral-equations',
    code: 'IE',
    image: '/images/materials/topology.svg',
    sourceFolders: ['Integral equation and Cov']
  },
  {
    name: 'CSIR NET Mixed Practice',
    slug: 'csir-net-mixed',
    code: 'MIX',
    image: '/images/materials/question-banks.svg',
    sourceFolders: ['CSIR NET']
  }
];

const FOLDER_TO_SLUG = {};
CSIR_NET_CATEGORIES.forEach((cat) => {
  cat.sourceFolders.forEach((folder) => {
    FOLDER_TO_SLUG[folder] = cat.slug;
  });
});

function categoryForPath(relPath) {
  const parts = String(relPath || '').split(/[/\\]/);
  const basename = parts[parts.length - 1] || '';
  if (/syllabus_csir/i.test(basename)) return 'csir-syllabus';
  const folder = parts.length >= 2 ? parts[parts.length - 2] : '';
  return FOLDER_TO_SLUG[folder] || 'csir-net-mixed';
}

function getCategoryBySlug(slug) {
  return CSIR_NET_CATEGORIES.find((c) => c.slug === slug) || null;
}

module.exports = {
  CSIR_NET_CATEGORIES,
  FOLDER_TO_SLUG,
  categoryForPath,
  getCategoryBySlug
};

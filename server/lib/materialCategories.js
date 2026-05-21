/** Category labels and sort order for study materials UI */
const CATEGORY_ORDER = [
  'DIPS Handwritten Notes',
  'DIPS Notes',
  'GATE Papers & Solutions',
  'IIT JAM Papers & Prep',
  'Topology',
  'Metric Spaces',
  'Complex Analysis',
  'Linear Algebra',
  'Functional Analysis',
  'Numerical Analysis',
  'Class 12 Mathematics',
  'Syllabus & Keys',
  'Reference Books & General',
  'Question Banks & Miscellaneous'
];

const CATEGORY_SLUGS = {
  'DIPS Handwritten Notes': 'dips-handwritten',
  'DIPS Notes': 'dips-notes',
  'GATE Papers & Solutions': 'gate-papers',
  'IIT JAM Papers & Prep': 'iit-jam',
  Topology: 'topology',
  'Metric Spaces': 'metric-spaces',
  'Complex Analysis': 'complex-analysis',
  'Linear Algebra': 'linear-algebra',
  'Functional Analysis': 'functional-analysis',
  'Numerical Analysis': 'numerical-analysis',
  'Class 12 Mathematics': 'class-12',
  'Syllabus & Keys': 'syllabus-keys',
  'Reference Books & General': 'reference-books',
  'Question Banks & Miscellaneous': 'question-banks'
};

function categorizeByFilename(name) {
  const n = String(name || '').toLowerCase();

  if (/\bdips\b|dips-|dips\s/i.test(name)) return 'DIPS Notes';
  if (
    /^gate[\s_-]|gate\s+(19|20)\d{2}|gate_20|gate-20|gate solved|gate syllabus|gate_mathematics|gate_26|ma2025|ma24s4|makey/i.test(
      n
    )
  )
    return 'GATE Papers & Solutions';
  if (
    /^jam\s|jam\s20|iit[\s_-]?jam|pw_iit|krishnas.*jam|jam 2023 syllabus/i.test(n)
  )
    return 'IIT JAM Papers & Prep';
  if (/class[\s_-]?12/i.test(n)) return 'Class 12 Mathematics';
  if (/syllabus|makey|ma2025|ma24s4/i.test(n)) return 'Syllabus & Keys';
  if (/metric[\s_-]?space|metric_space|metric-spaces|note[1-4]_metric/i.test(n))
    return 'Metric Spaces';
  if (
    /topology|topolog|diecktop|munkres|counterexample.*topolog|algebraic topolog|basic topolog|complete topological|mortad|bhatti|invitation.*topolog|general-topology|steen.*topolog|parthasarathy|joshi.*topolog|topology notes|mt 202 general topology/i.test(
      n
    )
  )
    return 'Topology';
  if (/complex|rudin complex|schaum complex|ponnusamy/i.test(n)) return 'Complex Analysis';
  if (/linear algebra|matrix algebra/i.test(n)) return 'Linear Algebra';
  if (/banach|hilbert/i.test(n)) return 'Functional Analysis';
  if (/numerical|sauer/i.test(n)) return 'Numerical Analysis';
  if (/^5_\d{10,}|^515519557/i.test(n)) return 'Question Banks & Miscellaneous';
  return 'Reference Books & General';
}

function slugifyFilename(name) {
  const base = String(name || '')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return (base || 'file').slice(0, 120);
}

function sortIndex(category) {
  const idx = CATEGORY_ORDER.indexOf(category);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

module.exports = {
  CATEGORY_ORDER,
  CATEGORY_SLUGS,
  categorizeByFilename,
  slugifyFilename,
  sortIndex
};

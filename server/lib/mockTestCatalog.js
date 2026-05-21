const fs = require('fs');
const path = require('path');
const gateMcqBank = require('./gateMcqBank');
const { formatMathText, formatQuizItem } = require('./mathLatex');

const CATEGORIES_FILE = path.join(__dirname, '..', '..', 'public', 'data', 'material-categories.json');
const MATERIALS_FILE = path.join(__dirname, '..', 'data', 'materials.json');

const CATEGORY_QUIZ = {
  Topology: [
    {
      question:
        'Which is a metric on $(0,1)$? $d_1(x,y)=|\\log(x/y)|$, and $d_2(x,y)=|x|+|y|$ if $x\\neq y$, else $0$.',
      options: ['Both TRUE', 'P TRUE, Q FALSE', 'P FALSE, Q TRUE', 'Both FALSE'],
      answerIndex: 0
    },
    {
      question: 'If $f(z)=u+iv$ is analytic and non-constant, then $g_1=u_{x} - i u_{y}$ is:',
      options: ['Analytic', 'Not analytic', 'Harmonic only', 'Constant'],
      answerIndex: 0
    },
    {
      question:
        'For $y\'\'+\\lambda y=0$ with $y(0)=0$ and $y(\\pi)-y\'(\\pi)=0$, the eigenvalues satisfy:',
      options: [
        '$\\lambda=(n\\pi)^2$',
        '$\\lambda=n^2$',
        '$\\lambda=k_n^2$ where $k-\\tan(k\\pi)=0$',
        '$\\lambda=k_n^2$ where $k+\\tan(k\\pi)=0$'
      ],
      answerIndex: 2
    }
  ],
  'Complex Analysis': [
    {
      question:
        'A Möbius map sends $0\\to 10$, $-i\\to 5-5i$, $\\infty\\to 5+5i$. The image of $\\operatorname{Re}(z)<0$ is:',
      options: ['$|w|<5$', '$|w|>5$', '$|w-5|<5$', '$|w-5|>5$'],
      answerIndex: 2
    },
    {
      question: 'If $f(z)$ is analytic and non-constant, then $g(z)=u_{x} - i u_{y}$ is:',
      options: ['Analytic', 'Not analytic', 'Constant', 'Harmonic only'],
      answerIndex: 0
    }
  ],
  'Linear Algebra': [
    {
      question:
        'If $A$ is $4\\times 4$ with eigenvalues $1,1,2,2$, then $\\operatorname{tr}(A^{4} - A)$ equals:',
      options: ['$28$', '$24$', '$36$', '$20$'],
      answerIndex: 0
    },
    {
      question:
        'Let $A$ be $3\\times 4$, $B$ be $4\\times 3$ with $AB$ non-singular. P: $\\operatorname{nullity}(A)=0$; Q: $BA$ is non-singular.',
      options: [
        'Both P & Q are TRUE',
        'P is TRUE, Q is FALSE',
        'P is FALSE, Q is TRUE',
        'Both are FALSE'
      ],
      answerIndex: 3
    },
    {
      question:
        'Let $A$ be a $3\\times 3$ real symmetric matrix with eigenvalues $1,2,3$. Then $\\det(A^{2}+2A+I)$ equals',
      options: ['$100$', '$144$', '$64$', '$36$'],
      answerIndex: 1
    },
    {
      question:
        'The dimension of the null space of $A = \\begin{pmatrix}1 & 2 & 3\\\\ 4 & 5 & 6\\\\ 7 & 8 & 9\\end{pmatrix}$ is',
      options: ['$0$', '$1$', '$2$', '$3$'],
      answerIndex: 1
    },
    {
      question:
        'If $A$ is an $n\\times n$ idempotent matrix ($A^{2}=A$) of rank $r$, then the eigenvalues of $A$ are',
      options: [
        'All zeros',
        'All ones',
        '$r$ ones and $(n-r)$ zeros',
        '$n$ ones'
      ],
      answerIndex: 2
    },
    {
      question:
        'The Jordan canonical form of $A = \\begin{pmatrix}2 & 1 & 0\\\\ 0 & 2 & 1\\\\ 0 & 0 & 2\\end{pmatrix}$ is',
      options: [
        '$\\operatorname{diag}(2,2,2)$',
        '$\\begin{pmatrix}2 & 1 & 0\\\\ 0 & 2 & 0\\\\ 0 & 0 & 2\\end{pmatrix}$',
        '$\\begin{pmatrix}2 & 1 & 0\\\\ 0 & 2 & 1\\\\ 0 & 0 & 2\\end{pmatrix}$',
        '$\\operatorname{diag}(2,2,0)$'
      ],
      answerIndex: 2
    },
    {
      question:
        'Let $T:\\mathbb{R}^{3}\\to\\mathbb{R}^{3}$ be linear with $T(x,y,z)=(x+y,\\,y+z,\\,z+x)$. Then $\\operatorname{rank}(T)$ is',
      options: ['$1$', '$2$', '$3$', '$0$'],
      answerIndex: 2
    }
  ],
  'Metric Spaces': [
    {
      question:
        'Which is a metric on $(0,1)$? $d_1(x,y)=|\\log(x/y)|$, and $d_2(x,y)=|x|+|y|$ if $x\\neq y$, else $0$.',
      options: ['Both TRUE', 'P TRUE, Q FALSE', 'P FALSE, Q TRUE', 'Both FALSE'],
      answerIndex: 0
    }
  ],
  'DIPS Notes': [
    {
      question: 'Family $u = xy + f(x^{2}-y^{2})$ satisfies PDE:',
      options: [
        '$y\\,u_{x} + x\\,u_{y} = x^{2}+y^{2}$',
        '$x\\,u_{x} + y\\,u_{y} = x^{2}-y^{2}$',
        '$y\\,u_{x} + x\\,u_{y} = 0$',
        '$x\\,u_{x} - y\\,u_{y} = 0$'
      ],
      answerIndex: 0
    }
  ],
  'IIT JAM Papers & Prep': [
    {
      question:
        'Wave equation: $u_{tt} = u_{xx}$, $u(x,0)=0$, $u_t(x,0)=4x e^{-x^2}$. Then $u(5,5)$ equals:',
      options: ['$1 - e^{-100}$', '$1 - e^{100}$', '$1 - e^{-10}$', '$1 - e^{10}$'],
      answerIndex: 0
    }
  ],
  'Numerical Analysis': [
    {
      question:
        'Fixed-point iteration $x_{n+1}=3+(x_n-3)^3$ with $x_0=3.25$. Order of convergence?',
      options: ['$1$', '$2$', '$3$', '$4$'],
      answerIndex: 0
    }
  ],
  'General Aptitude': [
    {
      question: 'If 40% of a number is 280, the number is:',
      options: ['700', '560', '1120', '350'],
      answerIndex: 0
    },
    {
      question: 'Antonym of BREVITY is:',
      options: ['Conciseness', 'Verbosity', 'Clarity', 'Speed'],
      answerIndex: 1
    }
  ]
};

/** GATE bank question ids grouped by study-material category */
const CATEGORY_GATE_IDS = {
  'DIPS Handwritten Notes': ['ga1', 'ga2', 'ga3', 'ga4', 'ga5', 'ga6', 'ga7', 'ga8', 'ga9', 'ga10'],
  'DIPS Notes': ['ma6', 'ma18', 'ma7', 'ma20'],
  'IIT JAM Papers & Prep': ['ma7', 'ma16', 'ma8', 'ma5'],
  Topology: ['ma11', 'ma5', 'ma12', 'ma4'],
  'Metric Spaces': ['ma11', 'ma12', 'ma10'],
  'Complex Analysis': ['ma2', 'ma3', 'ma15', 'ma19'],
  'Linear Algebra': ['ma1', 'ma4', 'ma13', 'ma17', 'ma4', 'ma13'],
  'Functional Analysis': ['ma9', 'ma10', 'ma11'],
  'Numerical Analysis': ['ma8', 'ma16', 'ma12'],
  'Class 12 Mathematics': ['ga8', 'ma13', 'ga2', 'ga6'],
  'Syllabus & Keys': ['ga1', 'ga5', 'ga9', 'ga10'],
  'Reference Books & General': ['ga3', 'ga4', 'ga7', 'ma14'],
  'Question Banks & Miscellaneous': ['ma1', 'ma2', 'ma7', 'ga6', 'ma15', 'ma18']
};

const GATE_BANK_FILE = path.join(__dirname, '..', 'data', 'gate-mcq-bank.json');
let gateQuizById = null;

function loadGateQuizById() {
  if (gateQuizById) return gateQuizById;
  const bank = JSON.parse(fs.readFileSync(GATE_BANK_FILE, 'utf8'));
  gateQuizById = {};
  bank.questions.forEach((q) => {
    const item = formatQuizItem({
      question: q.text,
      options: q.options,
      answerIndex: q.answerIndex
    });
    gateQuizById[q.id] = item;
  });
  return gateQuizById;
}

function dedupeQuestions(list) {
  const seen = new Set();
  const out = [];
  list.forEach((q) => {
    const key = q.question;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(q);
  });
  return out;
}

function getCategoryQuizPool(categoryName) {
  const dedicated = (CATEGORY_QUIZ[categoryName] || []).map((q) =>
    formatQuizItem({ question: q.question, options: q.options, answerIndex: q.answerIndex })
  );
  const byId = loadGateQuizById();
  const picked = [];
  const ids = CATEGORY_GATE_IDS[categoryName];
  if (ids) {
    ids.forEach((id) => {
      if (byId[id]) picked.push(byId[id]);
    });
  } else {
    Object.keys(byId)
      .filter((id) => id.startsWith('ma'))
      .forEach((id) => picked.push(byId[id]));
  }
  const merged = dedupeQuestions(dedicated.concat(picked));
  if (merged.length >= 10) return merged;
  const extra = Object.values(byId).filter((q) => !merged.some((m) => m.question === q.question));
  return dedupeQuestions(merged.concat(extra));
}

function loadCategories() {
  return JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));
}

function pdfCountByCategory() {
  const counts = {};
  if (!fs.existsSync(MATERIALS_FILE)) return counts;
  const materials = JSON.parse(fs.readFileSync(MATERIALS_FILE, 'utf8'));
  materials.forEach((m) => {
    const cat = m.category || 'Other';
    counts[cat] = (counts[cat] || 0) + 1;
  });
  return counts;
}

function listMockTests() {
  const pdfCounts = pdfCountByCategory();
  const categories = loadCategories();
  const tokens = [];

  gateMcqBank.listPapers().forEach((p) => {
    tokens.push({
      id: 'gate-' + p.slug,
      group: 'gate-year',
      groupLabel: 'GATE Mathematics (Year-wise)',
      title: 'GATE Mathematics ' + p.year + ' — Full Mock',
      badge: 'GATE ' + p.year + ' · CBT Mock Test',
      code: 'GATE',
      image: '/images/materials/gate-papers.svg',
      totalQuestions: p.totalQuestions,
      totalMarks: p.totalMarks,
      durationMinutes: p.durationMinutes,
      pdfCount: pdfCounts['GATE Papers & Solutions'] || 0,
      attemptUrl: '/gate-exam.html?year=' + encodeURIComponent(p.slug) + '&name=Candidate',
      studyUrl: '/study-materials.html?category=gate-papers',
      attemptType: 'gate-exam'
    });
  });

  categories.forEach((cat) => {
    if (cat.slug === 'gate-papers') return;
    const pdfCount = pdfCounts[cat.name] || 0;
    const quizPool = getCategoryQuizPool(cat.name);
    const qCount = 10;
    const marks = qCount;
    tokens.push({
      id: 'cat-' + cat.slug,
      group: 'category',
      groupLabel: 'PDF Study Categories',
      title: cat.name + ' — Practice Mock',
      badge: cat.code + ' · ' + pdfCount + ' PDFs in library',
      code: cat.code,
      image: cat.image,
      totalQuestions: qCount,
      totalMarks: marks,
      durationMinutes: Math.max(15, qCount * 2),
      pdfCount,
      attemptUrl: '/mcq-test.html?category=' + encodeURIComponent(cat.slug) + '&auto=1',
      studyUrl: '/study-materials.html?category=' + encodeURIComponent(cat.slug),
      attemptType: 'category-quiz',
      quizTopic: cat.name
    });
  });

  return { tokens, groups: ['gate-year', 'category'] };
}

function getCategoryBySlug(slug) {
  const list = loadCategories();
  return list.find((c) => c.slug === slug) || null;
}

module.exports = {
  listMockTests,
  CATEGORY_QUIZ,
  loadCategories,
  getCategoryBySlug,
  getCategoryQuizPool
};

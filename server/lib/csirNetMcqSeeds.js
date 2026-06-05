/** Curated CSIR-NET Mathematical Sciences MCQ seeds by category slug */
module.exports = {
  'csir-syllabus': [
    {
      text: 'CSIR NET Mathematical Sciences Part B carries how many questions (typically)?',
      options: ['20', '25', '30', '40'],
      answerIndex: 1,
      topic: 'Exam pattern'
    },
    {
      text: 'Negative marking in Part B is usually:',
      options: ['0.25 marks', '0.5 marks', '0.75 marks', '1 mark'],
      answerIndex: 1,
      topic: 'Exam pattern'
    }
  ],
  'csir-real-analysis': [
    {
      text: 'Every Cauchy sequence in $\\mathbb{R}$ is:',
      options: ['Bounded only', 'Convergent', 'Monotonic', 'Not necessarily bounded'],
      answerIndex: 1,
      topic: 'Sequences'
    },
    {
      text: 'If $f:[a,b]\\to\\mathbb{R}$ is continuous, then $f$ is Riemann integrable iff:',
      options: [
        'It is differentiable',
        'Its set of discontinuities has measure zero',
        'It is monotonic only',
        'It is bounded only'
      ],
      answerIndex: 1,
      topic: 'Integration'
    },
    {
      text: 'The set $\\mathbb{Q}$ in $\\mathbb{R}$ with usual topology is:',
      options: ['Open', 'Closed', 'Neither open nor closed', 'Compact'],
      answerIndex: 2,
      topic: 'Topology on R'
    },
    {
      text: 'If $(f_n)$ converges uniformly to $f$ on $[a,b]$, then:',
      options: [
        '$\\int f_n \\to \\int f$',
        '$f_n$ need not be continuous',
        'Limit may fail for derivatives always',
        'Uniform limit never preserves continuity'
      ],
      answerIndex: 0,
      topic: 'Uniform convergence'
    },
    {
      text: 'A complete metric space is one in which:',
      options: [
        'Every bounded sequence converges',
        'Every Cauchy sequence converges',
        'Every sequence has a convergent subsequence',
        'Every open set is closed'
      ],
      answerIndex: 1,
      topic: 'Metric spaces'
    }
  ],
  'csir-linear-algebra': [
    {
      text: 'If $A$ is $3\\times 3$ with eigenvalues $1,2,3$, then $\\det(A)$ equals:',
      options: ['6', '5', '0', '1'],
      answerIndex: 0,
      topic: 'Eigenvalues'
    },
    {
      text: 'Dimension of the space of $2\\times 2$ skew-symmetric matrices over $\\mathbb{R}$ is:',
      options: ['4', '3', '2', '1'],
      answerIndex: 3,
      topic: 'Vector spaces'
    },
    {
      text: 'If $A$ is idempotent ($A^2=A$) of rank $r$, then eigenvalues of $A$ are:',
      options: ['All 0', 'All 1', '$r$ ones and $(n-r)$ zeros', 'Only 2'],
      answerIndex: 2,
      topic: 'Idempotent matrices'
    },
    {
      text: 'For matrices $A_{m\\times n}, B_{n\\times p}$, $\\operatorname{rank}(AB)$ satisfies:',
      options: [
        '$\\operatorname{rank}(AB)=\\operatorname{rank}(A)+\\operatorname{rank}(B)$',
        '$\\operatorname{rank}(AB)\\le\\min(\\operatorname{rank}A,\\operatorname{rank}B)$',
        '$\\operatorname{rank}(AB)=\\operatorname{rank}A$ always',
        '$\\operatorname{rank}(AB)=np$'
      ],
      answerIndex: 1,
      topic: 'Rank'
    }
  ],
  'csir-complex-analysis': [
    {
      text: 'If $f$ is analytic on $\\mathbb{C}$ and bounded, then by Liouville theorem $f$ is:',
      options: ['Constant', 'Polynomial', 'Entire non-constant', 'Not defined'],
      answerIndex: 0,
      topic: 'Liouville'
    },
    {
      text: 'Residue of $f(z)=\\frac{1}{z^2(z-1)}$ at $z=0$ is:',
      options: ['$0$', '$1$', '$-1$', '$2$'],
      answerIndex: 0,
      topic: 'Residues'
    },
    {
      text: 'If $f(z)=u+iv$ is analytic, then $u$ and $v$ satisfy:',
      options: ['Laplace equation', 'Wave equation', 'Heat equation only', 'No PDE'],
      answerIndex: 0,
      topic: 'Cauchy-Riemann'
    }
  ],
  'csir-abstract-algebra': [
    {
      text: 'Every group of order $p^2$ ($p$ prime) is:',
      options: ['Cyclic only', 'Abelian', 'Simple', 'Symmetric'],
      answerIndex: 1,
      topic: 'Group theory'
    },
    {
      text: 'In $\\mathbb{Z}_6\\oplus\\mathbb{Z}_{15}$, order of $(2,3)$ is:',
      options: ['6', '10', '15', '30'],
      answerIndex: 2,
      topic: 'Direct products'
    },
    {
      text: 'A ring homomorphism preserves:',
      options: ['Only addition', 'Only multiplication', 'Addition and multiplication', 'Division always'],
      answerIndex: 2,
      topic: 'Ring theory'
    }
  ],
  'csir-differential-equations': [
    {
      text: 'The general solution of $y\'\'+y=0$ is:',
      options: [
        '$c_1 e^x + c_2 e^{-x}$',
        '$c_1\\cos x + c_2\\sin x$',
        '$c_1 x + c_2$',
        '$c_1 e^{2x}$'
      ],
      answerIndex: 1,
      topic: 'Second order ODE'
    },
    {
      text: 'An ODE $M\\,dx+N\\,dy=0$ is exact iff:',
      options: ['$M=N$', '$\\partial M/\\partial y = \\partial N/\\partial x$', '$M+N=0$', '$M=N=0$'],
      answerIndex: 1,
      topic: 'Exact equations'
    }
  ],
  'csir-numerical-analysis': [
    {
      text: 'Newton-Raphson method for finding roots has order of convergence:',
      options: ['1', '2', '3', '0.5'],
      answerIndex: 1,
      topic: 'Root finding'
    },
    {
      text: 'Trapezoidal rule is exact for polynomials of degree at most:',
      options: ['0', '1', '2', '3'],
      answerIndex: 1,
      topic: 'Integration rules'
    }
  ],
  'csir-integral-equations': [
    {
      text: 'A Fredholm integral equation of the second kind has the form:',
      options: [
        '$\\int_a^b K(x,t)u(t)\\,dt = f(x)$',
        '$u(x)=f(x)+\\lambda\\int_a^b K(x,t)u(t)\\,dt$',
        '$u\'(x)=\\int K(x,t)u(t)\\,dt$',
        '$u(x)=0$'
      ],
      answerIndex: 1,
      topic: 'Fredholm equations'
    },
    {
      text: 'Euler-Lagrange equation arises in:',
      options: ['Calculus of variations', 'Complex analysis', 'Graph theory', 'Number theory'],
      answerIndex: 0,
      topic: 'Calculus of variations'
    }
  ],
  'csir-net-mixed': [
    {
      text: 'Which is NOT a standard unit of CSIR NET Mathematical Sciences syllabus?',
      options: ['Real Analysis', 'Quantum Chemistry', 'Linear Algebra', 'Complex Analysis'],
      answerIndex: 1,
      topic: 'Syllabus overview'
    },
    {
      text: 'Part C questions in CSIR NET are typically worth:',
      options: ['1 mark each', '2 marks each', '4 marks each', '5 marks each'],
      answerIndex: 2,
      topic: 'Exam pattern'
    }
  ]
};

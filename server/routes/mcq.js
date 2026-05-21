const express = require('express');
const rateLimit = require('express-rate-limit');
const { nanoid } = require('nanoid');

const router = express.Router();
const jsonParser = express.json({ limit: '64kb' });

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many test generations. Try again later.' }
});

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Try again later.' }
});

const MCQ_BANK = {
  'JEE / NEET': [
    {
      question: 'If f(x)=x^2, then f\'(3) equals?',
      options: ['3', '6', '9', '12'],
      answerIndex: 1
    },
    {
      question: 'SI unit of electric current is?',
      options: ['Volt', 'Ohm', 'Ampere', 'Watt'],
      answerIndex: 2
    },
    {
      question: 'pH value of neutral water at 25°C is?',
      options: ['0', '7', '10', '14'],
      answerIndex: 1
    },
    {
      question: 'sin^2(theta) + cos^2(theta) is always?',
      options: ['0', '1', '2', 'Depends on theta'],
      answerIndex: 1
    },
    {
      question: 'Acceleration due to gravity near Earth is approximately?',
      options: ['9.8 m/s^2', '4.9 m/s^2', '3.0 m/s^2', '1.6 m/s^2'],
      answerIndex: 0
    },
    {
      question: 'Atomic number represents number of?',
      options: ['Neutrons', 'Protons', 'Nucleons', 'Isotopes'],
      answerIndex: 1
    },
    {
      question: 'Integral of 2x dx is?',
      options: ['x^2 + C', '2x + C', 'x + C', '2x^2 + C'],
      answerIndex: 0
    },
    {
      question: 'Speed of light in vacuum is closest to?',
      options: ['3 x 10^8 m/s', '3 x 10^6 m/s', '3 x 10^5 km/s', '1.5 x 10^8 m/s'],
      answerIndex: 0
    }
  ],
  UPSC: [
    {
      question: 'Directive Principles are included in which part of the Indian Constitution?',
      options: ['Part III', 'Part IV', 'Part V', 'Part VI'],
      answerIndex: 1
    },
    {
      question: 'Which river is known as the "Sorrow of Bihar"?',
      options: ['Kosi', 'Gandak', 'Son', 'Damodar'],
      answerIndex: 0
    },
    {
      question: 'Finance Commission is constituted under which Article?',
      options: ['Article 280', 'Article 356', 'Article 324', 'Article 368'],
      answerIndex: 0
    },
    {
      question: 'The President can proclaim National Emergency under Article?',
      options: ['352', '360', '356', '365'],
      answerIndex: 0
    }
  ],
  'Coding & AI': [
    {
      question: 'Which keyword declares a constant in JavaScript?',
      options: ['let', 'var', 'const', 'static'],
      answerIndex: 2
    },
    {
      question: 'Time complexity of binary search on sorted array is?',
      options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'],
      answerIndex: 1
    },
    {
      question: 'Which Python library is commonly used for dataframes?',
      options: ['NumPy', 'Pandas', 'Matplotlib', 'TensorFlow'],
      answerIndex: 1
    },
    {
      question: 'In machine learning, overfitting means model:',
      options: [
        'Performs well on training but poorly on unseen data',
        'Performs poorly on both training and test data',
        'Uses too little data',
        'Cannot converge'
      ],
      answerIndex: 0
    }
  ]
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickQuestions(topic, count) {
  const pool = MCQ_BANK[topic] || MCQ_BANK['JEE / NEET'];
  const c = Math.max(1, Math.min(20, Number(count) || 10));
  if (pool.length >= c) return shuffle(pool).slice(0, c);
  const out = [];
  while (out.length < c) {
    out.push(pool[out.length % pool.length]);
  }
  return shuffle(out).slice(0, c);
}

const ACTIVE_TESTS = new Map();
const TEST_TTL_MS = 30 * 60 * 1000;

function toPublicQuestion(q, i) {
  return {
    id: `q${i + 1}`,
    question: q.question,
    options: q.options
  };
}

function cleanupTests() {
  const now = Date.now();
  for (const [id, t] of ACTIVE_TESTS) {
    if (!t || now > t.expiresAt) ACTIVE_TESTS.delete(id);
  }
}

const sweepTimer = setInterval(cleanupTests, 10 * 60 * 1000);
if (sweepTimer.unref) sweepTimer.unref();

router.get('/topics', (_req, res) => {
  res.json({ topics: Object.keys(MCQ_BANK) });
});

router.post('/generate', generateLimiter, jsonParser, (req, res) => {
  const body = req.body || {};
  const topic = String(body.topic || 'JEE / NEET').trim();
  const count = body.count;
  const picked = pickQuestions(topic, count);
  const testId = nanoid(18);
  ACTIVE_TESTS.set(testId, {
    createdAt: Date.now(),
    expiresAt: Date.now() + TEST_TTL_MS,
    topic: MCQ_BANK[topic] ? topic : 'JEE / NEET',
    answers: picked.map((q) => q.answerIndex)
  });
  res.json({
    ok: true,
    testId,
    topic: MCQ_BANK[topic] ? topic : 'JEE / NEET',
    count: picked.length,
    questions: picked.map(toPublicQuestion)
  });
});

router.post('/submit', submitLimiter, jsonParser, (req, res) => {
  const body = req.body || {};
  const testId = typeof body.testId === 'string' ? body.testId.trim() : '';
  const answers = Array.isArray(body.answers) ? body.answers : [];
  if (!testId) return res.status(400).json({ error: 'testId is required' });
  const test = ACTIVE_TESTS.get(testId);
  if (!test) {
    return res.status(404).json({ error: 'Test not found or expired' });
  }
  if (Date.now() > test.expiresAt) {
    ACTIVE_TESTS.delete(testId);
    return res.status(404).json({ error: 'Test expired. Generate a new test.' });
  }
  const expected = test.answers;
  const normalized = expected.map((_, i) => {
    const v = answers[i];
    return Number.isInteger(v) ? v : Number(v);
  });
  let score = 0;
  for (let i = 0; i < expected.length; i += 1) {
    if (normalized[i] === expected[i]) score += 1;
  }
  const total = expected.length;
  const percentage = total > 0 ? Math.round((score * 100) / total) : 0;
  return res.json({ ok: true, score, total, percentage, topic: test.topic });
});

module.exports = router;

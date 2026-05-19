/** Static CSIR UGC NET catalog (Derived landing page). */

const subjects = [
  { id: 1, name: 'Life Science', icon: '🔬', lessonCount: 1200, slug: 'life-science' },
  { id: 2, name: 'Chemical Science', icon: '⚗️', lessonCount: 980, slug: 'chemical-science' },
  { id: 3, name: 'Mathematical Science', icon: '📐', lessonCount: 850, slug: 'mathematical-science' },
  { id: 4, name: 'Earth Science', icon: '🌍', lessonCount: 740, slug: 'earth-science' },
  { id: 5, name: 'Physical Science', icon: '⚡', lessonCount: 1100, slug: 'physical-science' }
];

const educators = [
  {
    id: 1,
    name: 'Dr. Arjun Kumar',
    subject: 'Life Science',
    institution: 'IIT Delhi',
    experience: 12,
    learners: 42000,
    rating: 4.9,
    lessonCount: 380,
    initials: 'AK'
  },
  {
    id: 2,
    name: 'Prof. Priya Sharma',
    subject: 'Chemical Science',
    institution: 'IISc Bangalore',
    experience: 9,
    learners: 38000,
    rating: 4.8,
    lessonCount: 290,
    initials: 'PS'
  },
  {
    id: 3,
    name: 'Dr. Rahul Verma',
    subject: 'Mathematical Science',
    institution: 'TIFR Mumbai',
    experience: 14,
    learners: 51000,
    rating: 4.9,
    lessonCount: 450,
    initials: 'RV'
  },
  {
    id: 4,
    name: 'Dr. Sneha Nair',
    subject: 'Physical Science',
    institution: 'IIT Madras',
    experience: 10,
    learners: 29000,
    rating: 4.7,
    lessonCount: 310,
    initials: 'SN'
  }
];

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    perks: ['Select free lessons', 'Limited practice tests', 'Community forums', 'AI doubts (5/day)']
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 999,
    period: 'month',
    popular: true,
    perks: [
      'All live & recorded classes',
      'Unlimited mock tests & analytics',
      'Curated batches',
      'Unlimited AI doubts 24/7',
      'Downloadable notes & PDFs',
      'Priority educator support'
    ]
  },
  {
    id: 'pro',
    name: 'Pro Annual',
    price: 6999,
    period: 'year',
    perks: [
      'Everything in Plus',
      '1-on-1 mentorship sessions',
      'Exclusive crash courses',
      'Interview preparation module',
      'Physical study material kit'
    ]
  }
];

const testimonials = [
  {
    id: 1,
    name: 'Ananya Mishra',
    subject: 'Life Science',
    rank: 'AIR 12',
    session: 'June 2025',
    rating: 5,
    quote:
      "Derived's live classes helped me understand concepts I had been struggling with for months. Qualified with AIR 12!"
  },
  {
    id: 2,
    name: 'Karthik Reddy',
    subject: 'Mathematical Science',
    rank: 'AIR 4',
    session: 'Dec 2024',
    rating: 5,
    quote:
      'The AI doubt system is a game changer — got answers instantly at midnight before my exam.'
  },
  {
    id: 3,
    name: 'Pooja Desai',
    subject: 'Chemical Science',
    rank: 'AIR 22',
    session: 'June 2025',
    rating: 5,
    quote: 'Coming from a small town with no coaching nearby, Derived was my only hope.'
  }
];

const faqs = [
  {
    id: 1,
    question: 'What is CSIR UGC NET?',
    answer:
      'CSIR UGC NET is a national eligibility test conducted by NTA for JRF and Lectureship positions in Indian universities.'
  },
  {
    id: 2,
    question: 'Can I access content for free?',
    answer:
      'Yes! Derived offers a free tier with select lessons, limited practice tests, and community forums. Upgrade anytime on the pricing page.'
  },
  {
    id: 3,
    question: 'Are live classes recorded?',
    answer:
      'All live classes are recorded and available within 24 hours. Plus and Pro subscribers get lifetime access.'
  },
  {
    id: 4,
    question: 'How many subjects are covered?',
    answer:
      'All five CSIR NET subjects are covered: Life Science, Chemical Science, Mathematical Science, Physical Science, and Earth Science.'
  },
  {
    id: 5,
    question: 'Is there a refund policy?',
    answer: 'Yes — 7-day full refund on all paid plans. Contact support within 7 days of purchase.'
  }
];

function goalStats() {
  return {
    learners: '50K+',
    educators: 500,
    successRate: '98%',
    subjects: subjects.length
  };
}

module.exports = {
  subjects,
  educators,
  plans,
  testimonials,
  faqs,
  goalStats
};

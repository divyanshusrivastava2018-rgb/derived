const fs = require('fs');
const path = require('path');
const { formatQuizItem } = require('./mathLatex');
const { getCategoryBySlug: getCsirCategory } = require('./csirNetCategories');

const BANK_FILES = [
  path.join(__dirname, '..', 'data', 'csir-net-mcq-bank.json'),
  path.join(__dirname, '..', '..', 'public', 'data', 'csir-net-mcq-bank.json')
];

let cached = null;

function loadBank() {
  if (cached) return cached;
  const file = BANK_FILES.find((p) => fs.existsSync(p));
  if (!file) {
    cached = { categories: [] };
    return cached;
  }
  cached = JSON.parse(fs.readFileSync(file, 'utf8'));
  return cached;
}

function listCategories() {
  return (loadBank().categories || []).map((c) => ({
    slug: c.slug,
    name: c.name,
    code: c.code,
    image: c.image,
    pdfCount: c.pdfCount || 0,
    totalQuestions: c.totalQuestions || (c.questions || []).length
  }));
}

function getQuizPool(categorySlug) {
  const bank = loadBank();
  const cat = (bank.categories || []).find((c) => c.slug === categorySlug);
  if (!cat) return [];
  return (cat.questions || []).map((q) =>
    formatQuizItem({
      question: q.text,
      options: q.options,
      answerIndex: q.answerIndex
    })
  );
}

function getQuizPoolByName(categoryName) {
  const bank = loadBank();
  const cat = (bank.categories || []).find((c) => c.name === categoryName);
  if (!cat) return [];
  return getQuizPool(cat.slug);
}

function isCsirCategorySlug(slug) {
  return !!getCsirCategory(slug);
}

function listMockTokens() {
  return listCategories().map((cat) => ({
    id: cat.slug,
    group: 'csir-net',
    groupLabel: 'CSIR NET JRF — Mathematical Sciences',
    title: cat.name + ' — MCQ Practice',
    badge: cat.code + ' · ' + cat.pdfCount + ' PDFs · ' + cat.totalQuestions + ' MCQs',
    code: cat.code,
    image: cat.image,
    totalQuestions: Math.min(15, cat.totalQuestions),
    totalMarks: Math.min(15, cat.totalQuestions) * 2,
    durationMinutes: Math.max(20, Math.min(15, cat.totalQuestions) * 2),
    pdfCount: cat.pdfCount,
    attemptUrl: '/mcq-test.html?category=' + encodeURIComponent(cat.slug) + '&auto=1',
    studyUrl: '/study-materials.html?category=' + encodeURIComponent(cat.slug),
    attemptType: 'category-quiz',
    quizTopic: cat.name
  }));
}

module.exports = {
  loadBank,
  listCategories,
  getQuizPool,
  getQuizPoolByName,
  isCsirCategorySlug,
  listMockTokens
};

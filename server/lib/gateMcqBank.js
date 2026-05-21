const fs = require('fs');
const path = require('path');
const { formatMathText } = require('./mathLatex');

const BANK_FILE = path.join(__dirname, '..', 'data', 'gate-mcq-bank.json');

let cache = null;
let cacheMtime = 0;

function loadBank() {
  const stat = fs.statSync(BANK_FILE);
  if (cache && stat.mtimeMs === cacheMtime) return cache;
  const raw = fs.readFileSync(BANK_FILE, 'utf8');
  cache = JSON.parse(raw);
  cacheMtime = stat.mtimeMs;
  return cache;
}

function paperTotals(paper, questionsById) {
  const byId = questionsById || {};
  loadBank().questions.forEach((q) => {
    if (!byId[q.id]) byId[q.id] = q;
  });
  let totalQuestions = 0;
  let totalMarks = 0;
  const sectionLabels = [];
  for (const sec of paper.sections) {
    sectionLabels.push(sec.label);
    for (const qid of sec.questionIds) {
      totalQuestions += 1;
      const q = byId[qid];
      if (q) totalMarks += q.marks || 0;
    }
  }
  return { totalQuestions, totalMarks, sectionLabels };
}

function listPapers() {
  const bank = loadBank();
  const questionsById = {};
  bank.questions.forEach((q) => {
    questionsById[q.id] = q;
  });
  return bank.papers.map((p) => {
    const t = paperTotals(p, questionsById);
    return {
      year: p.year,
      slug: p.slug,
      title: p.title,
      subject: p.subject,
      subjectLabel: p.subjectLabel || p.title,
      durationMinutes: p.durationMinutes,
      totalQuestions: t.totalQuestions,
      totalMarks: t.totalMarks,
      sections: p.sections.map((s) => ({
        key: s.key,
        label: s.label,
        marks1Count: s.marks1Count,
        marks2Count: s.marks2Count
      }))
    };
  });
}

function letterToIndex(letter) {
  if (!letter || typeof letter !== 'string') return 0;
  return Math.max(0, letter.toUpperCase().charCodeAt(0) - 65);
}

function getPaper(slugOrYear) {
  const bank = loadBank();
  const key = String(slugOrYear || '').trim();
  const paper = bank.papers.find((p) => p.slug === key || String(p.year) === key);
  if (!paper) return null;

  const questionsById = {};
  bank.questions.forEach((q) => {
    questionsById[q.id] = q;
  });

  const sections = paper.sections.map((sec) => {
    const questions = sec.questionIds.map((qid, idx) => {
      const q = questionsById[qid];
      if (!q) return null;
      return {
        id: qid,
        number: idx + 1,
        sectionKey: sec.key,
        sectionLabel: sec.label,
        type: q.type || 'MCQ',
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        text: formatMathText(q.text),
        options: (q.options || []).map(formatMathText)
      };
    }).filter(Boolean);

    return {
      key: sec.key,
      label: sec.label,
      marks1Count: sec.marks1Count,
      marks2Count: sec.marks2Count,
      questions
    };
  });

  const answerKey = {};
  paper.sections.forEach((sec) => {
    sec.questionIds.forEach((qid) => {
      const q = questionsById[qid];
      if (q) answerKey[qid] = q.answerIndex;
    });
  });

  return {
    year: paper.year,
    slug: paper.slug,
    title: paper.title,
    subject: paper.subject,
    subjectLabel: paper.subjectLabel,
    durationMinutes: paper.durationMinutes,
    sections,
    answerKey
  };
}

function scorePaper(paperData, responses) {
  const answerKey = paperData.answerKey;
  let score = 0;
  let maxMarks = 0;
  let correct = 0;
  let wrong = 0;
  let unattempted = 0;

  const allQuestions = [];
  paperData.sections.forEach((sec) => {
    sec.questions.forEach((q) => allQuestions.push(q));
  });

  allQuestions.forEach((q) => {
    maxMarks += q.marks;
    const ans = responses[q.id];
    const expected = answerKey[q.id];
    if (ans === undefined || ans === null || ans < 0) {
      unattempted += 1;
      return;
    }
    if (ans === expected) {
      score += q.marks;
      correct += 1;
    } else {
      score -= q.negativeMarks;
      wrong += 1;
    }
  });

  return {
    score: Math.round(score * 100) / 100,
    maxMarks,
    correct,
    wrong,
    unattempted,
    total: allQuestions.length,
    percentage: maxMarks > 0 ? Math.round((score / maxMarks) * 1000) / 10 : 0
  };
}

module.exports = { loadBank, listPapers, getPaper, scorePaper, letterToIndex };

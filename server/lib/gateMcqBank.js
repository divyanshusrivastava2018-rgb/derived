const fs = require('fs');
const path = require('path');
const { formatMathText } = require('./mathLatex');

const BANK_FILE = path.join(__dirname, '..', 'data', 'gate-mcq-bank.json');
const ANSWERS_FILE = path.join(__dirname, '..', 'data', 'gate-mcq-answers.json');

let bankCache = null;
let bankMtime = 0;
let answersCache = null;
let answersMtime = 0;

function loadAnswersMap() {
  if (!fs.existsSync(ANSWERS_FILE)) {
    return migrateAnswersFromLegacyBank();
  }
  const stat = fs.statSync(ANSWERS_FILE);
  if (answersCache && stat.mtimeMs === answersMtime) return answersCache;
  const raw = fs.readFileSync(ANSWERS_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  answersCache = parsed && parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : {};
  answersMtime = stat.mtimeMs;
  return answersCache;
}

/** If bank still has answerIndex (pre-migration), extract once and rewrite files. */
function migrateAnswersFromLegacyBank() {
  const bank = loadBankRaw();
  const answers = {};
  let migrated = false;
  bank.questions = (bank.questions || []).map((q) => {
    if (q && q.id != null && typeof q.answerIndex === 'number') {
      answers[q.id] = q.answerIndex;
      migrated = true;
      const { answerIndex, ...rest } = q;
      return rest;
    }
    return q;
  });
  if (migrated) {
    fs.writeFileSync(BANK_FILE, JSON.stringify(bank, null, 2), 'utf8');
    fs.writeFileSync(ANSWERS_FILE, JSON.stringify({ answers }, null, 2), { mode: 0o600 });
    try {
      fs.chmodSync(ANSWERS_FILE, 0o600);
    } catch {
      /* ignore */
    }
    bankCache = bank;
    bankMtime = fs.statSync(BANK_FILE).mtimeMs;
  }
  answersCache = answers;
  answersMtime = fs.existsSync(ANSWERS_FILE) ? fs.statSync(ANSWERS_FILE).mtimeMs : 0;
  return answers;
}

function loadBankRaw() {
  const stat = fs.statSync(BANK_FILE);
  if (bankCache && stat.mtimeMs === bankMtime) return bankCache;
  const raw = fs.readFileSync(BANK_FILE, 'utf8');
  bankCache = JSON.parse(raw);
  bankMtime = stat.mtimeMs;
  return bankCache;
}

function loadBank() {
  const bank = loadBankRaw();
  const answers = loadAnswersMap();
  return { bank, answers };
}

function answerIndexFor(q, answers) {
  if (q && typeof q.answerIndex === 'number') return q.answerIndex;
  if (q && q.id != null && answers[q.id] != null) return answers[q.id];
  return undefined;
}

function paperTotals(paper, questionsById) {
  const byId = questionsById || {};
  const { bank } = loadBank();
  bank.questions.forEach((q) => {
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
  const { bank } = loadBank();
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
  const { bank, answers } = loadBank();
  const key = String(slugOrYear || '').trim();
  const paper = bank.papers.find((p) => p.slug === key || String(p.year) === key);
  if (!paper) return null;

  const questionsById = {};
  bank.questions.forEach((q) => {
    questionsById[q.id] = q;
  });

  const sections = paper.sections.map((sec) => {
    const questions = sec.questionIds
      .map((qid, idx) => {
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
      })
      .filter(Boolean);

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
      const idx = answerIndexFor(q, answers);
      if (idx != null) answerKey[qid] = idx;
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

  const sectionMap = new Map();
  const review = [];

  allQuestions.forEach((q) => {
    maxMarks += q.marks;
    const ans = responses[q.id];
    const expected = answerKey[q.id];
    let status = 'skipped';
    let selected = -1;
    let marksAwarded = 0;

    if (ans !== undefined && ans !== null && ans >= 0) {
      selected = ans;
      if (expected != null && ans === expected) {
        status = 'correct';
        score += q.marks;
        marksAwarded = q.marks;
        correct += 1;
      } else {
        status = 'incorrect';
        score -= q.negativeMarks;
        marksAwarded = -(q.negativeMarks || 0);
        wrong += 1;
      }
    } else {
      unattempted += 1;
    }

    const secKey = q.sectionKey || 'default';
    if (!sectionMap.has(secKey)) {
      sectionMap.set(secKey, {
        key: secKey,
        label: q.sectionLabel || secKey,
        total: 0,
        correct: 0,
        wrong: 0,
        skipped: 0
      });
    }
    const sec = sectionMap.get(secKey);
    sec.total += 1;
    if (status === 'correct') sec.correct += 1;
    else if (status === 'incorrect') sec.wrong += 1;
    else sec.skipped += 1;

    review.push({
      id: q.id,
      number: q.number,
      sectionKey: secKey,
      sectionLabel: q.sectionLabel || secKey,
      text: q.text,
      options: q.options || [],
      status,
      selected,
      correctIndex: expected != null ? expected : -1,
      marks: q.marks,
      marksAwarded
    });
  });

  const sections = [...sectionMap.values()].map((s) => ({
    ...s,
    accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
  }));

  return {
    score: Math.round(score * 100) / 100,
    maxMarks,
    correct,
    wrong,
    unattempted,
    total: allQuestions.length,
    attempted: correct + wrong,
    percentage: maxMarks > 0 ? Math.round((score / maxMarks) * 1000) / 10 : 0,
    sections,
    review
  };
}

module.exports = {
  listPapers,
  getPaper,
  scorePaper,
  letterToIndex,
  loadBank,
  answerIndexFor
};

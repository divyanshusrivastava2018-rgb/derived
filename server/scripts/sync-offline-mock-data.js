#!/usr/bin/env node
/**
 * Regenerate public/data offline fallbacks for static hosting.
 */
const fs = require('fs');
const path = require('path');
const mockTestCatalog = require('../lib/mockTestCatalog');
const gateMcqBank = require('../lib/gateMcqBank');
const { encodeAnswers, VERSION } = require('../lib/gateBundleCodec');

const outDir = path.join(__dirname, '..', '..', 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'offline-mock-tests.json'),
  JSON.stringify(mockTestCatalog.listMockTests(), null, 2),
  'utf8'
);

fs.writeFileSync(
  path.join(outDir, 'offline-gate-papers.json'),
  JSON.stringify({ papers: gateMcqBank.listPapers() }, null, 2),
  'utf8'
);

/** Full papers (no answer keys) for gate-exam.html when /api is unreachable */
function stripPaperForClient(paper) {
  if (!paper) return null;
  return {
    year: paper.year,
    slug: paper.slug,
    title: paper.title,
    subject: paper.subject,
    subjectLabel: paper.subjectLabel,
    durationMinutes: paper.durationMinutes,
    sections: (paper.sections || []).map((sec) => ({
      key: sec.key,
      label: sec.label,
      marks1Count: sec.marks1Count,
      marks2Count: sec.marks2Count,
      questions: (sec.questions || []).map((q) => ({
        id: q.id,
        number: q.number,
        sectionKey: q.sectionKey,
        sectionLabel: q.sectionLabel,
        type: q.type,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        text: q.text,
        options: q.options
      }))
    }))
  };
}

const offlineExams = {};
gateMcqBank.listPapers().forEach((meta) => {
  const slug = meta.slug || String(meta.year);
  const full = gateMcqBank.getPaper(slug);
  const stripped = stripPaperForClient(full);
  if (stripped) offlineExams[slug] = stripped;
});
fs.writeFileSync(
  path.join(outDir, 'offline-gate-exams.json'),
  JSON.stringify(offlineExams, null, 2),
  'utf8'
);

/** Obfuscated keys only (no plaintext answers or authored solutions in public/). */
const scoreBundle = { v: VERSION, papers: {} };
gateMcqBank.listPapers().forEach((meta) => {
  const slug = meta.slug || String(meta.year);
  const full = gateMcqBank.getPaper(slug);
  if (!full || !full.answerKey) return;
  scoreBundle.papers[slug] = {
    year: full.year,
    slug: full.slug,
    title: full.title,
    subjectLabel: full.subjectLabel,
    enc: encodeAnswers(slug, full.answerKey)
  };
});
fs.writeFileSync(
  path.join(outDir, 'gate-score-bundle.json'),
  JSON.stringify(scoreBundle, null, 2),
  'utf8'
);

const publicSolutions = path.join(outDir, 'gate-mcq-solutions.json');
if (fs.existsSync(publicSolutions)) {
  fs.unlinkSync(publicSolutions);
}

const tokens = mockTestCatalog.listMockTests().tokens;
console.log('Wrote offline mock catalog:', tokens.length, 'tokens');
console.log('Wrote offline GATE exams:', Object.keys(offlineExams).length, 'papers');
console.log('Wrote obfuscated gate-score-bundle:', Object.keys(scoreBundle.papers).length, 'papers');

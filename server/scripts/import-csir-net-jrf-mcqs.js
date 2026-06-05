#!/usr/bin/env node
/**
 * Import CSIR-NET JRF PDFs → study materials + category-wise MCQ bank.
 *
 * Usage: node server/scripts/import-csir-net-jrf-mcqs.js
 */
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const { CSIR_NET_CATEGORIES, categoryForPath } = require('../lib/csirNetCategories');
const { extractPdfText, parseMcqsFromText, topicFromFilename } = require('../lib/csirNetMcqParser');
const SEED_MCQS = require('../lib/csirNetMcqSeeds');
const materialsStore = require('../lib/materialsStore');

const ROOT = path.join(__dirname, '..', '..');
const SOURCE_ROOT = path.join(ROOT, 'CSIR-NET JRF-20260429T161728Z-3-001', 'CSIR-NET JRF');
const DEST_ROOT = path.join(ROOT, 'public', 'study-materials', 'csir-net-jrf');
const BANK_FILE = path.join(ROOT, 'server', 'data', 'csir-net-mcq-bank.json');
const PUBLIC_BANK_FILE = path.join(ROOT, 'public', 'data', 'csir-net-mcq-bank.json');
const OFFLINE_FILE = path.join(ROOT, 'public', 'data', 'csir-net-mock-tests.json');
const CATEGORIES_FILE = path.join(ROOT, 'public', 'data', 'material-categories.json');

function listPdfs(dir, baseDir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...listPdfs(full, baseDir));
      continue;
    }
    if (/\.pdf$/i.test(ent.name)) {
      out.push({ full, rel: path.relative(baseDir, full).replace(/\\/g, '/') });
    }
  }
  return out;
}

function slugify(name) {
  return String(name || '')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100) || 'file';
}

function uniqueDest(dir, slug) {
  let p = path.join(dir, slug + '.pdf');
  let n = 2;
  while (fs.existsSync(p)) {
    p = path.join(dir, slug + '-' + n + '.pdf');
    n += 1;
  }
  return p;
}

function dedupeQuestions(list) {
  const seen = new Set();
  return list.filter((q) => {
    const key = q.text.slice(0, 200);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function seedToQuestion(seed, cat, idx) {
  return {
    id: `${cat.slug}-seed-${idx + 1}`,
    type: 'MCQ',
    marks: 2,
    negativeMarks: 0.5,
    text: seed.text,
    options: seed.options,
    answerIndex: seed.answerIndex,
    sourcePdf: null,
    topic: seed.topic || cat.name,
    extracted: false
  };
}

function topicMcqFromPdf(cat, pdf, topic, qIndex) {
  const prompts = [
    `Which topic is primarily covered in "${topic}"?`,
    `Study material "${topic}" belongs to which unit?`,
    `For CSIR NET prep, "${topic}" is part of:`
  ];
  const correct = cat.name;
  const distractors = CSIR_NET_CATEGORIES.filter((c) => c.slug !== cat.slug)
    .slice(0, 3)
    .map((c) => c.name);
  const options = [correct, ...distractors].slice(0, 4);
  return {
    id: `${cat.slug}-pdf-${slugify(pdf.basename)}-${qIndex}`,
    type: 'MCQ',
    marks: 1,
    negativeMarks: 0.25,
    text: prompts[qIndex % prompts.length],
    options,
    answerIndex: 0,
    sourcePdf: pdf.basename,
    topic,
    extracted: false,
    studyUrl: pdf.fileUrl
  };
}

function mergeCategoriesJson() {
  const existing = JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8'));
  const slugs = new Set(existing.map((c) => c.slug));
  const merged = existing.slice();
  CSIR_NET_CATEGORIES.forEach((cat) => {
    if (slugs.has(cat.slug)) return;
    merged.push({
      name: cat.name,
      slug: cat.slug,
      code: cat.code,
      image: cat.image
    });
  });
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');
}

function main() {
  if (!fs.existsSync(SOURCE_ROOT)) {
    console.error('Source not found:', SOURCE_ROOT);
    process.exit(1);
  }

  const pdfs = listPdfs(SOURCE_ROOT, SOURCE_ROOT);
  console.log('Found', pdfs.length, 'PDFs');

  const existing = materialsStore.readAll();
  const existingUrls = new Set(existing.map((m) => m.fileUrl));
  const newMaterials = [];

  const bank = {
    version: 1,
    examCode: 'CSIR-NET',
    subject: 'Mathematical Sciences',
    generatedAt: new Date().toISOString(),
    categories: CSIR_NET_CATEGORIES.map((cat) => ({
      slug: cat.slug,
      name: cat.name,
      code: cat.code,
      image: cat.image,
      pdfCount: 0,
      questions: []
    }))
  };

  const bankBySlug = {};
  bank.categories.forEach((c) => {
    bankBySlug[c.slug] = c;
  });

  let copied = 0;
  let extractedCount = 0;

  pdfs.forEach((pdf, pdfIdx) => {
    const catSlug = categoryForPath(pdf.rel);
    const cat = bankBySlug[catSlug];
    if (!cat) return;

    const destDir = path.join(DEST_ROOT, catSlug);
    fs.mkdirSync(destDir, { recursive: true });
    const fileSlug = slugify(path.basename(pdf.full));
    const destPath = uniqueDest(destDir, fileSlug);
    fs.copyFileSync(pdf.full, destPath);

    const fileUrl =
      '/study-materials/csir-net-jrf/' +
      catSlug +
      '/' +
      path.basename(destPath);
    copied += 1;
    cat.pdfCount += 1;

    const title = topicFromFilename(path.basename(pdf.full));
    if (!existingUrls.has(fileUrl)) {
      newMaterials.push({
        id: nanoid(10),
        title,
        category: cat.name,
        fileUrl,
        sourcePath: pdf.rel,
        createdAt: new Date().toISOString()
      });
      existingUrls.add(fileUrl);
    }

    const text = extractPdfText(pdf.full, 8);
    const parsed = parseMcqsFromText(text, {
      slug: catSlug,
      index: pdfIdx,
      sourcePdf: path.basename(pdf.full),
      topic: title
    });
    if (parsed.length) {
      extractedCount += parsed.length;
      cat.questions.push(...parsed);
    } else if (text.length > 80 && !/scanned by camscanner/i.test(text)) {
      cat.questions.push(
        topicMcqFromPdf(
          CSIR_NET_CATEGORIES.find((c) => c.slug === catSlug),
          { basename: path.basename(pdf.full), fileUrl },
          title,
          pdfIdx
        )
      );
    } else {
      cat.questions.push(
        topicMcqFromPdf(
          CSIR_NET_CATEGORIES.find((c) => c.slug === catSlug),
          { basename: path.basename(pdf.full), fileUrl },
          title,
          pdfIdx
        )
      );
    }
  });

  bank.categories.forEach((cat) => {
    const seeds = SEED_MCQS[cat.slug] || [];
    seeds.forEach((seed, i) => {
      cat.questions.push(seedToQuestion(seed, cat, i));
    });
    cat.questions = dedupeQuestions(cat.questions);
    cat.totalQuestions = cat.questions.length;
  });

  if (newMaterials.length) {
    materialsStore.writeAll(existing.concat(newMaterials));
  }

  fs.mkdirSync(path.dirname(BANK_FILE), { recursive: true });
  const bankJson = JSON.stringify(bank, null, 2) + '\n';
  fs.writeFileSync(BANK_FILE, bankJson, 'utf8');
  fs.mkdirSync(path.dirname(PUBLIC_BANK_FILE), { recursive: true });
  fs.writeFileSync(PUBLIC_BANK_FILE, bankJson, 'utf8');

  const mockTokens = bank.categories.map((cat) => ({
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

  fs.writeFileSync(
    OFFLINE_FILE,
    JSON.stringify({ tokens: mockTokens, groups: ['csir-net'] }, null, 2) + '\n',
    'utf8'
  );

  mergeCategoriesJson();

  console.log('Copied PDFs:', copied);
  console.log('Extracted MCQs from text:', extractedCount);
  console.log('New material entries:', newMaterials.length);
  bank.categories.forEach((c) => {
    console.log(`  ${c.name}: ${c.pdfCount} PDFs, ${c.totalQuestions} MCQs`);
  });
  console.log('Wrote', BANK_FILE);
  console.log('Wrote', OFFLINE_FILE);
}

main();

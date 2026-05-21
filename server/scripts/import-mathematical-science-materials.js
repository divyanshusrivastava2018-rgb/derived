#!/usr/bin/env node
/**
 * Import PDFs from MATHEMATICAL SCIENCE/ into public/study-materials/mathematical-science/
 * and merge entries into server/data/materials.json (category-wise).
 *
 * Usage: node server/scripts/import-mathematical-science-materials.js
 */
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const {
  categorizeByFilename,
  slugifyFilename,
  CATEGORY_SLUGS
} = require('../lib/materialCategories');
const materialsStore = require('../lib/materialsStore');

const ROOT = path.join(__dirname, '..', '..');
const SOURCE_DIR = path.join(ROOT, 'MATHEMATICAL SCIENCE ');
const DEST_ROOT = path.join(ROOT, 'public', 'study-materials', 'mathematical-science');
const OFFLINE_JSON = path.join(ROOT, 'public', 'data', 'offline-materials.json');

function listPdfs(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...listPdfs(full));
      continue;
    }
    if (/\.pdf$/i.test(ent.name)) out.push(full);
  }
  return out;
}

function titleFromFilename(name) {
  return name.replace(/\.pdf$/i, '').replace(/\s+/g, ' ').trim();
}

function uniqueDestPath(dir, slug) {
  let candidate = path.join(dir, slug + '.pdf');
  let n = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, slug + '-' + n + '.pdf');
    n += 1;
  }
  return candidate;
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('Source folder not found:', SOURCE_DIR);
    process.exit(1);
  }

  const pdfs = listPdfs(SOURCE_DIR);
  console.log('Found', pdfs.length, 'PDFs in MATHEMATICAL SCIENCE');

  const existing = materialsStore.readAll();
  const existingUrls = new Set(existing.map((m) => m.fileUrl));
  const bySourcePath = new Map();

  for (const m of existing) {
    if (m.sourcePath) bySourcePath.set(m.sourcePath, m);
  }

  let copied = 0;
  let skipped = 0;
  const newItems = [];

  for (const src of pdfs) {
    const basename = path.basename(src);
    const category = categorizeByFilename(basename);
    const slug = CATEGORY_SLUGS[category] || 'general';
    const destDir = path.join(DEST_ROOT, slug);
    fs.mkdirSync(destDir, { recursive: true });

    const fileSlug = slugifyFilename(basename);
    const destPath = uniqueDestPath(destDir, fileSlug);
    const relUrl =
      '/study-materials/mathematical-science/' + slug + '/' + path.basename(destPath);

    if (bySourcePath.has(src)) {
      skipped += 1;
      continue;
    }

    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(src, destPath);
      copied += 1;
    }

    if (existingUrls.has(relUrl)) {
      skipped += 1;
      continue;
    }

    newItems.push({
      id: 'ms-' + nanoid(10),
      title: titleFromFilename(basename),
      fileUrl: relUrl,
      category,
      sourcePath: src
    });
    existingUrls.add(relUrl);
  }

  const withCategories = existing.map((m) => ({
    ...m,
    category: m.category || 'DIPS Handwritten Notes'
  }));

  const merged = [...withCategories, ...newItems].sort((a, b) => {
    const { sortIndex } = require('../lib/materialCategories');
    const ca = sortIndex(a.category || '');
    const cb = sortIndex(b.category || '');
    if (ca !== cb) return ca - cb;
    return String(a.title).localeCompare(String(b.title));
  });

  materialsStore.writeAll(merged);
  fs.writeFileSync(OFFLINE_JSON, JSON.stringify(merged, null, 2), 'utf8');

  console.log('Copied', copied, 'new files to public/study-materials/mathematical-science/');
  console.log('Added', newItems.length, 'material entries');
  console.log('Skipped', skipped, '(already imported)');
  console.log('Total materials:', merged.length);
}

main();

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { nanoid } = require('nanoid');
const store = require('../lib/store');
const { requireAdmin } = require('../lib/adminAuth');
const { isSafeHttpUrl } = require('../lib/safeUrl');
const { publicCourseView } = require('../lib/entitlements');
const { enrichDemoCourse } = require('../lib/demoPlaylists');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const ALLOWED_THUMB_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_THUMB_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_COURSE_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'application/pdf']);
const ALLOWED_COURSE_EXT = new Set(['.mp4', '.webm', '.mov', '.pdf']);

const PURGE_ALL_COURSES_CONFIRM = 'purge-all-courses';

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    cb(null, `${nanoid(12)}${ext}`);
  }
});

function allowedUpload(file) {
  const ext = (path.extname(file.originalname || '') || '').toLowerCase();
  if (file.fieldname === 'thumb') {
    return ALLOWED_THUMB_MIME.has(file.mimetype) && ALLOWED_THUMB_EXT.has(ext);
  }
  if (file.fieldname === 'courseFile') {
    return ALLOWED_COURSE_MIME.has(file.mimetype) && ALLOWED_COURSE_EXT.has(ext);
  }
  return false;
}

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedUpload(file)) {
      return cb(new Error(`Unsupported upload type for ${file.fieldname}`));
    }
    cb(null, true);
  }
});

const router = express.Router();
const jsonParser = express.json({ limit: '2mb' });

function parseBody(req, res, next) {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('multipart/form-data')) {
    return upload.fields([
      { name: 'thumb', maxCount: 1 },
      { name: 'courseFile', maxCount: 1 }
    ])(req, res, (err) => {
      if (!err) return next();
      return res.status(400).json({ error: err.message || 'Invalid upload' });
    });
  }
  return jsonParser(req, res, next);
}

async function validateFileMagic(absPath, allowedMimeSet) {
  const { fileTypeFromFile } = await import('file-type');
  const ft = await fileTypeFromFile(absPath);
  const mime = ft && ft.mime;
  if (!mime || !allowedMimeSet.has(mime)) {
    return { ok: false };
  }
  return { ok: true, mime };
}

function unlinkQuiet(p) {
  try {
    fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}

function extractYtId(url) {
  if (!url || typeof url !== 'string') return null;
  const s = url.trim();
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}

function publicUploadUrl(req, filename) {
  if (!filename) return null;
  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}/uploads/${filename}`;
}

router.get('/', (req, res) => {
  const courses = store.readAll();
  res.json(courses.map((c) => publicCourseView(enrichDemoCourse(c), req)));
});

router.get('/:id', (req, res) => {
  const courses = store.readAll();
  const c = courses.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Course not found' });
  res.json(publicCourseView(enrichDemoCourse(c), req));
});

router.post('/', requireAdmin, parseBody, async (req, res) => {
  try {
    const body = req.body || {};
    const type = body.type || 'youtube';
    const title = (body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });

    let ytId = null;
    let extUrl = null;
    let fileUrl = null;

    if (type === 'youtube') {
      const ytUrl = (body.ytUrl || '').trim();
      ytId = extractYtId(ytUrl);
      if (!ytId) return res.status(400).json({ error: 'Valid YouTube URL required' });
    } else if (type === 'external') {
      extUrl = (body.extUrl || '').trim();
      if (!extUrl) return res.status(400).json({ error: 'External URL required' });
      if (!isSafeHttpUrl(extUrl)) {
        return res.status(400).json({ error: 'External URL must be http(s) only' });
      }
    } else if (type === 'upload') {
      const f = req.files && req.files.courseFile && req.files.courseFile[0];
      if (!f) return res.status(400).json({ error: 'Course file required for upload type' });
      const v = await validateFileMagic(f.path, ALLOWED_COURSE_MIME);
      if (!v.ok) {
        unlinkQuiet(f.path);
        return res.status(400).json({ error: 'Course file content does not match an allowed type' });
      }
      fileUrl = publicUploadUrl(req, f.filename);
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    let thumbUrl = null;
    const thumb = req.files && req.files.thumb && req.files.thumb[0];
    if (thumb) {
      const v = await validateFileMagic(thumb.path, ALLOWED_THUMB_MIME);
      if (!v.ok) {
        unlinkQuiet(thumb.path);
        const f = req.files && req.files.courseFile && req.files.courseFile[0];
        if (f) unlinkQuiet(f.path);
        return res.status(400).json({ error: 'Thumbnail content does not match an allowed image type' });
      }
      thumbUrl = publicUploadUrl(req, thumb.filename);
    }

    const price = parseInt(String(body.price || '0'), 10) || 0;
    const course = {
      id: nanoid(12),
      type,
      ytId: type === 'youtube' ? ytId : null,
      title,
      category: body.category || 'Other',
      level: body.level || 'Beginner',
      instructor: (body.instructor || '').trim() || 'Researchium',
      lang: body.lang || 'English',
      price,
      duration: (body.duration || '').trim() || 'Self-paced',
      desc: (body.desc || '').trim(),
      rating: 4.5,
      students: 0,
      thumbUrl,
      fileUrl,
      extUrl: type === 'external' ? extUrl : null,
      mimeType:
        type === 'upload' && req.files.courseFile && req.files.courseFile[0]
          ? req.files.courseFile[0].mimetype
          : null,
      originalName:
        type === 'upload' && req.files.courseFile && req.files.courseFile[0]
          ? req.files.courseFile[0].originalname
          : null,
      createdAt: Date.now()
    };

    const courses = store.readAll();
    courses.unshift(course);
    store.writeAll(courses);
    res.status(201).json(course);
  } catch (err) {
    console.error('courses POST', err);
    res.status(500).json({ error: 'Could not process upload' });
  }
});

router.delete('/', requireAdmin, (req, res) => {
  const h = (req.headers['x-researchium-confirm'] || '').trim();
  if (h !== PURGE_ALL_COURSES_CONFIRM) {
    return res.status(403).json({
      error: 'Bulk delete requires confirmation header',
      hint: `Send X-Researchium-Confirm: ${PURGE_ALL_COURSES_CONFIRM}`
    });
  }
  store.writeAll([]);
  res.json({ ok: true });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const courses = store.readAll();
  const idx = courses.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Course not found' });
  const [removed] = courses.splice(idx, 1);
  store.writeAll(courses);
  res.json({ ok: true, id: removed.id });
});

module.exports = router;
module.exports.PURGE_ALL_COURSES_CONFIRM = PURGE_ALL_COURSES_CONFIRM;

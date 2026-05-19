const express = require('express');
const fs = require('fs');
const path = require('path');
const store = require('../lib/store');
const { canWatchCourse, isFreeCourse } = require('../lib/entitlements');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const router = express.Router();

/** Paid course uploads (video/PDF and thumbnails) require entitlement. */
function findPaidCourseMedia(filename) {
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return null;
  }
  const needle = `/uploads/${filename}`;
  const courses = store.readAll();
  return courses.find((c) => {
    if (isFreeCourse(c)) return false;
    const fileUrl = c.fileUrl || '';
    const thumbUrl = c.thumbUrl || '';
    const matchesFile =
      typeof fileUrl === 'string' && (fileUrl.endsWith(needle) || fileUrl.endsWith(filename));
    const matchesThumb =
      typeof thumbUrl === 'string' && (thumbUrl.endsWith(needle) || thumbUrl.endsWith(filename));
    if (c.type === 'upload' && matchesFile) return true;
    if (matchesThumb && Number(c.price) > 0) return true;
    return false;
  });
}

router.get('/:filename', (req, res) => {
  const filename = path.basename(String(req.params.filename || ''));
  const abs = path.join(UPLOAD_DIR, filename);
  if (!filename || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return res.status(404).json({ error: 'Not found' });
  }

  const course = findPaidCourseMedia(filename);
  if (course && !canWatchCourse(course, req)) {
    return res.status(403).json({ error: 'Pro membership required' });
  }

  res.sendFile(abs);
});

module.exports = router;

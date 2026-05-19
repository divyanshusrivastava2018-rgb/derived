const adminSessions = require('./adminSessions');
const memberCookie = require('./memberCookie');
const { extractBearer } = require('./adminAuth');

function isFreeCourse(course) {
  return !course || !course.price || Number(course.price) === 0;
}

function canWatchCourse(course, req) {
  if (!course) return false;
  if (isFreeCourse(course)) return true;
  if (memberCookie.isPaidMember(req)) return true;
  const token = extractBearer(req);
  if (token && adminSessions.isValidSession(token)) return true;
  return false;
}

function publicCourseView(course, req) {
  const allowed = canWatchCourse(course, req);
  const base = {
    id: course.id,
    type: course.type,
    title: course.title,
    category: course.category,
    level: course.level,
    instructor: course.instructor,
    lang: course.lang,
    price: course.price,
    duration: course.duration,
    desc: course.desc,
    rating: course.rating,
    students: course.students,
    thumbUrl: course.thumbUrl,
    createdAt: course.createdAt,
    canWatch: allowed
  };
  if (!allowed) return base;
  if (course.type === 'youtube' && course.ytId) base.ytId = course.ytId;
  if (course.type === 'external' && course.extUrl) base.extUrl = course.extUrl;
  if (course.type === 'upload') {
    if (course.fileUrl) base.fileUrl = course.fileUrl;
    if (course.mimeType) base.mimeType = course.mimeType;
  }
  return base;
}

module.exports = { isFreeCourse, canWatchCourse, publicCourseView };

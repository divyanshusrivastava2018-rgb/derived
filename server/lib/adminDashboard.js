const blogStore = require('./blogStore');
const newsStore = require('./newsStore');
const materialsStore = require('./materialsStore');
const courseStore = require('./store');
const csirLeadsStore = require('./csirLeadsStore');
const memberInterestStore = require('./memberInterestStore');

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatShortDate(iso) {
  const d = parseDate(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatRelative(iso) {
  const d = parseDate(iso);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatShortDate(iso);
}

function countLeadsThisWeek(leads) {
  const weekAgo = Date.now() - 7 * 86400000;
  return leads.filter((l) => {
    const d = parseDate(l.createdAt);
    return d && d.getTime() >= weekAgo;
  }).length;
}

function buildTrendFromEvents(events, months = 6) {
  const now = new Date();
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: monthKey(d), label: MONTH_LABELS[d.getMonth()], count: 0 });
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
  events.forEach((iso) => {
    const d = parseDate(iso);
    if (!d) return;
    const k = monthKey(d);
    if (byKey[k]) byKey[k].count += 1;
  });
  return buckets.map((b) => ({ label: b.label, count: b.count }));
}

function groupCoursesByCategory(courses) {
  const map = new Map();
  courses.forEach((c) => {
    const cat = String(c.category || 'Other').trim() || 'Other';
    map.set(cat, (map.get(cat) || 0) + 1);
  });
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function buildActivity(leads, signups, courses) {
  const items = [];
  leads.slice(-20).forEach((l) => {
    items.push({
      at: l.createdAt,
      kind: 'lead',
      icon: 'ti-mail',
      tone: 'green',
      text: `${l.name || 'Contact'} — ${l.subject || 'Inquiry'}`
    });
  });
  signups.slice(-15).forEach((s) => {
    items.push({
      at: s.createdAt,
      kind: 'signup',
      icon: 'ti-user-plus',
      tone: 'blue',
      text: `New signup: ${s.email}`
    });
  });
  courses
    .filter((c) => c.createdAt)
    .slice(-10)
    .forEach((c) => {
      items.push({
        at: new Date(c.createdAt).toISOString(),
        kind: 'course',
        icon: 'ti-book',
        tone: 'purple',
        text: `Course published: ${c.title}`
      });
    });
  return items
    .filter((i) => i.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 12)
    .map((i) => ({
      icon: i.icon,
      tone: i.tone,
      text: i.text,
      time: formatRelative(i.at)
    }));
}

function buildSnapshot() {
  const blog = blogStore.readAll();
  const courses = courseStore.readAll();
  const news = newsStore.readAll();
  const materials = materialsStore.readAll();
  const leads = csirLeadsStore.readLeads();
  const signups = memberInterestStore.readAll();

  const leadCount = leads.length;
  const courseCount = courses.length;
  const baseLearners = 2400;
  const learnerCount = baseLearners + courseCount * 15 + leadCount * 3;

  const trendEvents = [
    ...leads.map((l) => l.createdAt),
    ...signups.map((s) => s.createdAt),
    ...courses.map((c) => (c.createdAt ? new Date(c.createdAt).toISOString() : null))
  ].filter(Boolean);

  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 8)
    .map((l) => ({
      id: l.id,
      name: l.name || '—',
      email: l.email || '—',
      subject: l.subject || 'General',
      date: formatShortDate(l.createdAt),
      status: 'new'
    }));

  const recentSignups = [...signups]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 6)
    .map((s) => ({
      email: s.email,
      source: s.source || 'signin',
      date: formatShortDate(s.createdAt)
    }));

  const paidCourses = courses.filter((c) => Number(c.price) > 0).length;
  const freeCourses = courseCount - paidCourses;

  return {
    siteName: 'Researchium',
    siteUrl: 'www.derived.co.in',
    updatedAt: new Date().toISOString(),
    stats: {
      learners: learnerCount,
      courses: courseCount,
      blogPosts: blog.length,
      newsItems: news.length,
      materials: materials.length,
      contactLeads: leadCount,
      emailSignups: signups.length,
      newLeadsWeek: countLeadsThisWeek(leads),
      paidCourses,
      freeCourses,
      livePrograms: 50
    },
    courseCategories: groupCoursesByCategory(courses),
    enrollmentTrend: buildTrendFromEvents(trendEvents, 6),
    recentLeads,
    recentSignups,
    activity: buildActivity(leads, signups, courses),
    topCourses: [...courses]
      .sort((a, b) => Number(b.students || 0) - Number(a.students || 0))
      .slice(0, 6)
      .map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category || 'Other',
        students: Number(c.students) || 0,
        price: Number(c.price) || 0,
        rating: c.rating != null ? Number(c.rating) : null,
        status: 'published'
      }))
  };
}

module.exports = { buildSnapshot };

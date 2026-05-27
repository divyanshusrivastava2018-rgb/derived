const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const FILES = {
  config: 'stream-config.json',
  status: 'stream-status.json',
  destinations: 'destinations.json',
  streams: 'streams.json',
  schedule: 'schedule.json'
};

const RTMP_URL = 'rtmp://127.0.0.1:1935/live';

const DEMO_STREAMS = [
  {
    id: 's1',
    title: 'Real Analysis · Sequences',
    subject: 'Mathematics',
    status: 'scheduled',
    platforms: ['youtube', 'twitch'],
    viewerPeak: 0,
    thumbnailColor: '#7c3aed',
    createdAt: '2026-05-27T13:00:00Z',
    scheduledAt: '2026-05-27T13:30:00Z'
  },
  {
    id: 's2',
    title: 'CRISPR-Cas9 Workshop',
    subject: 'Biology',
    status: 'ended',
    platforms: ['youtube', 'linkedin'],
    viewerPeak: 142,
    thumbnailColor: '#0891b2',
    createdAt: '2026-05-25T10:00:00Z',
    scheduledAt: null
  },
  {
    id: 's3',
    title: 'Physics Live Q&A',
    subject: 'Physics',
    status: 'draft',
    platforms: [],
    viewerPeak: 0,
    thumbnailColor: '#dc2626',
    createdAt: '2026-05-24T09:00:00Z',
    scheduledAt: null
  }
];

function filePath(name) {
  return path.join(DATA_DIR, FILES[name]);
}

function init() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(filePath('streams'))) {
    writeJson('streams', DEMO_STREAMS);
  }
  if (!fs.existsSync(filePath('destinations'))) {
    writeJson('destinations', []);
  }
  if (!fs.existsSync(filePath('schedule'))) {
    writeJson('schedule', []);
  }
  if (!fs.existsSync(filePath('status'))) {
    writeJson('status', defaultStatus());
  }
}

function defaultStatus() {
  return {
    live: false,
    viewers: 0,
    bitrate: 0,
    durationSeconds: 0,
    title: ''
  };
}

function readJson(name, fallback) {
  try {
    const raw = fs.readFileSync(filePath(name), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

function writeJson(name, data) {
  const tmp = `${filePath(name)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath(name));
}

function readConfig() {
  return readJson('config', null);
}

function writeConfig(config) {
  writeJson('config', config);
}

function readStatus() {
  const data = readJson('status', defaultStatus());
  return {
    live: Boolean(data.live),
    viewers: Number(data.viewers) || 0,
    bitrate: Number(data.bitrate) || 0,
    durationSeconds: Number(data.durationSeconds) || 0,
    title: String(data.title || '')
  };
}

function writeStatus(status) {
  writeJson('status', {
    live: Boolean(status.live),
    viewers: Number(status.viewers) || 0,
    bitrate: Number(status.bitrate) || 0,
    durationSeconds: Number(status.durationSeconds) || 0,
    title: String(status.title || '')
  });
}

function readDestinations() {
  const data = readJson('destinations', []);
  return Array.isArray(data) ? data : [];
}

function writeDestinations(list) {
  writeJson('destinations', list);
}

function readStreams() {
  const data = readJson('streams', []);
  return Array.isArray(data) ? data : [];
}

function writeStreams(list) {
  writeJson('streams', list);
}

function readSchedule() {
  const data = readJson('schedule', []);
  return Array.isArray(data) ? data : [];
}

function writeSchedule(list) {
  writeJson('schedule', list);
}

function scheduleSortKey(item) {
  if (item.scheduledAt) return item.scheduledAt;
  if (item.date && item.time) {
    const t = String(item.time).length === 5 ? `${item.time}:00` : item.time;
    return `${item.date}T${t}`;
  }
  return item.createdAt || '';
}

module.exports = {
  DATA_DIR,
  RTMP_URL,
  init,
  readConfig,
  writeConfig,
  readStatus,
  writeStatus,
  readDestinations,
  writeDestinations,
  readStreams,
  writeStreams,
  readSchedule,
  writeSchedule,
  scheduleSortKey,
  defaultStatus
};

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { nanoid } = require('nanoid');
const streamStudioJwt = require('../lib/streamStudioJwt');
const streamStudioStore = require('../lib/streamStudioStore');
const { requireStreamAuth } = require('../lib/requireStreamAuth');

const router = express.Router();
const jsonParser = express.json({ limit: '64kb' });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
});

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) return false;
  try {
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function getConfiguredCredentials() {
  return {
    email: String(process.env.STREAM_STUDIO_EMAIL || '').trim().toLowerCase(),
    password: String(process.env.STREAM_STUDIO_PASSWORD || '')
  };
}

function credentialsConfigured() {
  const { email, password } = getConfiguredCredentials();
  return Boolean(email && password);
}

function serverError(res, err) {
  console.error('[stream-api]', err);
  return res.status(500).json({ error: 'Internal server error' });
}

function ensureStreamKey() {
  let config = streamStudioStore.readConfig();
  if (!config?.streamKey) {
    config = {
      streamKey: nanoid(16),
      rtmpUrl: streamStudioStore.RTMP_URL
    };
    streamStudioStore.writeConfig(config);
  }
  return {
    streamKey: config.streamKey,
    rtmpUrl: streamStudioStore.RTMP_URL
  };
}

// --- AUTH ---
router.post('/auth/login', loginLimiter, jsonParser, (req, res) => {
  try {
    if (!credentialsConfigured() || !streamStudioJwt.getSigningSecret()) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const email = String((req.body || {}).email || '')
      .trim()
      .toLowerCase();
    const password = String((req.body || {}).password || '');

    if (!email || !password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const expected = getConfiguredCredentials();
    if (
      !timingSafeEqualString(email, expected.email) ||
      !timingSafeEqualString(password, expected.password)
    ) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = streamStudioJwt.signHostToken(email);
    if (!token) {
      return res.status(503).json({ error: 'Stream studio auth is not configured on the server.' });
    }

    return res.json({ token, success: true });
  } catch (err) {
    return serverError(res, err);
  }
});

router.get('/auth/verify', (req, res) => {
  try {
    const token = streamStudioJwt.parseBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const payload = streamStudioJwt.verifyHostToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.json({ valid: true, role: payload.role });
  } catch (err) {
    return serverError(res, err);
  }
});

// --- STREAM KEY ---
router.get('/key', requireStreamAuth, (_req, res) => {
  try {
    return res.json(ensureStreamKey());
  } catch (err) {
    return serverError(res, err);
  }
});

router.post('/key/regenerate', requireStreamAuth, (_req, res) => {
  try {
    const config = {
      streamKey: nanoid(16),
      rtmpUrl: streamStudioStore.RTMP_URL
    };
    streamStudioStore.writeConfig(config);
    return res.json(config);
  } catch (err) {
    return serverError(res, err);
  }
});

// --- STREAM STATUS ---
router.get('/status', (_req, res) => {
  try {
    return res.json(streamStudioStore.readStatus());
  } catch (err) {
    return serverError(res, err);
  }
});

router.post('/status', requireStreamAuth, jsonParser, (req, res) => {
  try {
    const body = req.body || {};
    streamStudioStore.writeStatus({
      live: body.live,
      viewers: body.viewers,
      bitrate: body.bitrate,
      durationSeconds: body.durationSeconds,
      title: body.title
    });
    return res.json({ success: true });
  } catch (err) {
    return serverError(res, err);
  }
});

// --- DESTINATIONS ---
router.get('/destinations', requireStreamAuth, (_req, res) => {
  try {
    return res.json(streamStudioStore.readDestinations());
  } catch (err) {
    return serverError(res, err);
  }
});

router.post('/destinations', requireStreamAuth, jsonParser, (req, res) => {
  try {
    const list = streamStudioStore.readDestinations();
    if (list.length >= 10) {
      return res.status(400).json({ error: 'Maximum 10 destinations allowed' });
    }
    const body = req.body || {};
    const destination = {
      id: nanoid(12),
      name: String(body.name || '').trim(),
      rtmpUrl: String(body.rtmpUrl || '').trim(),
      streamKey: String(body.streamKey || '').trim(),
      enabled: Boolean(body.enabled),
      platform: String(body.platform || 'custom').trim()
    };
    list.push(destination);
    streamStudioStore.writeDestinations(list);
    return res.status(201).json(destination);
  } catch (err) {
    return serverError(res, err);
  }
});

router.patch('/destinations/:id', requireStreamAuth, jsonParser, (req, res) => {
  try {
    const list = streamStudioStore.readDestinations();
    const idx = list.findIndex((d) => d.id === req.params.id);
    if (idx < 0) {
      return res.status(404).json({ error: 'Destination not found' });
    }
    const item = list[idx];
    const body = req.body || {};
    if (body.enabled !== undefined) item.enabled = Boolean(body.enabled);
    if (body.streamKey !== undefined) item.streamKey = String(body.streamKey);
    if (body.rtmpUrl !== undefined) item.rtmpUrl = String(body.rtmpUrl);
    list[idx] = item;
    streamStudioStore.writeDestinations(list);
    return res.json(item);
  } catch (err) {
    return serverError(res, err);
  }
});

router.delete('/destinations/:id', requireStreamAuth, (req, res) => {
  try {
    const list = streamStudioStore.readDestinations();
    const next = list.filter((d) => d.id !== req.params.id);
    if (next.length === list.length) {
      return res.status(404).json({ error: 'Destination not found' });
    }
    streamStudioStore.writeDestinations(next);
    return res.json({ success: true });
  } catch (err) {
    return serverError(res, err);
  }
});

// --- STREAMS ---
router.get('/streams', requireStreamAuth, (_req, res) => {
  try {
    return res.json(streamStudioStore.readStreams());
  } catch (err) {
    return serverError(res, err);
  }
});

router.post('/streams', requireStreamAuth, jsonParser, (req, res) => {
  try {
    const list = streamStudioStore.readStreams();
    const body = req.body || {};
    const stream = {
      id: nanoid(12),
      title: String(body.title || '').trim(),
      subject: String(body.subject || 'General Research').trim(),
      privacy: String(body.privacy || 'public').trim(),
      status: String(body.status || 'draft').trim(),
      platforms: Array.isArray(body.platforms) ? body.platforms.map(String) : [],
      thumbnailColor: String(body.thumbnailColor || '#7c3aed').trim(),
      viewerPeak: 0,
      createdAt: new Date().toISOString(),
      scheduledAt: body.scheduledAt || null
    };
    list.push(stream);
    streamStudioStore.writeStreams(list);
    return res.status(201).json(stream);
  } catch (err) {
    return serverError(res, err);
  }
});

router.patch('/streams/:id', requireStreamAuth, jsonParser, (req, res) => {
  try {
    const list = streamStudioStore.readStreams();
    const idx = list.findIndex((s) => s.id === req.params.id);
    if (idx < 0) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    const item = { ...list[idx], ...(req.body || {}) };
    list[idx] = item;
    streamStudioStore.writeStreams(list);
    return res.json(item);
  } catch (err) {
    return serverError(res, err);
  }
});

router.delete('/streams/:id', requireStreamAuth, (req, res) => {
  try {
    const list = streamStudioStore.readStreams();
    const next = list.filter((s) => s.id !== req.params.id);
    if (next.length === list.length) {
      return res.status(404).json({ error: 'Stream not found' });
    }
    streamStudioStore.writeStreams(next);
    return res.json({ success: true });
  } catch (err) {
    return serverError(res, err);
  }
});

// --- SCHEDULE ---
router.get('/schedule', requireStreamAuth, (_req, res) => {
  try {
    const list = streamStudioStore.readSchedule();
    list.sort((a, b) =>
      streamStudioStore.scheduleSortKey(a).localeCompare(streamStudioStore.scheduleSortKey(b))
    );
    return res.json(list);
  } catch (err) {
    return serverError(res, err);
  }
});

router.post('/schedule', requireStreamAuth, jsonParser, (req, res) => {
  try {
    const list = streamStudioStore.readSchedule();
    const body = req.body || {};
    const date = String(body.date || '').trim();
    const time = String(body.time || '').trim();
    const timeNorm = time.length === 5 ? `${time}:00` : time;
    const entry = {
      id: nanoid(12),
      title: String(body.title || '').trim(),
      subject: String(body.subject || '').trim(),
      date,
      time,
      repeat: String(body.repeat || 'none').trim(),
      description: String(body.description || '').trim(),
      platforms: Array.isArray(body.platforms) ? body.platforms.map(String) : [],
      notifyStudents: Boolean(body.notifyStudents),
      createdAt: new Date().toISOString(),
      scheduledAt: date && time ? `${date}T${timeNorm}` : null
    };
    list.push(entry);
    streamStudioStore.writeSchedule(list);
    return res.status(201).json(entry);
  } catch (err) {
    return serverError(res, err);
  }
});

router.delete('/schedule/:id', requireStreamAuth, (req, res) => {
  try {
    const list = streamStudioStore.readSchedule();
    const next = list.filter((e) => e.id !== req.params.id);
    if (next.length === list.length) {
      return res.status(404).json({ error: 'Schedule entry not found' });
    }
    streamStudioStore.writeSchedule(next);
    return res.json({ success: true });
  } catch (err) {
    return serverError(res, err);
  }
});

module.exports = router;

const express = require('express');
const { requireAdmin } = require('../lib/adminAuth');

const router = express.Router();
const jsonParser = express.json({ limit: '32kb' });

function streamApiBase() {
  return (process.env.RESEARCHIUM_STREAM_API_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
}

function streamApiKey() {
  return (
    process.env.RESEARCHIUM_STREAM_API_KEY ||
    process.env.RESEARCHIUM_STREAM_ADMIN_API_KEY ||
    ''
  ).trim();
}

async function streamAdminFetch(path, options = {}) {
  const key = streamApiKey();
  if (!key) {
    const err = new Error('stream_api_key_not_configured');
    err.status = 503;
    throw err;
  }
  const url = `${streamApiBase()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': key,
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'stream_api_error');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

router.get('/studio-users', requireAdmin, async (_req, res) => {
  try {
    const data = await streamAdminFetch('/api/admin/studio-users');
    res.json(data);
  } catch (err) {
    const status = err.status || 502;
    res.status(status).json({
      error: err.message,
      message:
        err.message === 'stream_api_key_not_configured'
          ? 'Set RESEARCHIUM_STREAM_API_KEY in .env (same value as API_KEY in Researchium_stream/.env).'
          : err.data?.message || 'Could not reach stream API. Run npm run dev:api in Researchium_stream/.'
    });
  }
});

router.post('/studio-users', requireAdmin, jsonParser, async (req, res) => {
  try {
    const data = await streamAdminFetch('/api/admin/studio-users', {
      method: 'POST',
      body: JSON.stringify(req.body || {})
    });
    res.status(201).json(data);
  } catch (err) {
    res.status(err.status || 502).json({
      error: err.message,
      message: err.data?.message
    });
  }
});

router.delete('/studio-users/:id', requireAdmin, async (req, res) => {
  try {
    const key = streamApiKey();
    if (!key) {
      return res.status(503).json({ error: 'stream_api_key_not_configured' });
    }
    const url = `${streamApiBase()}/api/admin/studio-users/${encodeURIComponent(req.params.id)}`;
    const upstream = await fetch(url, {
      method: 'DELETE',
      headers: { 'X-API-Key': key }
    });
    if (!upstream.ok) {
      const data = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: data.error || 'stream_api_error' });
    }
    res.status(204).end();
  } catch (_err) {
    res.status(502).json({ error: 'stream_api_unreachable' });
  }
});

module.exports = router;

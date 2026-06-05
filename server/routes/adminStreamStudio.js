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

function readIncomingApiKey(req) {
  const headerKey = String(req.headers['x-api-key'] || '').trim();
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const bodyKey = String(body.apiKey || body.api_key || body.key || '').trim();
  return headerKey || bodyKey;
}

function missingApiKeyResponse(res) {
  return res.status(503).json({
    error: 'stream_api_key_not_configured',
    message: 'Set RESEARCHIUM_STREAM_API_KEY in .env'
  });
}

async function streamAdminFetch(path, options = {}) {
  const key = streamApiKey();
  if (!key) {
    const err = new Error('stream_api_key_not_configured');
    err.status = 503;
    err.data = { message: 'Set RESEARCHIUM_STREAM_API_KEY in .env' };
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
  if (!streamApiKey()) return missingApiKeyResponse(res);
  try {
    const data = await streamAdminFetch('/api/admin/studio-users');
    res.json(data);
  } catch (err) {
    if (err.message === 'stream_api_key_not_configured') {
      return missingApiKeyResponse(res);
    }
    const status = err.status || 502;
    res.status(status).json({
      error: err.message,
      message:
        err.data?.message ||
        'Could not reach stream API. Run npm run dev:api in Researchium_stream/.'
    });
  }
});

router.post('/studio-users', requireAdmin, jsonParser, async (req, res) => {
  try {
    const configuredKey = streamApiKey();
    if (!configuredKey) return missingApiKeyResponse(res);

    const incomingKey = readIncomingApiKey(req) || configuredKey;
    if (incomingKey !== configuredKey) {
      return res.status(401).json({
        error: 'invalid_stream_api_key',
        message: 'Invalid X-API-Key for stream host creation.'
      });
    }

    const body = { ...(req.body || {}) };
    delete body.apiKey;
    delete body.api_key;
    delete body.key;

    const data = await streamAdminFetch('/api/admin/studio-users', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    res.status(201).json(data);
  } catch (err) {
    if (err.message === 'stream_api_key_not_configured') {
      return missingApiKeyResponse(res);
    }
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
      return missingApiKeyResponse(res);
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

/**
 * Serve Researchium_stream under /stream-studio and proxy dev APIs to local backends.
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');

const STREAM_DIR = path.join(__dirname, '..', '..', 'Researchium_stream');
const MOUNT = '/stream-studio';
const API_PREFIX = '/stream-api';
const STUDIO_PREFIX = '/stream-studio-backend';

function streamDirExists() {
  return fs.existsSync(STREAM_DIR);
}

function apiTarget() {
  return (process.env.RESEARCHIUM_STREAM_API_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
}

function studioTarget() {
  return (process.env.RESEARCHIUM_STUDIO_BACKEND_URL || 'http://127.0.0.1:5050').replace(/\/$/, '');
}

function isStreamStudioPath(reqPath) {
  return (
    reqPath === '/stream-dashboard.html' ||
    reqPath === '/researchium-stream-dashboard.html' ||
    reqPath.startsWith(MOUNT) ||
    reqPath.startsWith(API_PREFIX) ||
    reqPath.startsWith(STUDIO_PREFIX)
  );
}

function proxyHandler(targetBase) {
  const timeoutMs = Number(process.env.STREAM_PROXY_TIMEOUT_MS || 15000);
  const forwardedHeaders = [
    'accept',
    'accept-language',
    'authorization',
    'content-type',
    'content-length',
    'origin',
    'referer',
    'user-agent',
    'x-api-key',
    'x-requested-with',
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-forwarded-host'
  ];

  function sanitizeRequestPath(rawPath) {
    const src = String(rawPath || '/');
    // Reject absolute-form URLs to avoid open-proxy / SSRF tricks.
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(src) || src.startsWith('//')) {
      return null;
    }
    return src.startsWith('/') ? src : `/${src}`;
  }

  function buildProxyHeaders(req, upstream) {
    const headers = { host: upstream.host };
    for (const name of forwardedHeaders) {
      if (req.headers[name] != null) {
        headers[name] = req.headers[name];
      }
    }
    return headers;
  }

  return (req, res) => {
    const safePath = sanitizeRequestPath(req.url || '/');
    if (!safePath) {
      res.status(400).json({ error: 'bad_proxy_url' });
      return;
    }

    let upstream;
    try {
      upstream = new URL(safePath, `${targetBase}/`);
    } catch (err) {
      res.status(400).json({ error: 'bad_proxy_url' });
      return;
    }

    const lib = upstream.protocol === 'https:' ? https : http;
    const headers = buildProxyHeaders(req, upstream);

    const proxyReq = lib.request(
      {
        protocol: upstream.protocol,
        hostname: upstream.hostname,
        port: upstream.port || (upstream.protocol === 'https:' ? 443 : 80),
        path: upstream.pathname + upstream.search,
        method: req.method,
        headers
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );
    proxyReq.setTimeout(timeoutMs, () => {
      proxyReq.destroy(new Error('proxy_timeout'));
    });

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        const status = err && err.message === 'proxy_timeout' ? 504 : 502;
        res.status(status).json({
          error: 'stream_backend_unavailable',
          message:
            process.env.NODE_ENV === 'production'
              ? 'Stream API is not reachable'
              : err.message
        });
      }
    });

    req.on('aborted', () => {
      proxyReq.destroy(new Error('client_aborted'));
    });

    req.pipe(proxyReq);
  };
}

/** Call before express.json() so request bodies can be proxied. */
function registerProxies(app) {
  if (!streamDirExists()) return;
  app.use(API_PREFIX, proxyHandler(apiTarget()));
  app.use(STUDIO_PREFIX, proxyHandler(studioTarget()));
}

function register(app) {
  if (!streamDirExists()) {
    console.warn(
      '[Researchium] Researchium_stream/ not found — Streamer dashboard static mount disabled.'
    );
    return;
  }

  app.get('/stream-dashboard.html', (_req, res) => {
    res.redirect(302, `${MOUNT}/stream-dashboard.html`);
  });
  app.get('/researchium-stream-dashboard.html', (_req, res) => {
    res.redirect(302, `${MOUNT}/stream-dashboard.html`);
  });

  app.use(
    MOUNT,
    express.static(STREAM_DIR, {
      etag: true,
      lastModified: true,
      maxAge: process.env.NODE_ENV === 'production' ? 0 : 0,
      setHeaders(res, filePath) {
        if (/\.html$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    })
  );

  console.log(
    `[Researchium] Stream studio → http://localhost:${process.env.PORT || 3000}${MOUNT}/stream-dashboard.html`
  );
  console.log(
    `[Researchium] Stream API proxy → ${API_PREFIX} → ${apiTarget()} (run Researchium_stream: npm run dev:api)`
  );
}

module.exports = {
  STREAM_DIR,
  MOUNT,
  API_PREFIX,
  STUDIO_PREFIX,
  streamDirExists,
  isStreamStudioPath,
  registerProxies,
  register
};

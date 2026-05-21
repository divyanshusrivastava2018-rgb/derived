const express = require('express');
const siteStore = require('../lib/siteStore');
const { requireAdmin } = require('../lib/adminAuth');
const { sanitizePageCopyPatch } = require('../lib/sanitizeCmsHtml');
const { isSafeHttpUrl } = require('../lib/safeUrl');

function isDangerKey(k) {
  return k === '__proto__' || k === 'constructor' || k === 'prototype';
}

const router = express.Router();
const jsonParser = express.json({ limit: '2mb' });

router.get('/', (_req, res) => {
  res.json(siteStore.readSite());
});

const SITE_SECTION_KEYS = new Set(['youtubePlaylist', 'liveSchedule', 'pageCopy']);

router.put('/', requireAdmin, jsonParser, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'JSON body required' });
  }
  const cur = siteStore.readSite();
  const merged = { ...cur };

  if (body.youtubePlaylist && typeof body.youtubePlaylist === 'object') {
    const pl = body.youtubePlaylist;
    const curPl = cur.youtubePlaylist && typeof cur.youtubePlaylist === 'object' ? cur.youtubePlaylist : {};
    const playlistUrl =
      typeof pl.playlistUrl === 'string'
        ? pl.playlistUrl.trim()
        : typeof curPl.playlistUrl === 'string'
          ? curPl.playlistUrl
          : '';
    if (playlistUrl && !isSafeHttpUrl(playlistUrl)) {
      return res.status(400).json({ error: 'youtubePlaylist.playlistUrl must be a valid http(s) URL' });
    }
    const channelUrl =
      typeof pl.channelUrl === 'string'
        ? pl.channelUrl.trim()
        : typeof curPl.channelUrl === 'string'
          ? curPl.channelUrl
          : '';
    if (channelUrl && !isSafeHttpUrl(channelUrl)) {
      return res.status(400).json({ error: 'youtubePlaylist.channelUrl must be a valid http(s) URL' });
    }
    merged.youtubePlaylist = {
      ...curPl,
      ...pl,
      heading: typeof pl.heading === 'string' ? pl.heading : curPl.heading,
      subheading: typeof pl.subheading === 'string' ? pl.subheading : curPl.subheading,
      playlistUrl,
      channelUrl,
      videos: Array.isArray(pl.videos) ? pl.videos : curPl.videos
    };
  }

  if (Array.isArray(body.liveSchedule)) {
    const prev = Array.isArray(cur.liveSchedule) ? cur.liveSchedule : [];
    merged.liveSchedule = body.liveSchedule.map((row, i) => {
      if (!row || typeof row !== 'object') return row;
      const base = prev[i] && typeof prev[i] === 'object' ? prev[i] : {};
      return { ...base, ...row };
    });
  }

  if (body.pageCopy && typeof body.pageCopy === 'object') {
    merged.pageCopy = { ...cur.pageCopy };
    for (const key of Object.keys(body.pageCopy)) {
      if (isDangerKey(key)) continue;
      const patch = body.pageCopy[key];
      if (patch && typeof patch === 'object') {
        merged.pageCopy[key] = {
          ...(cur.pageCopy[key] || {}),
          ...sanitizePageCopyPatch(patch)
        };
      }
    }
  }

  siteStore.writeSite(merged);
  res.json(merged);
});

module.exports = router;

const express = require('express');
const { nanoid } = require('nanoid');
const { requireAdmin } = require('../lib/adminAuth');
const store = require('../lib/store');
const siteStore = require('../lib/siteStore');
const ytPl = require('../lib/youtubePlaylistFetch');

const router = express.Router();
const jsonParser = express.json({ limit: '64kb' });

/**
 * POST /api/admin/import-playlist
 * Body: { playlistUrl, playlistId?, category?, autoCategory?, importAsCourses?, syncSitePlayer?,
 *         level?, instructor?, lang?, price?, duration?, descPrefix?, playerHeading?, playerSubheading? }
 */
router.post('/import-playlist', requireAdmin, jsonParser, async (req, res) => {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error:
          'Set YOUTUBE_API_KEY in the environment (Google Cloud → YouTube Data API v3). Without it, playlists cannot be listed automatically.'
      });
    }

    const body = req.body || {};
    const playlistId = ytPl.extractPlaylistId(body.playlistUrl || body.playlistId || '');
    if (!playlistId) {
      return res.status(400).json({ error: 'Invalid or missing playlist URL / ID' });
    }

    const importAsCourses = body.importAsCourses !== false;
    const syncSitePlayer = body.syncSitePlayer === true;
    if (!importAsCourses && !syncSitePlayer) {
      return res.status(400).json({ error: 'Enable “Add to course catalog” and/or “Sync on-page player”.' });
    }

    const items = await ytPl.fetchAllPlaylistItems(playlistId, apiKey);
    if (!items.length) {
      return res.status(400).json({ error: 'No public videos found in this playlist.' });
    }

    const meta = await ytPl.fetchPlaylistSnippet(playlistId, apiKey);

    let category = String(body.category || '').trim();
    if (!category && body.autoCategory !== false) {
      category = ytPl.suggestCategoryFromPlaylistTitle(meta.title || '') || 'Research & Science';
    }
    if (!category) category = 'Other';

    const level = String(body.level || 'Beginner').trim() || 'Beginner';
    const instructor = String(body.instructor || '').trim() || meta.channelTitle || 'YouTube';
    const lang = String(body.lang || 'English').trim() || 'English';
    const price = parseInt(String(body.price ?? '0'), 10) || 0;
    const duration = String(body.duration || '').trim() || 'Playlist';
    const descPrefix = String(body.descPrefix || '').trim();

    let coursesAdded = 0;
    let coursesSkipped = 0;

    if (importAsCourses) {
      const courses = store.readAll();
      const existingIds = new Set(courses.filter((c) => c.ytId).map((c) => c.ytId));
      const base = Date.now();

      items.forEach((item, i) => {
        if (existingIds.has(item.videoId)) {
          coursesSkipped += 1;
          return;
        }
        const descLine = meta.title ? `From playlist: ${meta.title}` : `Playlist: ${playlistId}`;
        const desc = descPrefix ? `${descPrefix}\n\n${descLine}` : descLine;
        const course = {
          id: nanoid(12),
          type: 'youtube',
          ytId: item.videoId,
          title: item.title.slice(0, 500),
          category,
          level,
          instructor,
          lang,
          price,
          duration,
          desc,
          rating: 4.5,
          students: 0,
          thumbUrl: null,
          fileUrl: null,
          extUrl: null,
          mimeType: null,
          originalName: null,
          createdAt: base - i
        };
        courses.unshift(course);
        existingIds.add(item.videoId);
        coursesAdded += 1;
      });
      store.writeAll(courses);
    }

    let playerVideos = 0;
    if (syncSitePlayer) {
      const site = siteStore.readSite();
      const videos = items.map((item, i) => ({
        id: item.videoId,
        seq: i + 1,
        title: '',
        views: null,
        note: item.title.slice(0, 140)
      }));
      const heading = String(body.playerHeading || '').trim() || meta.title || site.youtubePlaylist.heading;
      const sub =
        String(body.playerSubheading || '').trim() ||
        (meta.title
          ? `Auto-imported from YouTube (${items.length} videos) · category: ${category}`
          : site.youtubePlaylist.subheading);

      site.youtubePlaylist = {
        heading,
        subheading: sub,
        playlistId,
        playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
        channelUrl: site.youtubePlaylist.channelUrl || process.env.YOUTUBE_CHANNEL_URL || '',
        videos
      };
      siteStore.writeSite(site);
      playerVideos = videos.length;
    }

    res.json({
      ok: true,
      playlistId,
      playlistTitle: meta.title,
      categoryUsed: category,
      videosFound: items.length,
      coursesAdded,
      coursesSkipped,
      sitePlayerVideos: playerVideos
    });
  } catch (e) {
    console.error('import-playlist', e);
    res.status(502).json({ error: e.message || 'Import failed' });
  }
});

module.exports = router;

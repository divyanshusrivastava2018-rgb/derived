const express = require('express');

const router = express.Router();

/** YouTube video IDs are typically 11 chars (alphanumeric, _, -) */
function isLikelyVideoId(v) {
  return typeof v === 'string' && /^[a-zA-Z0-9_-]{10,12}$/.test(v);
}

/**
 * Free metadata (title, author, thumbnail) via YouTube oEmbed — no API key.
 * GET /api/youtube/oembed?v=VIDEO_ID
 */
router.get('/oembed', async (req, res) => {
  const v = req.query.v;
  if (!isLikelyVideoId(v)) {
    return res.status(400).json({ error: 'Invalid or missing video id' });
  }
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(v)}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
  try {
    const r = await fetch(oembedUrl, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) {
      return res.status(502).json({ error: 'YouTube did not return metadata for this video' });
    }
    const data = await r.json();
    res.json({
      title: data.title,
      author_name: data.author_name,
      author_url: data.author_url,
      thumbnail_url: data.thumbnail_url
    });
  } catch (err) {
    console.error('youtube oembed', err);
    res.status(500).json({ error: 'Failed to load YouTube metadata' });
  }
});

module.exports = router;

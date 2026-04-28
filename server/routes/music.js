const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const netease = require('../services/netease');
const { stmts } = require('../db/database');

router.get('/search', async (req, res) => {
  try {
    const { keyword, limit = 30, offset = 0 } = req.query;
    if (!keyword) return res.status(400).json({ error: '请提供搜索关键词' });
    const data = await netease.search(keyword, limit, offset);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function getSongUrlWithFallback(id) {
  const levels = ['exhigh', 'higher', 'standard'];
  for (const level of levels) {
    try {
      const urlRes = await netease.getSongUrl(id, level);
      const urlData = urlRes.data?.[0];
      if (urlData?.url) {
        return { url: urlData.url, level, free: urlData.free || false };
      }
    } catch (e) {
      console.error(`Get song URL failed at level ${level}:`, e.message);
    }
  }
  return { url: '', level: '', free: false };
}

router.get('/song/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [detailRes, urlResult] = await Promise.all([
      netease.getSongDetail(id),
      getSongUrlWithFallback(id),
    ]);

    const song = detailRes.songs?.[0];

    if (!song) return res.status(404).json({ error: '歌曲未找到' });

    const track = {
      netease_id: song.id,
      name: song.name,
      artist: song.ar?.map(a => a.name).join(' / ') || '未知',
      album: song.al?.name || '',
      duration: song.dt,
      pic_url: song.al?.picUrl || '',
      url: urlResult.url,
      tags: '',
      vip: !urlResult.free && urlResult.url ? true : false,
      quality: urlResult.level,
    };

    if (!urlResult.url) {
      track.vip = true;
    } else {
      track.originalUrl = urlResult.url;
      track.url = `/api/music/proxy?url=${encodeURIComponent(urlResult.url)}`;
    }

    stmts.upsertTrack.run({
      netease_id: track.netease_id,
      name: track.name,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      pic_url: track.pic_url,
      url: track.url,
      tags: track.vip ? 'vip' : '',
    });

    res.json(track);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/song/:id/url', async (req, res) => {
  try {
    const result = await getSongUrlWithFallback(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/song/:id/lyric', async (req, res) => {
  try {
    const data = await netease.getLyric(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/lyric/:id', async (req, res) => {
  try {
    const data = await netease.getLyric(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/playlist/:id', async (req, res) => {
  try {
    const data = await netease.getPlaylistDetail(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/recommend', async (req, res) => {
  try {
    const { limit = 12 } = req.query;
    const data = await netease.getPersonalized(Number(limit));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/recommend/songs', async (req, res) => {
  try {
    const data = await netease.getRecommendSongs();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/fm', async (req, res) => {
  try {
    const data = await netease.getPersonalFm();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/intelligence', async (req, res) => {
  try {
    const { id, pid } = req.query;
    if (!id) return res.status(400).json({ error: '请提供歌曲ID' });
    const data = await netease.getIntelligenceList(id, pid);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/local/tracks', (req, res) => {
  const tracks = stmts.getAllTracks.all();
  res.json(tracks);
});

router.get('/local/search', (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q) return res.json([]);
  const pattern = `%${q}%`;
  const tracks = stmts.searchTracks.all(pattern, pattern, pattern, limit);
  res.json(tracks);
});

router.post('/history', (req, res) => {
  try {
    const { name, artist, album, pic_url, netease_id } = req.body;
    let trackId;

    if (netease_id) {
      const existing = stmts.getTrackByNeteaseId.get(netease_id);
      if (existing) {
        trackId = existing.id;
      } else {
        const info = stmts.upsertTrack.run({
          netease_id,
          name: name || '',
          artist: artist || '',
          album: album || '',
          duration: 0,
          pic_url: pic_url || '',
          url: '',
          tags: '',
        });
        trackId = info.lastInsertRowid;
      }
    }

    if (trackId) {
      stmts.addPlayHistory.run(trackId, 0);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', (req, res) => {
  const { limit = 50 } = req.query;
  const history = stmts.getRecentHistory.all(Number(limit));
  res.json(history);
});

router.get('/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'No url' });

    const audioRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://music.163.com/',
      },
    });

    if (!audioRes.ok) {
      return res.status(audioRes.status).json({ error: 'Fetch failed' });
    }

    const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';
    const contentLength = audioRes.headers.get('content-length');

    res.set({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    });

    if (contentLength) {
      res.set('Content-Length', contentLength);
    }

    audioRes.body.pipe(res);
  } catch (err) {
    console.error('Audio proxy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/profile', (req, res) => {
  try {
    const tracks = stmts.getAllTracks.all();
    const history = stmts.getRecentHistory.all(100);
    const playlists = stmts.getAllPlaylists.all();

    const artistCount = {};
    const hourCount = {};
    const allArtists = [];

    tracks.forEach(t => {
      if (t.artist) {
        t.artist.split(' / ').forEach(a => {
          const name = a.trim();
          if (name && name !== '未知') {
            artistCount[name] = (artistCount[name] || 0) + 1;
            allArtists.push(name);
          }
        });
      }
    });

    history.forEach(h => {
      if (h.played_at) {
        const hour = new Date(h.played_at).getHours();
        hourCount[hour] = (hourCount[hour] || 0) + 1;
      }
      if (h.artist) {
        h.artist.split(' / ').forEach(a => {
          const name = a.trim();
          if (name && name !== '未知') {
            artistCount[name] = (artistCount[name] || 0) + 1;
          }
        });
      }
    });

    const topArtists = Object.entries(artistCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count }));

    const peakHours = Object.entries(hourCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }));

    const songNames = tracks.map(t => t.name).filter(Boolean);
    const recentSongNames = history.map(h => h.name).filter(Boolean);

    res.json({
      totalTracks: tracks.length,
      totalPlaylists: playlists.length,
      totalHistory: history.length,
      topArtists,
      peakHours,
      songNames: songNames.slice(0, 50),
      recentSongNames: recentSongNames.slice(0, 30),
      allArtistNames: allArtists,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const ai = require('../services/ai');
const weatherService = require('../services/weather');
const ttsService = require('../services/tts');
const neteaseService = require('../services/netease');
const { stmts } = require('../db/database');

router.post('/send', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: '请提供消息内容' });

    const [weatherData, recentHistory] = await Promise.all([
      weatherService.getCurrentWeather(),
      Promise.resolve(stmts.getRecentHistory.all(5)),
    ]);

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const context = {
      weather: weatherData,
      time: timeStr,
      recentHistory,
    };

    const result = await ai.chat(message, context);

    res.json(result);
  } catch (err) {
    console.error('Chat send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: '请提供文本内容' });

    const audioBuffer = await ttsService.synthesize(text);
    if (!audioBuffer) {
      return res.status(503).json({ error: 'TTS服务不可用' });
    }

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
    });
    res.send(audioBuffer);
  } catch (err) {
    console.error('TTS error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate-playlist', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: '请提供歌单生成需求' });

    const weatherData = await weatherService.getCurrentWeather();
    const context = { weather: weatherData };

    const songs = await ai.generatePlaylist(prompt, context);
    res.json({ songs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', (req, res) => {
  const { limit = 50 } = req.query;
  const messages = stmts.getChatHistory.all(Number(limit)).reverse();
  res.json(messages);
});

router.get('/weather', async (req, res) => {
  try {
    const { city } = req.query;
    const data = await weatherService.getCurrentWeather(city);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/radio/start', async (req, res) => {
  try {
    const weatherData = await weatherService.getCurrentWeather();
    const recentHistory = stmts.getRecentHistory.all(5);

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const context = {
      weather: weatherData,
      time: timeStr,
      recentHistory,
    };

    let recommendedSongs = [];
    const songPromises = [];

    songPromises.push(
      neteaseService.getPersonalFm().then(fmRes => {
        const fmSongs = fmRes.data || [];
        if (fmSongs.length >= 3) {
          return fmSongs.slice(0, 5).map(s => ({
            id: s.id,
            name: s.name,
            artist: s.artists?.map(a => a.name).join(' / ') || '未知',
            picUrl: s.album?.picUrl || '',
          }));
        }
        return [];
      }).catch(() => [])
    );

    songPromises.push(
      neteaseService.getRecommendSongs().then(recRes => {
        const recSongs = recRes.data?.dailySongs || recRes.data || [];
        if (recSongs.length >= 3) {
          return recSongs.slice(0, 5).map(s => ({
            id: s.id,
            name: s.name,
            artist: s.ar?.map(a => a.name).join(' / ') || s.artists?.map(a => a.name).join(' / ') || '未知',
            picUrl: s.al?.picUrl || s.album?.picUrl || '',
          }));
        }
        return [];
      }).catch(() => [])
    );

    const profile = await ai.getUserProfile();
    if (profile && profile.topArtists && profile.topArtists.length > 0) {
      const top3 = profile.topArtists.slice(0, 3);
      for (const artist of top3) {
        songPromises.push(
          neteaseService.search(artist.name, 10).then(searchRes => {
            const searchSongs = searchRes.result?.songs || [];
            const filtered = searchSongs.filter(s => s.fee === 0 || s.fee === 8);
            const source = filtered.length >= 2 ? filtered : searchSongs;
            return source.slice(0, 3).map(s => ({
              id: s.id,
              name: s.name,
              artist: s.ar?.map(a => a.name).join(' / ') || '未知',
              picUrl: s.al?.picUrl || '',
            }));
          }).catch(() => [])
        );
      }
    }

    const songResults = await Promise.all(songPromises);
    for (const songs of songResults) {
      if (songs.length > 0) {
        for (const s of songs) {
          if (!recommendedSongs.find(r => r.id === s.id)) {
            recommendedSongs.push(s);
          }
        }
      }
    }

    if (recommendedSongs.length < 3) {
      try {
        const keywords = ['流行', '经典', '治愈', '轻松', '华语', '民谣'];
        const kw = keywords[Math.floor(Math.random() * keywords.length)];
        const searchRes = await neteaseService.search(kw, 20);
        const searchSongs = searchRes.result?.songs || [];
        const filtered = searchSongs.filter(s => s.fee === 0 || s.fee === 8);
        const source = filtered.length >= 3 ? filtered : searchSongs;
        for (const s of source.slice(0, 5)) {
          const mapped = {
            id: s.id,
            name: s.name,
            artist: s.ar?.map(a => a.name).join(' / ') || '未知',
            picUrl: s.al?.picUrl || '',
          };
          if (!recommendedSongs.find(r => r.id === mapped.id)) {
            recommendedSongs.push(mapped);
          }
        }
      } catch (e) {
        console.error('Radio search fallback error:', e.message);
      }
    }

    recommendedSongs = recommendedSongs.slice(0, 8);

    res.json({
      intro: '',
      ttsUrl: null,
      songs: recommendedSongs,
    });

    ai.generateRadioIntro(context).then(async (intro) => {
      if (!intro) return;
      try {
        const audioBuffer = await ttsService.synthesize(intro);
        if (audioBuffer) {
          const ttsUrl = `/api/chat/tts-cache/${Date.now()}`;
          if (!global._ttsCache) global._ttsCache = {};
          global._ttsCache[ttsUrl] = audioBuffer;
          if (!global._radioPending) global._radioPending = {};
          global._radioPending.intro = { text: intro, ttsUrl };
        }
      } catch (e) {
        console.error('Radio intro TTS error:', e.message);
      }
    }).catch(e => {
      console.error('Radio intro generation error:', e.message);
    });
  } catch (err) {
    console.error('Radio start error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/radio/pending', (req, res) => {
  const pending = global._radioPending || {};
  res.json(pending);
  global._radioPending = {};
});

router.post('/radio/comment', async (req, res) => {
  try {
    const { song } = req.body;
    if (!song) return res.status(400).json({ error: '请提供歌曲信息' });

    const weatherData = await weatherService.getCurrentWeather();
    const context = { weather: weatherData };

    const comment = await ai.generateSongComment(song, context);

    res.json({ comment, ttsUrl: null });

    ttsService.synthesize(comment).then(audioBuffer => {
      if (audioBuffer) {
        const ttsUrl = `/api/chat/tts-cache/${Date.now()}`;
        if (!global._ttsCache) global._ttsCache = {};
        global._ttsCache[ttsUrl] = audioBuffer;
        if (!global._radioPending) global._radioPending = {};
        global._radioPending.comment = { ttsUrl };
      }
    }).catch(e => {
      console.error('Radio comment TTS error:', e.message);
    });
  } catch (err) {
    console.error('Radio comment error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/tts-cache/:id', (req, res) => {
  const cache = global._ttsCache || {};
  const url = `/api/chat/tts-cache/${req.params.id}`;
  const buffer = cache[url];
  if (!buffer) return res.status(404).json({ error: '缓存已过期' });
  res.set({
    'Content-Type': 'audio/mpeg',
    'Content-Length': buffer.length,
  });
  res.send(buffer);
  delete cache[url];
});

module.exports = router;

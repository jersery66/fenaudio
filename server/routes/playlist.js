const express = require('express');
const router = express.Router();
const netease = require('../services/netease');
const { stmts } = require('../db/database');

router.post('/import/:neteaseId', async (req, res) => {
  try {
    const { neteaseId } = req.params;
    const data = await netease.getPlaylistDetail(neteaseId);

    const playlist = data.playlist;
    if (!playlist) return res.status(404).json({ error: '歌单未找到' });

    stmts.upsertPlaylist.run({
      netease_id: playlist.id,
      name: playlist.name,
      description: playlist.description || '',
      cover_url: playlist.coverImgUrl || '',
      track_count: playlist.trackCount,
    });

    const dbPlaylist = stmts.getAllPlaylists.all().find(p => p.netease_id === playlist.id);

    const trackIds = playlist.trackIds?.map(t => t.id) || [];

    if (trackIds.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < trackIds.length; i += batchSize) {
        const batch = trackIds.slice(i, i + batchSize);
        const detailRes = await netease.getSongDetail(batch);

        if (detailRes.songs) {
          for (let j = 0; j < detailRes.songs.length; j++) {
            const song = detailRes.songs[j];
            const track = {
              netease_id: song.id,
              name: song.name,
              artist: song.ar?.map(a => a.name).join(' / ') || '未知',
              album: song.al?.name || '',
              duration: song.dt,
              pic_url: song.al?.picUrl || '',
              url: '',
              tags: '',
            };
            stmts.upsertTrack.run(track);

            const dbTrack = stmts.getTrackByNeteaseId.get(song.id);
            if (dbTrack && dbPlaylist) {
              stmts.addPlaylistTrack.run(dbPlaylist.id, dbTrack.id, i + j);
            }
          }
        }
      }
    }

    res.json({
      success: true,
      playlist: {
        name: playlist.name,
        track_count: playlist.trackCount,
        description: playlist.description,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/list', (req, res) => {
  const playlists = stmts.getAllPlaylists.all();
  res.json(playlists);
});

router.get('/:id/tracks', (req, res) => {
  const tracks = stmts.getPlaylistTracks.all(req.params.id);
  res.json(tracks);
});

module.exports = router;

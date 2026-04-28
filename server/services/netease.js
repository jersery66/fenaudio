const fetch = require('node-fetch');
const config = require('../config');

class NeteaseService {
  constructor() {
    this.baseUrl = config.NETEASE_API_BASE;
    this.cookie = config.NETEASE_COOKIE || '';
  }

  async request(endpoint, params = {}) {
    const url = new URL(endpoint, this.baseUrl);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
    const headers = {};
    if (this.cookie) {
      headers['Cookie'] = this.cookie;
    }
    const res = await fetch(url.toString(), { headers });
    return res.json();
  }

  async getPlaylistDetail(id) {
    return this.request('/playlist/detail', { id });
  }

  async getPlaylistTrackAll(id, limit = 1000, offset = 0) {
    return this.request('/playlist/track/all', { id, limit, offset });
  }

  async getSongDetail(ids) {
    const idStr = Array.isArray(ids) ? ids.join(',') : String(ids);
    return this.request('/song/detail', { ids: idStr });
  }

  async getSongUrl(id, level = 'exhigh') {
    return this.request('/song/url/v1', { id, level });
  }

  async search(keyword, limit = 30, offset = 0) {
    return this.request('/cloudsearch', { keywords: keyword, limit, offset });
  }

  async getLyric(id) {
    return this.request('/lyric', { id });
  }

  async getLyricNew(id) {
    return this.request('/lyric/new', { id });
  }

  async getArtistSongs(id, limit = 50, offset = 0) {
    return this.request('/artist/songs', { id, limit, offset });
  }

  async getRecommendSongs() {
    return this.request('/recommend/songs');
  }

  async getTopPlaylist(limit = 20, cat = '全部') {
    return this.request('/top/playlist', { limit, cat });
  }

  async getSongComment(id, limit = 20) {
    return this.request('/comment/music', { id, limit });
  }

  async getPersonalized(limit = 12) {
    return this.request('/personalized', { limit });
  }

  async getPersonalFm() {
    return this.request('/personal_fm');
  }

  async getIntelligenceList(id, pid) {
    return this.request('/playmode/intelligence/list', { id, pid });
  }
}

module.exports = new NeteaseService();

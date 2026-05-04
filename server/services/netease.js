const fetch = require('node-fetch');
const config = require('../config');

class NeteaseService {
  constructor() {
    this.baseUrl = config.NETEASE_API_BASE;
    this.cookie = config.NETEASE_COOKIE || '';
    this._loadedFromDb = false;
  }

  _ensureCookieFromDb() {
    if (this._loadedFromDb) return;
    this._loadedFromDb = true;
    try {
      const { stmts } = require('../db/database');
      const row = stmts.getPreference.get('netease_cookie');
      if (row && row.value) {
        this.cookie = row.value;
        console.log('Netease: cookie loaded from database');
      }
    } catch (e) {
      console.error('Netease: failed to load cookie from db:', e.message);
    }
  }

  updateCookie(cookie) {
    this.cookie = cookie;
    try {
      const { stmts } = require('../db/database');
      stmts.setPreference.run('netease_cookie', cookie, cookie);
      console.log('Netease: cookie saved to database');
    } catch (e) {
      console.error('Netease: failed to save cookie:', e.message);
    }
  }

  async refreshCookie() {
    if (!this.cookie) return false;
    try {
      const res = await fetch(`${this.baseUrl}/login/refresh`, {
        headers: { Cookie: this.cookie },
      });
      const data = await res.json();
      if (data.code === 200 && data.cookie) {
        this.updateCookie(data.cookie);
        console.log('Netease: cookie refreshed');
        return true;
      }
      console.log('Netease: cookie refresh returned code:', data.code);
      return false;
    } catch (e) {
      console.error('Netease: cookie refresh error:', e.message);
      return false;
    }
  }

  async getLoginStatus() {
    this._ensureCookieFromDb();
    if (!this.cookie) return { loggedIn: false };
    try {
      const res = await fetch(`${this.baseUrl}/login/status`, {
        headers: { Cookie: this.cookie },
      });
      const data = await res.json();
      if (data.code === 200 && data.data?.account) {
        return {
          loggedIn: true,
          nickname: data.data.profile?.nickname || '',
          avatarUrl: data.data.profile?.avatarUrl || '',
          userId: data.data.account.id,
          vipType: data.data.account.vipType,
        };
      }
      return { loggedIn: false };
    } catch (e) {
      return { loggedIn: false };
    }
  }

  async request(endpoint, params = {}) {
    this._ensureCookieFromDb();
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

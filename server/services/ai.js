const fetch = require('node-fetch');
const config = require('../config');
const { stmts } = require('../db/database');

const SYSTEM_PROMPT = `你是"fenaudio"个性化AI电台的DJ助手，名字叫"小芬"。你的职责是：

1. **音乐推荐**：根据用户的心情、天气、时间段、场景等推荐合适的音乐
2. **音乐讲解**：为推荐的歌曲提供背景故事、风格解读、情感共鸣等讲解
3. **聊天陪伴**：与用户自然地交流音乐、生活和感受
4. **歌单定制**：根据用户偏好生成个性化歌单

你的风格：
- 温暖、有品味、不啰嗦
- 对音乐有深入的理解和独到的见解
- 推荐歌曲时给出具体理由，让用户理解为什么这首歌适合当下
- 偶尔分享一些音乐冷知识

回复格式要求：
- 当你推荐歌曲时，请用JSON格式嵌入歌曲信息，方便系统解析：
  【SONG】{"name":"歌曲名","artist":"歌手"}【/SONG】
- 可以一次推荐多首歌曲
- 其他内容正常文字回复即可`;

class AIService {
  constructor() {
    this.apiBase = config.AI_API_BASE;
    this.apiKey = config.AI_API_KEY;
    this.model = config.AI_MODEL;
    this._profileCache = null;
    this._profileCacheTime = 0;
  }

  async getUserProfile() {
    const now = Date.now();
    if (this._profileCache && now - this._profileCacheTime < 300000) {
      return this._profileCache;
    }

    try {
      const res = await fetch('http://localhost:' + config.PORT + '/api/music/profile');
      const profile = await res.json();
      this._profileCache = profile;
      this._profileCacheTime = now;
      return profile;
    } catch (e) {
      return null;
    }
  }

  buildProfileContext(profile) {
    if (!profile) return '';

    let info = '\n\n=== 用户音乐偏好档案 ===';

    if (profile.topArtists && profile.topArtists.length > 0) {
      const artistList = profile.topArtists.slice(0, 10).map(a => `${a.name}(${a.count}首)`).join('、');
      info += `\n- 最喜欢的歌手：${artistList}`;
    }

    if (profile.peakHours && profile.peakHours.length > 0) {
      const hours = profile.peakHours.map(h => `${h.hour}:00`).join('、');
      info += `\n- 常听歌时段：${hours}`;
    }

    if (profile.songNames && profile.songNames.length > 0) {
      info += `\n- 曲库中的歌曲（部分）：${profile.songNames.slice(0, 30).join('、')}`;
    }

    if (profile.recentSongNames && profile.recentSongNames.length > 0) {
      info += `\n- 最近常听：${profile.recentSongNames.slice(0, 15).join('、')}`;
    }

    info += `\n- 曲库总大小：${profile.totalTracks}首`;
    info += '\n请根据以上偏好档案，推荐符合用户口味的歌曲。优先推荐用户喜欢的歌手或相似风格的歌曲。';

    return info;
  }

  async chat(userMessage, context = {}) {
    const history = stmts.getChatHistory.all(10).reverse();

    const profile = await this.getUserProfile();
    const profileContext = this.buildProfileContext(profile);
    const contextInfo = this.buildContext(context);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + profileContext + contextInfo },
    ];

    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }

    messages.push({ role: 'user', content: userMessage });

    stmts.addChatMessage.run('user', userMessage);

    try {
      if (!this.apiKey) {
        const reply = '抱歉，AI服务未配置API密钥，请在.env文件中设置AI_API_KEY。';
        stmts.addChatMessage.run('assistant', reply);
        return { reply, songs: [] };
      }

      const res = await fetch(`${this.apiBase}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.8,
          max_tokens: 800,
        }),
      });

      const data = await res.json();

      if (data.error) {
        console.error('AI API error:', data.error.message || JSON.stringify(data.error));
        const reply = `AI服务返回错误：${data.error.message || '未知错误'}。请检查API配置。`;
        stmts.addChatMessage.run('assistant', reply);
        return { reply, songs: [] };
      }

      const reply = data.choices?.[0]?.message?.content || '抱歉，我暂时无法回复，请稍后再试。';

      stmts.addChatMessage.run('assistant', reply);

      const songs = this.extractSongs(reply);

      return { reply, songs };
    } catch (err) {
      console.error('AI chat error:', err.message);
      const reply = '抱歉，AI服务连接失败，请检查网络和API配置。';
      stmts.addChatMessage.run('assistant', reply);
      return { reply, songs: [] };
    }
  }

  buildContext(context) {
    let info = '\n\n当前上下文信息：';
    if (context.weather) {
      info += `\n- 天气：${context.weather.description}，温度${context.weather.temp}°C`;
    }
    if (context.time) {
      info += `\n- 当前时间：${context.time}`;
    }
    if (context.currentSong) {
      info += `\n- 正在播放：${context.currentSong.name} - ${context.currentSong.artist}`;
    }
    if (context.recentHistory && context.recentHistory.length > 0) {
      const recent = context.recentHistory.slice(0, 5).map(s => `${s.name}-${s.artist}`).join('、');
      info += `\n- 最近听过：${recent}`;
    }
    return info;
  }

  extractSongs(text) {
    const songs = [];
    const regex = /【SONG】(\{[^}]+\})【\/SONG】/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      try {
        const song = JSON.parse(match[1]);
        songs.push(song);
      } catch (e) {}
    }
    return songs;
  }

  async generatePlaylist(prompt, context = {}) {
    const playlistPrompt = `请根据以下需求生成一个歌单（8-12首歌）：${prompt}\n\n请用以下格式回复，每行一首：\n【SONG】{"name":"歌曲名","artist":"歌手"}【/SONG】`;

    const result = await this.chat(playlistPrompt, context);
    return result.songs;
  }

  async generateRadioIntro(context) {
    const { weather } = context;
    const hour = new Date().getHours();
    let timeDesc = '';
    if (hour < 6) timeDesc = '深夜';
    else if (hour < 9) timeDesc = '清晨';
    else if (hour < 12) timeDesc = '上午';
    else if (hour < 14) timeDesc = '中午';
    else if (hour < 18) timeDesc = '下午';
    else if (hour < 21) timeDesc = '傍晚';
    else timeDesc = '夜晚';

    const prompt = `现在是${timeDesc}，天气${weather?.description || '未知'}，温度${weather?.temp || '--'}°C。请用1-2句话做一个电台开场白，像电台DJ那样温暖自然，简短提到时间和天气，然后引出接下来要播放的音乐。不要使用【SONG】标签。控制在30字以内。`;

    try {
      const result = await this.chat(prompt, context);
      return result.reply;
    } catch (err) {
      console.error('Generate radio intro error:', err.message);
      return `欢迎收听fenaudio电台，${timeDesc}好，让我们一起享受音乐吧。`;
    }
  }

  async generateSongComment(song, context) {
    const prompt = `接下来播放《${song.name}》by ${song.artist}。请用1句话简短介绍，像电台DJ串场那样自然，控制在20字以内。不要使用【SONG】标签。`;

    try {
      const result = await this.chat(prompt, context);
      return result.reply;
    } catch (err) {
      console.error('Generate song comment error:', err.message);
      return `接下来是${song.artist}的《${song.name}》。`;
    }
  }
}

module.exports = new AIService();

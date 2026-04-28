class Player {
  constructor() {
    this.audio = new Audio();
    this.playlist = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.mode = 'list';
    this.isFloatMode = false;
    this.audioContext = null;
    this.analyser = null;
    this.visualizerData = null;
    this.lyrics = [];
    this.currentLyricIndex = -1;
    this.radioMode = false;
    this.radioQueue = [];
    this.radioCurrentIndex = -1;
    this.radioTtsAudio = null;
    this.radioTtsPlaying = false;
    this.savedVolume = 0.8;
    this.currentTrack = null;
    this._switching = false;

    this.audio.volume = 0.8;
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';

    this.setupAudioEvents();
    this.setupDrag();
    this.startProgressUpdate();
  }

  setupAudioEvents() {
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayButton();
      this.setupAudioContext();
      if (window.particleSystem) window.particleSystem.setPlaying(true);
    });

    this.audio.addEventListener('pause', () => {
      if (this._switching) return;
      this.isPlaying = false;
      this.updatePlayButton();
      if (window.particleSystem) window.particleSystem.setPlaying(false);
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.updatePlayButton();
      if (this.radioMode) {
        this.radioNext();
      } else {
        this.next();
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', this.audio.error?.code, this.audio.error?.message);
      this.isPlaying = false;
      this.updatePlayButton();
      if (this._switching) return;
      if (this.radioMode) {
        setTimeout(() => this.radioNext(), 1500);
      }
    });

    this.audio.addEventListener('canplay', () => {
      if (this._switching) {
        this._switching = false;
        this.resumeAudioContext().then(() => {
          this.audio.play().then(() => {
          }).catch(e => {
            console.error('Play after canplay error:', e);
          });
        });
      }
    });
  }

  async resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.error('Resume AudioContext error:', e);
      }
    }
  }

  setupAudioContext() {
    if (this.audioContext) return;
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      this.audioSource = this.audioContext.createMediaElementSource(this.audio);
      this.audioSource.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this.visualizerData = new Uint8Array(this.analyser.frequencyBinCount);
      this.startVisualizer();
    } catch (e) {
      console.error('Audio context setup error:', e);
    }
  }

  startVisualizer() {
    const canvas = document.getElementById('audioVisualizer');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (!this.analyser || !this.visualizerData) return;
      requestAnimationFrame(draw);

      this.analyser.getByteFrequencyData(this.visualizerData);

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const barCount = 24;
      const barWidth = w / barCount - 2;
      const step = Math.floor(this.visualizerData.length / barCount);

      for (let i = 0; i < barCount; i++) {
        const val = this.visualizerData[i * step] / 255;
        const barH = val * h * 0.9;
        const hue = 250 + i * 3;
        ctx.fillStyle = `hsla(${hue}, 70%, 65%, ${0.3 + val * 0.5})`;
        const x = i * (barWidth + 2);
        const y = h - barH;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 2);
        ctx.fill();
      }

      if (window.particleSystem) {
        const avg = this.visualizerData.reduce((a, b) => a + b, 0) / this.visualizerData.length / 255;
        window.particleSystem.setAudioLevel(avg);
      }

      const albumArtGlow = document.getElementById('albumArtGlow');
      if (albumArtGlow && this.isPlaying) {
        const bassAvg = this.visualizerData.slice(0, 4).reduce((a, b) => a + b, 0) / 4 / 255;
        const glowOpacity = 0.3 + bassAvg * 0.5;
        const glowScale = 1 + bassAvg * 0.15;
        albumArtGlow.style.opacity = glowOpacity;
        albumArtGlow.style.transform = `scale(${glowScale})`;
      }
    };

    draw();
  }

  setupDrag() {
    const dragArea = document.getElementById('floatDragArea');
    const floatPlayer = document.getElementById('floatPlayer');
    if (!dragArea || !floatPlayer) return;

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    dragArea.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = floatPlayer.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      floatPlayer.style.left = (startLeft + dx) + 'px';
      floatPlayer.style.top = (startTop + dy) + 'px';
      floatPlayer.style.right = 'auto';
      floatPlayer.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  startProgressUpdate() {
    setInterval(() => {
      if (this.audio.duration && !isNaN(this.audio.duration)) {
        const progress = this.audio.currentTime / this.audio.duration;
        const fill = document.getElementById('progressFill');
        const handle = document.getElementById('progressHandle');
        const floatFill = document.getElementById('floatProgressFill');
        if (fill) fill.style.width = (progress * 100) + '%';
        if (handle) handle.style.left = (progress * 100) + '%';
        if (floatFill) floatFill.style.width = (progress * 100) + '%';
      }

      const cur = document.getElementById('currentTime');
      const tot = document.getElementById('totalTime');
      if (cur) cur.textContent = this.formatTime(this.audio.currentTime);
      if (tot && this.audio.duration && !isNaN(this.audio.duration)) {
        tot.textContent = this.formatTime(this.audio.duration);
      }

      this.updateLyrics();
    }, 500);
  }

  setPlaylist(tracks, startIndex = 0) {
    this.playlist = tracks;
    this.currentIndex = startIndex;
    this.playCurrent();
  }

  playCurrent() {
    if (this.currentIndex < 0 || this.currentIndex >= this.playlist.length) return;

    const track = this.playlist[this.currentIndex];
    if (!track) return;

    let url = track.url;
    if (!url && track.netease_id) {
      this.playFromNeteaseById(track.netease_id);
      return;
    }

    if (!url) {
      console.error('No URL for track:', track.name);
      this.next();
      return;
    }

    if (!url.startsWith('/api/') && !url.startsWith('blob:') && !url.startsWith('data:')) {
      url = '/api/music/proxy?url=' + encodeURIComponent(url);
    }

    this._switchTrack(url, track);
  }

  _switchTrack(url, track) {
    this._switching = true;
    this.audio.pause();
    this.audio.src = url;
    this.currentTrack = track;
    this.updateNowPlaying(track);
    this.loadLyrics(track);
    this.saveHistory(track);
  }

  async playFromNeteaseById(neteaseId) {
    this._switching = false;
    this.audio.pause();
    this.isPlaying = false;
    this.updatePlayButton();

    try {
      const titleEl = document.getElementById('songTitle');
      if (titleEl) titleEl.textContent = '加载中...';

      const res = await fetch(`/api/music/song/${neteaseId}`);
      const track = await res.json();

      if (track.url) {
        let url = track.url;
        if (!url.startsWith('/api/') && !url.startsWith('blob:') && !url.startsWith('data:')) {
          url = '/api/music/proxy?url=' + encodeURIComponent(url);
        }
        this._switchTrack(url, track);
      } else {
        this.showVipToast(track.name);
        if (titleEl) titleEl.textContent = track.name || '无法播放';
      }
    } catch (err) {
      console.error('Play from netease error:', err);
    }
  }

  async playSongDirectly(neteaseId) {
    this._switching = false;
    this.audio.pause();
    this.isPlaying = false;
    this.updatePlayButton();

    if (this.radioMode) {
      this.radioMode = false;
      this.updateRadioUI();
    }

    const titleEl = document.getElementById('songTitle');
    if (titleEl) titleEl.textContent = '加载中...';

    try {
      const res = await fetch(`/api/music/song/${neteaseId}`);
      const track = await res.json();

      if (track.url) {
        let url = track.url;
        if (!url.startsWith('/api/') && !url.startsWith('blob:') && !url.startsWith('data:')) {
          url = '/api/music/proxy?url=' + encodeURIComponent(url);
        }

        this.playlist = [{
          netease_id: track.netease_id,
          name: track.name,
          artist: track.artist,
          album: track.album,
          pic_url: track.pic_url,
          url: url,
          tags: track.vip ? 'vip' : '',
        }];
        this.currentIndex = 0;

        this._switchTrack(url, track);
      } else {
        this.showVipToast(track.name);
        if (titleEl) titleEl.textContent = track.name || '无法播放';
      }
    } catch (err) {
      console.error('Play song directly error:', err);
      if (titleEl) titleEl.textContent = '加载失败';
    }
  }

  updateNowPlaying(track) {
    const title = document.getElementById('songTitle');
    const artist = document.getElementById('songArtist');
    const albumArt = document.getElementById('albumArt');
    const albumPlaceholder = document.getElementById('albumPlaceholder');
    const albumWrapper = document.getElementById('albumWrapper');
    const vinylDisc = document.querySelector('.vinyl-disc');
    const bgBlur = document.getElementById('bgBlur');

    if (title) title.textContent = track.name || '未知歌曲';
    if (artist) artist.textContent = track.artist || '未知歌手';

    const picUrl = track.pic_url || track.picUrl;
    if (picUrl) {
      if (albumArt) {
        albumArt.src = picUrl + '?param=400y400';
        albumArt.style.display = 'block';
      }
      if (albumPlaceholder) albumPlaceholder.style.display = 'none';
      if (bgBlur) {
        bgBlur.style.backgroundImage = `url(${picUrl}?param=100y100)`;
        bgBlur.classList.add('active');
      }
    } else {
      if (albumArt) {
        albumArt.style.display = 'none';
        albumArt.classList.remove('spinning');
      }
      if (albumPlaceholder) albumPlaceholder.style.display = 'flex';
      if (bgBlur) bgBlur.classList.remove('active');
    }

    if (albumWrapper && this.isPlaying) albumWrapper.classList.add('playing');

    const floatTitle = document.getElementById('floatTitle');
    const floatArtist = document.getElementById('floatArtist');
    const floatCover = document.getElementById('floatCover');
    if (floatTitle) floatTitle.textContent = track.name || '未知歌曲';
    if (floatArtist) floatArtist.textContent = track.artist || '未知歌手';
    if (floatCover && picUrl) {
      floatCover.innerHTML = `<img src="${picUrl}?param=80y80" alt="">`;
    }
  }

  updatePlayButton() {
    const playIcon = document.getElementById('playIcon');
    const floatPlayIcon = document.getElementById('floatPlayIcon');
    const albumWrapper = document.getElementById('albumWrapper');
    const vinylDisc = document.querySelector('.vinyl-disc');

    if (this.isPlaying) {
      if (playIcon) playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
      if (floatPlayIcon) floatPlayIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
      if (albumWrapper) albumWrapper.classList.add('playing');
      if (vinylDisc) vinylDisc.classList.add('spinning');
    } else {
      if (playIcon) playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
      if (floatPlayIcon) floatPlayIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
      if (albumWrapper) albumWrapper.classList.remove('playing');
      if (vinylDisc) vinylDisc.classList.remove('spinning');
    }
  }

  toggle() {
    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.resumeAudioContext().then(() => {
        if (this.audio.src) {
          this.audio.play().catch(e => console.error('Play error:', e));
        } else if (this.playlist.length > 0) {
          this.playCurrent();
        }
      });
    }
  }

  prev() {
    if (this.playlist.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
    this.playCurrent();
  }

  next() {
    if (this.playlist.length === 0) return;

    if (this.mode === 'shuffle') {
      this.currentIndex = Math.floor(Math.random() * this.playlist.length);
    } else {
      this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    }
    this.playCurrent();
  }

  seek(fraction) {
    if (this.audio.duration && !isNaN(this.audio.duration)) {
      this.audio.currentTime = fraction * this.audio.duration;
    }
  }

  setVolume(val) {
    this.audio.volume = Math.max(0, Math.min(1, val));
  }

  toggleMode() {
    const modes = ['list', 'single', 'shuffle'];
    const idx = modes.indexOf(this.mode);
    this.mode = modes[(idx + 1) % modes.length];

    const btn = document.getElementById('modeBtn');
    if (!btn) return;

    const icons = {
      list: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>',
      single: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/><text x="12" y="14" text-anchor="middle" font-size="7" fill="currentColor" stroke="none">1</text></svg>',
      shuffle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
    };

    btn.innerHTML = icons[this.mode] || icons.list;
    btn.title = this.mode === 'list' ? '列表循环' : this.mode === 'single' ? '单曲循环' : '随机播放';
    btn.classList.toggle('active-mode', this.mode !== 'list');
  }

  toggleFloatMode() {
    this.isFloatMode = !this.isFloatMode;
    const app = document.getElementById('app');
    const floatPlayer = document.getElementById('floatPlayer');

    if (this.isFloatMode) {
      app?.classList.add('float-mode');
      if (floatPlayer) floatPlayer.style.display = 'block';
    } else {
      app?.classList.remove('float-mode');
      if (floatPlayer) floatPlayer.style.display = 'none';
    }
  }

  async loadLyrics(track) {
    const neteaseId = track.netease_id || track.neteaseId;
    if (!neteaseId) {
      this.displayLyrics(null);
      return;
    }

    try {
      const res = await fetch(`/api/music/lyric/${neteaseId}`);
      const data = await res.json();
      this.displayLyrics(data);
    } catch (err) {
      this.displayLyrics(null);
    }
  }

  displayLyrics(data) {
    const content = document.getElementById('lyricContent');
    const panel = document.getElementById('lyricPanel');
    if (!content) return;

    this.lyrics = [];

    if (data && data.lrc && data.lrc.lyric) {
      const lines = data.lrc.lyric.split('\n');
      const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

      for (const line of lines) {
        const match = line.match(regex);
        if (match) {
          const min = parseInt(match[1]);
          const sec = parseInt(match[2]);
          const ms = parseInt(match[3].padEnd(3, '0'));
          const time = min * 60 + sec + ms / 1000;
          const text = match[4].trim();
          if (text) {
            this.lyrics.push({ time, text });
          }
        }
      }

      if (this.lyrics.length > 0) {
        content.innerHTML = this.lyrics.map((l, i) =>
          `<p class="lyric-line" data-index="${i}">${l.text}</p>`
        ).join('');
        if (panel) panel.classList.remove('collapsed');
        this.currentLyricIndex = -1;
        return;
      }
    }

    content.innerHTML = '<p class="lyric-line placeholder">暂无歌词</p>';
  }

  updateLyrics() {
    if (this.lyrics.length === 0) return;

    const currentTime = this.audio.currentTime;
    let newIndex = -1;

    for (let i = this.lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= this.lyrics[i].time) {
        newIndex = i;
        break;
      }
    }

    if (newIndex !== this.currentLyricIndex) {
      this.currentLyricIndex = newIndex;

      const lines = document.querySelectorAll('.lyric-line');
      lines.forEach((el, i) => {
        el.classList.toggle('active', i === newIndex);
      });

      const activeLine = lines[newIndex];
      if (activeLine) {
        const content = document.getElementById('lyricContent');
        if (content) {
          const containerHeight = content.clientHeight;
          const lineTop = activeLine.offsetTop;
          const lineHeight = activeLine.clientHeight;
          content.scrollTop = lineTop - containerHeight / 2 + lineHeight / 2;
        }
      }
    }
  }

  saveHistory(track) {
    if (!track) return;
    fetch('/api/music/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: track.name,
        artist: track.artist,
        album: track.album,
        pic_url: track.pic_url || track.picUrl || '',
        netease_id: track.netease_id || track.neteaseId || null,
      }),
    }).catch(() => {});
  }

  showVipToast(songName) {
    const toast = document.getElementById('vipToast');
    const text = document.getElementById('vipToastText');
    if (toast && text) {
      text.textContent = `"${songName}" 暂无法播放，可能是版权限制`;
      toast.style.display = 'flex';
      setTimeout(() => { toast.style.display = 'none'; }, 4000);
    }
  }

  async toggleRadioMode() {
    this.radioMode = !this.radioMode;
    this.updateRadioUI();

    if (this.radioMode) {
      await this.startRadio();
    } else {
      this.stopRadio();
    }
  }

  updateRadioUI() {
    const btn = document.getElementById('radioBtn');
    const indicator = document.getElementById('radioIndicator');

    if (btn) {
      btn.classList.toggle('active', this.radioMode);
      btn.innerHTML = this.radioMode
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg><span>停止电台</span>'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg><span>电台</span>';
    }

    if (indicator) {
      indicator.style.display = this.radioMode ? 'flex' : 'none';
    }
  }

  stopRadio() {
    if (this.radioTtsAudio) {
      this.radioTtsAudio.pause();
      this.radioTtsAudio = null;
    }
    this.radioTtsPlaying = false;
    this.audio.volume = this.savedVolume;
    this.radioQueue = [];
    this.radioCurrentIndex = -1;
  }

  async startRadio() {
    try {
      this.addRadioMessage('📻 正在连接电台...');

      const res = await fetch('/api/chat/radio/start', { method: 'POST' });
      const data = await res.json();

      if (data.songs && data.songs.length > 0) {
        this.radioQueue = data.songs;
        this.radioCurrentIndex = 0;

        const firstSong = this.radioQueue[0];
        const played = await this.playRadioSong(firstSong);

        if (!played && this.radioMode) {
          this.radioNext();
          return;
        }

        this.pollRadioIntro();
      } else {
        this.addRadioMessage('暂无推荐歌曲，请稍后再试。');
      }
    } catch (err) {
      console.error('Start radio error:', err);
      this.addRadioMessage('电台启动失败，请稍后再试。');
    }
  }

  pollRadioIntro() {
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      if (attempts > 15 || !this.radioMode) {
        clearInterval(poll);
        return;
      }
      try {
        const res = await fetch('/api/chat/radio/pending');
        const pending = await res.json();
        if (pending.intro) {
          clearInterval(poll);
          this.addRadioMessage(pending.intro.text);
          if (pending.intro.ttsUrl) {
            this.playTtsOverMusic(pending.intro.ttsUrl);
          }
        }
      } catch (e) {
        clearInterval(poll);
      }
    }, 2000);
  }

  async playRadioSong(song) {
    try {
      const res = await fetch(`/api/music/song/${song.id}`);
      const track = await res.json();

      if (track.url) {
        let url = track.url;
        if (!url.startsWith('/api/') && !url.startsWith('blob:') && !url.startsWith('data:')) {
          url = '/api/music/proxy?url=' + encodeURIComponent(url);
        }
        this._switching = true;
        this.audio.pause();
        this.audio.src = url;
        this.audio.volume = this.savedVolume;
        this.currentTrack = track;
        this.updateNowPlaying(track);
        this.loadLyrics(track);
        this.saveHistory(track);

        await this.resumeAudioContext();
        await this.audio.play();
        this._switching = false;
        return true;
      } else {
        this.showVipToast(track.name || song.name);
        return false;
      }
    } catch (err) {
      console.error('Play radio song error:', err);
      this._switching = false;
      return false;
    }
  }

  playTtsOverMusic(url) {
    if (this.radioTtsAudio) {
      this.radioTtsAudio.pause();
      this.radioTtsAudio = null;
    }

    this.radioTtsAudio = new Audio(url);
    this.radioTtsAudio.volume = 1.0;
    this.radioTtsPlaying = true;

    this.savedVolume = this.audio.volume || 0.8;
    this.audio.volume = this.savedVolume * 0.15;

    this.radioTtsAudio.onended = () => {
      this.radioTtsPlaying = false;
      this.audio.volume = this.savedVolume;
      this.radioTtsAudio = null;
    };

    this.radioTtsAudio.onerror = () => {
      this.radioTtsPlaying = false;
      this.audio.volume = this.savedVolume;
      this.radioTtsAudio = null;
    };

    this.radioTtsAudio.play().catch(() => {
      this.radioTtsPlaying = false;
      this.audio.volume = this.savedVolume;
    });
  }

  async radioNext() {
    if (this.radioQueue.length === 0) return;

    this.radioCurrentIndex++;
    if (this.radioCurrentIndex >= this.radioQueue.length) {
      this.radioCurrentIndex = 0;
    }

    const song = this.radioQueue[this.radioCurrentIndex];
    const played = await this.playRadioSong(song);

    if (!played && this.radioMode) {
      setTimeout(() => this.radioNext(), 1000);
    }
  }

  addRadioMessage(text) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'chat-msg assistant';

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = '芬';

    const body = document.createElement('div');
    body.className = 'msg-body';
    body.textContent = text;

    el.appendChild(avatar);
    el.appendChild(body);
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

const player = new Player();
window.player = player;

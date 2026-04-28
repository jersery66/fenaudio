class FenaudioApp {
  constructor() {
    this.currentTab = 'playlist';
    this.playlists = [];
    this.tracks = [];
    this.recommendPlaylists = [];
    this.searchTimeout = null;
    this.searchHistory = [];
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadPlaylists();
    await this.loadTracks();
    this.loadChatHistory();
    this.loadSearchHistory();
  }

  bindEvents() {
    document.querySelectorAll('.sidebar-nav button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-nav button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.switchTab(btn.dataset.tab);
      });
    });

    const searchInput = document.getElementById('searchInput');
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      const val = e.target.value.trim();
      if (!val) {
        this.renderSidebar();
        return;
      }
      this.searchTimeout = setTimeout(() => {
        this.switchTab('search');
        this.handleSearch(val);
      }, 300);
    });

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(this.searchTimeout);
        const val = e.target.value.trim();
        if (val) {
          this.switchTab('search');
          this.handleSearch(val);
        }
      }
    });

    const chatInput = document.getElementById('chatInput');
    const chatBtn = document.getElementById('chatSendBtn');

    chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChat();
      }
    });

    chatBtn?.addEventListener('click', () => this.sendChat());

    document.getElementById('ttsToggle')?.addEventListener('click', () => {
      window.chat.toggleTTS();
    });

    document.getElementById('chatToggle')?.addEventListener('click', () => {
      this.toggleChat();
    });

    document.getElementById('chatHeader')?.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        this.toggleChat();
      }
    });

    document.getElementById('lyricToggle')?.addEventListener('click', () => {
      this.toggleLyrics();
    });

    document.getElementById('playBtn')?.addEventListener('click', () => {
      window.player.toggle();
    });

    document.getElementById('prevBtn')?.addEventListener('click', () => {
      window.player.prev();
    });

    document.getElementById('nextBtn')?.addEventListener('click', () => {
      window.player.next();
    });

    const progressBar = document.querySelector('.progress-bar .bar');
    progressBar?.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const fraction = (e.clientX - rect.left) / rect.width;
      window.player.seek(fraction);
    });

    const volumeSlider = document.getElementById('volumeSlider');
    volumeSlider?.addEventListener('input', (e) => {
      window.player.setVolume(e.target.value / 100);
    });

    document.getElementById('modeBtn')?.addEventListener('click', () => {
      window.player.toggleMode();
    });

    document.getElementById('floatToggle')?.addEventListener('click', () => {
      window.player.toggleFloatMode();
    });

    document.getElementById('floatPlay')?.addEventListener('click', () => {
      window.player.toggle();
    });

    document.getElementById('floatPrev')?.addEventListener('click', () => {
      window.player.prev();
    });

    document.getElementById('floatNext')?.addEventListener('click', () => {
      window.player.next();
    });

    document.getElementById('floatExpand')?.addEventListener('click', () => {
      window.player.toggleFloatMode();
    });

    document.getElementById('radioBtn')?.addEventListener('click', () => {
      window.player.toggleRadioMode();
    });

    document.addEventListener('click', (e) => {
      const ripple = document.createElement('div');
      ripple.className = 'click-ripple';
      ripple.style.left = (e.clientX - 40) + 'px';
      ripple.style.top = (e.clientY - 40) + 'px';
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  }

  toggleChat() {
    const panel = document.getElementById('chatPanel');
    if (panel) {
      panel.classList.toggle('expanded');
    }
  }

  toggleLyrics() {
    const panel = document.getElementById('lyricPanel');
    if (panel) {
      panel.classList.toggle('collapsed');
    }
  }

  switchTab(tab) {
    this.currentTab = tab;
    if (tab !== 'search') {
      document.querySelectorAll('.sidebar-nav button').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
      });
    }
    this.renderSidebar();
  }

  async loadPlaylists() {
    try {
      const res = await fetch('/api/playlist/list');
      this.playlists = await res.json();
      this.renderSidebar();
    } catch (err) {
      console.error('Load playlists error:', err);
    }
  }

  async loadTracks() {
    try {
      const res = await fetch('/api/music/local/tracks');
      this.tracks = await res.json();
      this.renderSidebar();
    } catch (err) {
      console.error('Load tracks error:', err);
    }
  }

  loadSearchHistory() {
    try {
      const saved = localStorage.getItem('fenaudio_search_history');
      if (saved) this.searchHistory = JSON.parse(saved);
    } catch (e) {}
  }

  saveSearchHistory(keyword) {
    this.searchHistory = this.searchHistory.filter(k => k !== keyword);
    this.searchHistory.unshift(keyword);
    if (this.searchHistory.length > 10) this.searchHistory = this.searchHistory.slice(0, 10);
    try {
      localStorage.setItem('fenaudio_search_history', JSON.stringify(this.searchHistory));
    } catch (e) {}
  }

  async loadChatHistory() {
    try {
      const res = await fetch('/api/chat/history?limit=20');
      const messages = await res.json();
      const container = document.getElementById('chatMessages');
      if (!container) return;

      const welcomeMsg = container.querySelector('.chat-msg');
      container.innerHTML = '';

      if (welcomeMsg && messages.length === 0) {
        container.appendChild(welcomeMsg);
      }

      messages.reverse().forEach(msg => {
        const el = document.createElement('div');
        el.className = `chat-msg ${msg.role}`;

        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        avatar.textContent = msg.role === 'user' ? '我' : '芬';

        const body = document.createElement('div');
        body.className = 'msg-body';
        body.textContent = msg.content;

        el.appendChild(avatar);
        el.appendChild(body);
        container.appendChild(el);
      });
      container.scrollTop = container.scrollHeight;
    } catch (err) {
      console.error('Load chat history error:', err);
    }
  }

  async handleSearch(query) {
    if (!query) {
      this.renderSidebar();
      return;
    }

    this.saveSearchHistory(query);

    const container = document.getElementById('sidebarContent');
    if (!container) return;

    container.innerHTML = '<div class="playlist-header"><h3>搜索中...</h3></div><div class="empty-state"><div class="empty-icon">⏳</div><p>正在搜索"${query}"</p></div>';

    try {
      const neteaseRes = await fetch(`/api/music/search?keyword=${encodeURIComponent(query)}&limit=30`);
      const neteaseData = await neteaseRes.json();
      const songs = neteaseData.result?.songs || [];

      let html = `<div class="playlist-header"><h3>搜索结果</h3><span style="font-size:11px;color:var(--text-muted)">${songs.length} 首</span></div>`;

      if (songs.length > 0) {
        songs.forEach(song => {
          const artist = song.ar?.map(a => a.name).join(' / ') || '未知';
          const album = song.al?.name || '';
          const pic = song.al?.picUrl || '';
          const duration = song.dt ? Math.floor(song.dt / 60000) + ':' + String(Math.floor((song.dt % 60000) / 1000)).padStart(2, '0') : '';
          html += `<div class="track-item" onclick="app.playFromNetease(${song.id})">
            ${pic ? `<img class="cover" src="${pic}?param=80y80" alt="" loading="lazy">` : '<div class="cover-placeholder">🎵</div>'}
            <div class="info">
              <div class="name">${song.name}</div>
              <div class="artist">${artist}${album ? ' · ' + album : ''}</div>
            </div>
            ${duration ? `<span class="duration">${duration}</span>` : ''}
            ${song.fee === 1 ? '<span class="vip-badge">VIP</span>' : ''}
          </div>`;
        });
      } else {
        html += `<div class="empty-state"><div class="empty-icon">🔍</div><p>没有找到"${query}"的相关歌曲</p></div>`;
      }

      if (this.searchHistory.length > 0) {
        html += `<div class="playlist-header" style="margin-top:16px"><h3>搜索历史</h3><button class="clear-history-btn" onclick="app.clearSearchHistory()">清除</button></div>`;
        html += '<div class="search-history-tags">';
        this.searchHistory.forEach(kw => {
          html += `<span class="search-tag" onclick="app.searchKeyword('${kw.replace(/'/g, "\\'")}')">${kw}</span>`;
        });
        html += '</div>';
      }

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>搜索失败：${err.message}</p></div>`;
    }
  }

  searchKeyword(keyword) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = keyword;
    this.switchTab('search');
    this.handleSearch(keyword);
  }

  clearSearchHistory() {
    this.searchHistory = [];
    try { localStorage.removeItem('fenaudio_search_history'); } catch (e) {}
    this.renderSidebar();
  }

  renderTrackItem(track, globalIndex) {
    return `<div class="track-item" data-track-index="${globalIndex}" onclick="app.playTrack(${globalIndex})">
      ${track.pic_url ? `<img class="cover" src="${track.pic_url}?param=80y80" alt="">` : '<div class="cover-placeholder">🎵</div>'}
      <div class="info">
        <div class="name">${track.name}</div>
        <div class="artist">${track.artist || '未知'}</div>
      </div>
      ${track.tags?.includes('vip') ? '<span class="vip-badge">VIP</span>' : ''}
    </div>`;
  }

  renderSidebar() {
    const container = document.getElementById('sidebarContent');
    if (!container) return;

    if (this.currentTab === 'playlist') {
      this.renderPlaylistTab(container);
    } else if (this.currentTab === 'tracks') {
      this.renderTracksTab(container);
    } else if (this.currentTab === 'recommend') {
      this.renderRecommendTab(container);
    } else if (this.currentTab === 'history') {
      this.renderHistoryTab(container);
    } else if (this.currentTab === 'search') {
      const searchInput = document.getElementById('searchInput');
      const query = searchInput?.value?.trim();
      if (query) {
        this.handleSearch(query);
      } else {
        this.renderSearchHome(container);
      }
    }
  }

  renderSearchHome(container) {
    let html = '<div class="playlist-header"><h3>搜索歌曲</h3></div>';

    html += '<div class="search-suggestions">';
    const hotKeywords = ['周杰伦', '陈奕迅', '林俊杰', '薛之谦', '邓紫棋', '毛不易', '赵雷', '李荣浩', '华晨宇', '五月天'];
    hotKeywords.forEach(kw => {
      html += `<span class="search-tag" onclick="app.searchKeyword('${kw}')">${kw}</span>`;
    });
    html += '</div>';

    if (this.searchHistory.length > 0) {
      html += `<div class="playlist-header" style="margin-top:16px"><h3>搜索历史</h3><button class="clear-history-btn" onclick="app.clearSearchHistory()">清除</button></div>`;
      html += '<div class="search-history-tags">';
      this.searchHistory.forEach(kw => {
        html += `<span class="search-tag" onclick="app.searchKeyword('${kw.replace(/'/g, "\\'")}')">${kw}</span>`;
      });
      html += '</div>';
    }

    container.innerHTML = html;
  }

  renderPlaylistTab(container) {
    let html = '<div class="playlist-header"><h3>我的歌单</h3><button class="import-btn" onclick="app.showImportModal()">导入歌单</button></div>';

    if (this.playlists.length === 0) {
      html += `<div class="empty-state"><div class="empty-icon">🎵</div><p>还没有导入歌单<br>点击上方"导入歌单"开始</p></div>`;
    } else {
      this.playlists.forEach(pl => {
        html += `<div class="track-item" onclick="app.loadPlaylistTracks(${pl.id})">
          ${pl.cover_url ? `<img class="cover" src="${pl.cover_url}?param=80y80" alt="">` : '<div class="cover-placeholder">📂</div>'}
          <div class="info">
            <div class="name">${pl.name}</div>
            <div class="artist">${pl.track_count} 首歌曲</div>
          </div>
        </div>`;
      });
    }

    container.innerHTML = html;
  }

  renderTracksTab(container) {
    let html = '<div class="playlist-header"><h3>曲库</h3><span style="font-size:11px;color:var(--text-muted)">' + this.tracks.length + ' 首</span></div>';

    if (this.tracks.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">💿</div><p>曲库为空<br>导入歌单后歌曲会出现在这里</p></div>`;
      return;
    }

    this.tracks.forEach((track, i) => {
      html += this.renderTrackItem(track, i);
    });

    container.innerHTML = html;
  }

  async renderRecommendTab(container) {
    container.innerHTML = '<div class="playlist-header"><h3>个性推荐</h3></div><div class="empty-state"><div class="empty-icon">⏳</div><p>正在加载推荐...</p></div>';

    try {
      const [personalizedRes, fmRes] = await Promise.allSettled([
        fetch('/api/music/recommend?limit=12'),
        fetch('/api/music/fm'),
      ]);

      let html = '<div class="playlist-header"><h3>个性推荐</h3></div>';

      if (personalizedRes.status === 'fulfilled') {
        const data = personalizedRes.value;
        const playlists = data.result || [];
        if (playlists.length > 0) {
          html += '<div class="playlist-header"><h3>推荐歌单</h3></div>';
          html += '<div class="recommend-grid">';
          playlists.slice(0, 12).forEach(pl => {
            html += `<div class="recommend-card" onclick="app.importAndPlay(${pl.id})">
              ${pl.picUrl ? `<img class="card-cover" src="${pl.picUrl}?param=200y200" alt="">` : '<div class="card-cover-placeholder">🎵</div>'}
              <div class="card-info">
                <div class="card-name">${pl.name}</div>
                <div class="card-desc">${pl.playCount ? (pl.playCount > 10000 ? Math.floor(pl.playCount / 10000) + '万' : pl.playCount) + '次播放' : ''}</div>
              </div>
            </div>`;
          });
          html += '</div>';
        }
      }

      if (fmRes.status === 'fulfilled') {
        const fmData = fmRes.value;
        const fmSongs = fmData.data || [];
        if (fmSongs.length > 0) {
          html += '<div class="playlist-header" style="margin-top:12px"><h3>私人FM</h3></div>';
          fmSongs.slice(0, 10).forEach(song => {
            const artist = song.artists?.map(a => a.name).join(' / ') || '未知';
            const pic = song.album?.picUrl || '';
            html += `<div class="track-item" onclick="app.playFromNetease(${song.id})">
              ${pic ? `<img class="cover" src="${pic}?param=80y80" alt="">` : '<div class="cover-placeholder">📻</div>'}
              <div class="info">
                <div class="name">${song.name}</div>
                <div class="artist">${artist}</div>
              </div>
            </div>`;
          });
        }
      }

      try {
        const recSongsRes = await fetch('/api/music/recommend/songs');
        if (recSongsRes.ok) {
          const recData = await recSongsRes.json();
          const recSongs = recData.data?.dailySongs || recData.data || [];
          if (recSongs.length > 0) {
            html += '<div class="playlist-header" style="margin-top:12px"><h3>每日推荐</h3></div>';
            recSongs.slice(0, 15).forEach(song => {
              const artist = song.ar?.map(a => a.name).join(' / ') || song.artists?.map(a => a.name).join(' / ') || '未知';
              const pic = song.al?.picUrl || song.album?.picUrl || '';
              html += `<div class="track-item" onclick="app.playFromNetease(${song.id})">
                ${pic ? `<img class="cover" src="${pic}?param=80y80" alt="">` : '<div class="cover-placeholder">⭐</div>'}
                <div class="info">
                  <div class="name">${song.name}</div>
                  <div class="artist">${artist}</div>
                </div>
                ${song.fee === 1 ? '<span class="vip-badge">VIP</span>' : ''}
              </div>`;
            });
          }
        }
      } catch (e) {
        console.error('Recommend songs error:', e);
      }

      if (html.indexOf('recommend-card') === -1 && html.indexOf('track-item') === -1) {
        html += `<div class="empty-state"><div class="empty-icon">🌟</div><p>推荐功能需要登录网易云音乐<br>请在.env中配置NETEASE_COOKIE</p></div>`;
      }

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>加载推荐失败<br>${err.message}</p></div>`;
    }
  }

  async renderHistoryTab(container) {
    container.innerHTML = '<div class="playlist-header"><h3>播放历史</h3></div><div class="empty-state"><div class="empty-icon">⏳</div><p>加载中...</p></div>';

    try {
      const res = await fetch('/api/music/history?limit=50');
      const history = await res.json();

      if (history.length === 0) {
        container.innerHTML = `<div class="playlist-header"><h3>播放历史</h3></div><div class="empty-state"><div class="empty-icon">🕐</div><p>还没有播放记录</p></div>`;
        return;
      }

      let html = '<div class="playlist-header"><h3>播放历史</h3></div>';
      history.forEach(track => {
        const neteaseId = track.netease_id;
        if (neteaseId) {
          html += `<div class="track-item" onclick="app.playFromNetease(${neteaseId})">
            ${track.pic_url ? `<img class="cover" src="${track.pic_url}?param=80y80" alt="">` : '<div class="cover-placeholder">🎵</div>'}
            <div class="info">
              <div class="name">${track.name}</div>
              <div class="artist">${track.artist || '未知'}</div>
            </div>
          </div>`;
        } else {
          const idx = this.tracks.findIndex(t => t.id === track.id);
          html += `<div class="track-item" onclick="app.playTrack(${idx >= 0 ? idx : -1})">
            ${track.pic_url ? `<img class="cover" src="${track.pic_url}?param=80y80" alt="">` : '<div class="cover-placeholder">🎵</div>'}
            <div class="info">
              <div class="name">${track.name}</div>
              <div class="artist">${track.artist || '未知'}</div>
            </div>
          </div>`;
        }
      });

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>加载失败</p></div>`;
    }
  }

  playTrack(index) {
    if (index >= 0 && index < this.tracks.length) {
      window.player.setPlaylist([...this.tracks], index);
    }
  }

  async playFromNetease(neteaseId) {
    await window.player.playSongDirectly(neteaseId);
  }

  async importAndPlay(playlistId) {
    try {
      const res = await fetch(`/api/playlist/import/${playlistId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await this.loadPlaylists();
        await this.loadTracks();
        const dbPlaylist = this.playlists.find(p => p.netease_id === playlistId);
        if (dbPlaylist) {
          await this.loadPlaylistTracks(dbPlaylist.id);
        }
      }
    } catch (err) {
      console.error('Import and play error:', err);
    }
  }

  async loadPlaylistTracks(playlistId) {
    try {
      const res = await fetch(`/api/playlist/${playlistId}/tracks`);
      const tracks = await res.json();
      if (tracks.length > 0) {
        this.tracks = tracks;
        this.currentTab = 'tracks';
        document.querySelectorAll('.sidebar-nav button').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === 'tracks');
        });
        this.renderSidebar();
        window.player.setPlaylist(tracks);
      }
    } catch (err) {
      console.error('Load playlist tracks error:', err);
    }
  }

  async playSongFromChat(name, artist) {
    try {
      const keyword = artist ? `${name} ${artist}` : name;
      const res = await fetch(`/api/music/search?keyword=${encodeURIComponent(keyword)}&limit=1`);
      const data = await res.json();

      const song = data.result?.songs?.[0];
      if (song) {
        await this.playFromNetease(song.id);
      }
    } catch (err) {
      console.error('Play from chat error:', err);
    }
  }

  sendChat() {
    const input = document.getElementById('chatInput');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    window.chat.send(message);
  }

  showImportModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3>导入网易云音乐歌单</h3>
        <input type="text" id="import-playlist-id" placeholder="输入歌单ID（从分享链接获取）" />
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
          歌单ID获取方式：打开歌单分享链接，链接中的数字即为ID<br>
          例如：music.163.com/playlist?id=<strong>123456789</strong>
        </p>
        <div class="actions">
          <button class="cancel" onclick="this.closest('.modal-overlay').remove()">取消</button>
          <button class="confirm" onclick="app.importPlaylist()">导入</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  async importPlaylist() {
    const input = document.getElementById('import-playlist-id');
    if (!input) return;

    const id = input.value.trim();
    if (!id) return;

    const modal = input.closest('.modal');
    const actionsDiv = modal.querySelector('.actions');
    actionsDiv.innerHTML = '<div class="loading">导入中...</div>';

    try {
      const res = await fetch(`/api/playlist/import/${id}`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        modal.innerHTML = `<h3>导入成功！</h3><p>歌单"${data.playlist.name}"已导入，共${data.playlist.track_count}首歌曲。</p><div class="actions"><button class="confirm" onclick="this.closest('.modal-overlay').remove()">完成</button></div>`;
        await this.loadPlaylists();
        await this.loadTracks();
      } else {
        modal.innerHTML = `<h3>导入失败</h3><p>${data.error || '请检查歌单ID是否正确'}</p><div class="actions"><button class="confirm" onclick="this.closest('.modal-overlay').remove()">关闭</button></div>`;
      }
    } catch (err) {
      modal.innerHTML = `<h3>导入失败</h3><p>网络错误，请检查服务器和网易云API是否正常运行</p><div class="actions"><button class="confirm" onclick="this.closest('.modal-overlay').remove()">关闭</button></div>`;
    }
  }
}

const app = new FenaudioApp();

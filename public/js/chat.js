class ChatService {
  constructor() {
    this.ttsEnabled = false;
    this.isLoading = false;
  }

  async send(message) {
    if (this.isLoading) return;
    this.isLoading = true;

    this.addMessage('user', message);

    const loadingId = this.addMessage('assistant', '...');

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();
      this.removeMessage(loadingId);

      if (data.reply) {
        this.addMessage('assistant', data.reply);

        if (this.ttsEnabled) {
          this.speak(data.reply);
        }

        if (data.songs && data.songs.length > 0) {
          this.addSongCards(data.songs);
        }
      } else {
        this.addMessage('assistant', '抱歉，我暂时无法回复，请稍后再试。');
      }
    } catch (err) {
      this.removeMessage(loadingId);
      this.addMessage('assistant', '网络错误，请检查服务器是否正常运行。');
      console.error('Chat error:', err);
    } finally {
      this.isLoading = false;
    }
  }

  addMessage(role, content) {
    const container = document.getElementById('chatMessages');
    if (!container) return null;

    const id = 'msg-' + Date.now() + Math.random().toString(36).substr(2, 5);
    const el = document.createElement('div');
    el.className = `chat-msg ${role}`;
    el.id = id;

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = role === 'user' ? '我' : '芬';

    const body = document.createElement('div');
    body.className = 'msg-body';

    if (role === 'assistant' && content === '...') {
      body.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    } else {
      body.textContent = content;
    }

    el.appendChild(avatar);
    el.appendChild(body);
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;

    return id;
  }

  removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  addSongCards(songs) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const cardContainer = document.createElement('div');
    cardContainer.className = 'song-cards';

    songs.forEach(song => {
      const card = document.createElement('div');
      card.className = 'song-card';
      card.onclick = () => window.app.playFromNetease(song.id);

      card.innerHTML = `
        ${song.picUrl ? `<img class="song-card-cover" src="${song.picUrl}?param=80y80" alt="">` : '<div class="song-card-cover-placeholder">🎵</div>'}
        <div class="song-card-info">
          <div class="song-card-name">${song.name}</div>
          <div class="song-card-artist">${song.artist || '未知'}</div>
        </div>
        <div class="song-card-play">▶</div>
        ${song.fee === 1 ? '<span class="vip-badge">VIP</span>' : ''}
      `;

      cardContainer.appendChild(card);
    });

    container.appendChild(cardContainer);
    container.scrollTop = container.scrollHeight;
  }

  toggleTTS() {
    this.ttsEnabled = !this.ttsEnabled;
    const btn = document.getElementById('ttsToggle');
    if (btn) {
      btn.classList.toggle('active', this.ttsEnabled);
    }
  }

  async speak(text) {
    try {
      const cleanText = text.replace(/[🎵🎶🎤🎧📻💿🎸🎹🥁🎻🎺🎷🪕🪘🔊🔉🔈🔇🔔📣💬📝✨🌟⭐💫🔥💡🎯🎮🎬📷📸📱💻🖥️⌨️🖱️💾💿📀📼🎥📽️🎬🎭🖼️🎨🖌️🖍️✏️🖊️🖋️📌📎🖇️📏📐✂️🗃️🗄️🗑️🔒🔓🔏🔐🔑🗝️🔨🪓⛏️⚒️🛠️🗡️⚔️🔫🏹🛡️🔧🔩⚙️🗜️⚖️🦯🔗⛓️🧰🧲🧪🧫🧬🔬🔭📡💉🩸💊🩹🩺🚪🛏️🛋️🪑🚽🚿🛁🪒🧴🧷🧹🧺🧻🧼🧽🧯🛒🚬⚰️⚱️🗿🪧]/g, '').trim();
      if (!cleanText || cleanText.length < 2) return;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const res = await fetch('/api/chat/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText.substring(0, 300) }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        console.error('TTS response not ok:', res.status);
        return;
      }

      const blob = await res.blob();
      if (blob.size < 100) {
        console.error('TTS audio too small:', blob.size);
        return;
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = 0.7;

      if (window.player && window.player.audio) {
        const prevVolume = window.player.audio.volume;
        window.player.audio.volume = prevVolume * 0.3;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (window.player && window.player.audio) {
            window.player.audio.volume = prevVolume;
          }
        };
      } else {
        audio.onended = () => URL.revokeObjectURL(url);
      }

      await audio.play();
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error('TTS timeout (20s)');
      } else {
        console.error('TTS error:', err);
      }
    }
  }
}

const chat = new ChatService();
window.chat = chat;

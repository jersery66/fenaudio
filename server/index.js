const express = require('express');
const path = require('path');
const cors = require('cors');
const config = require('./config');
const musicRoutes = require('./routes/music');
const chatRoutes = require('./routes/chat');
const playlistRoutes = require('./routes/playlist');
const authRoutes = require('./routes/auth');
const netease = require('./services/netease');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(config.PUBLIC_DIR));

app.use('/api/music', musicRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/playlist', playlistRoutes);
app.use('/api/auth', authRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(config.PUBLIC_DIR, 'index.html'));
});

app.listen(config.PORT, () => {
  console.log(`🎵 fenaudio 个性化AI电台已启动`);
  console.log(`📡 服务地址: http://localhost:${config.PORT}`);
  console.log(`🔗 网易云API: ${config.NETEASE_API_BASE}`);
  console.log(`🤖 AI模型: ${config.AI_MODEL}`);

  // 启动时刷新一次 cookie，之后每 30 分钟刷新一次
  setTimeout(() => netease.refreshCookie(), 5000);
  setInterval(() => netease.refreshCookie(), 30 * 60 * 1000);
});

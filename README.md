# fenaudio - 个性化 AI 电台

fenaudio 是一款基于个人音乐品味的智能音乐电台。AI DJ **小芬** 会根据你的听歌历史、当前天气和时段，为你推荐音乐、生成电台播报，并用语音讲述歌曲背后的故事。

## 功能

**AI DJ**
- 基于通义千问大模型的智能对话，支持自然语言点歌和心情推荐
- 电台模式：自动编排歌单，歌曲之间穿插 AI 语音串场
- CosyVoice 语音合成，让 DJ 拥有自然的声线

**音乐**
- 网易云音乐全量搜索、歌单导入、私人 FM、每日推荐
- 歌词同步显示，音频频谱可视化
- 支持多种音质（exhigh / higher / standard 自动降级）

**界面**
- 深色主题，Canvas 粒子背景随音乐节奏变化
- 悬浮窗模式，可拖拽到屏幕边缘
- 点击涟漪动效

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vanilla JS / CSS3 / HTML5 / Canvas |
| 后端 | Node.js / Express |
| 数据库 | SQLite (better-sqlite3, WAL 模式) |
| AI | 阿里云 DashScope / 通义千问 |
| TTS | 阿里云 CosyVoice |
| 音乐数据 | NeteaseCloudMusicApi |

## 快速开始

### 1. 克隆并安装依赖

```bash
git clone https://github.com/jersery66/fenaudio.git
cd fenaudio
npm install
cd NeteaseCloudMusicApiGitee && npm install && cd ..
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入 API 密钥：

```bash
cp .env.example .env
```

必须配置的项：
- `AI_API_KEY` — 阿里云 DashScope API Key（AI 对话 + TTS 共用）
- `WEATHER_API_KEY` — OpenWeather API Key（天气感知推荐）

可选配置：
- `WEATHER_CITY` — 城市名，默认 `nanchang`

### 3. 启动

```bash
# Windows 一键启动（同时启动 NeteaseCloudMusicApi 和 fenaudio）
start.bat

# 或手动启动
cd NeteaseCloudMusicApiGitee && node app.js   # 终端 1: 网易云 API (端口 3000)
npm run dev                                     # 终端 2: fenaudio (端口 3200)
```

访问 http://localhost:3200

### 4. 登录网易云

启动后在页面侧边栏底部点击 **"登录网易云"**，用网易云音乐 App 扫码登录。

登录后自动获得：
- VIP 歌曲完整播放（需账号有 VIP）
- 个性推荐、私人 FM、每日推荐
- Cookie 自动刷新，无需手动维护

其他管理命令：`stop.bat`（停止）/ `restart.bat`（重启）

## 使用

- **聊天点歌**：在聊天窗口告诉小芬你的需求，如"推荐适合雨天的歌"、"来点轻松的爵士"
- **电台模式**：点击聊天区的"电台"按钮，AI 自动编排歌单并语音播报
- **语音模式**：开启"语音"按钮，小芬会在切歌时用语音介绍下一首歌
- **悬浮窗**：点击侧边栏右上角图标，切换到迷你播放器模式

## 项目结构

```
fenaudio/
├── server/
│   ├── index.js          # Express 入口，注册路由，Cookie 定时刷新
│   ├── config.js          # 环境变量加载
│   ├── db/database.js     # SQLite schema + prepared statements
│   ├── routes/
│   │   ├── auth.js        # 扫码登录、登录状态、Cookie 管理
│   │   ├── music.js       # 搜索、播放、音频代理、历史、用户画像
│   │   ├── chat.js        # AI 对话、TTS、电台模式、天气
│   │   └── playlist.js    # 歌单导入与管理
│   └── services/
│       ├── ai.js          # DashScope/Qwen LLM，DJ 人设 prompt
│       ├── netease.js     # NeteaseCloudMusicApi 客户端，动态 Cookie
│       ├── tts.js         # CosyVoice TTS，LRU 缓存
│       └── weather.js     # OpenWeather，天气→情绪映射
├── public/
│   ├── index.html         # 单页应用 HTML
│   ├── js/
│   │   ├── app.js         # 主控制器：侧边栏、搜索、歌单、登录
│   │   ├── player.js      # 播放器：播放/暂停/歌词/可视化/电台模式
│   │   ├── chat.js        # 聊天 UI：AI 对话、语音、歌曲卡片
│   │   └── particles.js   # Canvas 粒子背景
│   └── css/style.css      # 全局样式
├── NeteaseCloudMusicApiGitee/  # 网易云音乐 API 服务 (端口 3000)
└── data/fenaudio.db            # SQLite 数据库
```

## API 端点

| 路径 | 说明 |
|------|------|
| `GET /api/music/search?keyword=` | 搜索歌曲 |
| `GET /api/music/song/:id` | 获取歌曲详情和播放地址 |
| `GET /api/music/recommend` | 推荐歌单 |
| `GET /api/music/fm` | 私人 FM |
| `GET /api/music/recommend/songs` | 每日推荐 |
| `POST /api/chat/send` | AI 对话 |
| `POST /api/chat/tts` | 文字转语音 |
| `POST /api/chat/radio/start` | 启动电台模式 |
| `POST /api/chat/radio/comment` | 生成 DJ 串场词 |
| `POST /api/playlist/import/:id` | 导入网易云歌单 |
| `GET /api/auth/qr/key` | 获取扫码登录 key |
| `GET /api/auth/qr/check` | 检查扫码状态 |
| `GET /api/auth/status` | 当前登录状态 |

## 注意事项

- AI 对话和 TTS 会消耗 DashScope API 额度，请在阿里云控制台关注用量
- `start.bat` 会同时启动 NeteaseCloudMusicApi (端口 3000) 和 fenaudio (端口 3200)，两个服务缺一不可
- 数据库文件在 `data/` 目录下，已在 `.gitignore` 中排除

## License

MIT

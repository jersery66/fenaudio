# 🎵 fenaudio - 个性化 AI 电台

**fenaudio** 是一款基于个人音乐品味的智能音乐陪伴助手。它不仅仅是一个播放器，更是一位懂你的 AI DJ —— **小芬**。

小芬会根据你的心情、天气、时段和听歌历史，为你推荐合适的音乐，并像电台主持一样为你讲解歌曲背后的故事，带给你有温度的聆听体验。


## ✨ 核心特性

- **🤖 智能 AI DJ (小芬)**：基于通义千问大模型，为你提供专业、温暖的音乐推荐和情感陪伴。
- **📻 电台模式**：一键开启电台模式，AI 会自动为你生成播报内容，并无缝串联起符合当下氛围的歌单。
- **🎙️ 语音播报**：集成阿里云 CosyVoice 语音合成技术，让 AI DJ 拥有自然动听的声音。
- **🎵 网易云集成**：深度集成网易云音乐 API，支持搜索、歌单导入、无损音质播放及歌词显示。
- **🌈 极简审美 UI**：现代化深色模式设计，配备动态粒子背景、音频可视化效果以及流畅的交互动画。
- **📱 响应式体验**：支持悬浮窗模式，让你在工作时也能轻松控制音乐。

## 🛠️ 技术栈

- **前端**：Vanilla JS, CSS3, HTML5, Canvas (音频可视化/粒子效果)
- **后端**：Node.js, Express
- **数据库**：Better-SQLite3
- **AI 引擎**：阿里云 DashScope (通义千问)
- **语音合成**：阿里云 CosyVoice
- **音乐数据**：NeteaseCloudMusicApi

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/jersery66/fenaudio.git
cd fenaudio
```

### 2. 安装依赖
```bash
npm install
cd NeteaseCloudMusicApiGitee
npm install
cd ..
```

### 3. 配置环境变量
将根目录下的 `.env.example` 重命名为 `.env`，并填入你的配置：

```env
# 网易云 Cookie (用于 VIP 歌曲播放)
NETEASE_COOKIE=你的网易云Cookie

# 阿里云 DashScope API (AI DJ 核心)
AI_API_KEY=你的DashScope密钥
DASHSCOPE_API_KEY=你的DashScope密钥 (用于语音合成)

# 天气 API (用于根据天气推荐)
WEATHER_API_KEY=你的OpenWeather密钥
```

### 4. 启动服务
你可以直接双击运行根目录下的 `start.bat`，或者在终端执行：
```bash
npm start
```
服务启动后，访问 [http://localhost:3200](http://localhost:3200) 即可开始使用。

## 💡 使用小技巧

- **对话推荐**：在聊天窗口告诉小芬“我有点累了，想听点治愈的歌”，她会为你量身定制歌单。
- **语音设置**：开启“语音”按钮，小芬会在切歌时通过语音为你介绍下一曲。
- **悬浮窗**：点击右上角的图标切换到悬浮窗模式，将其拖动到屏幕边缘，工作听歌两不误。

## ⚠️ 注意事项

- **VIP 歌曲**：由于网易云限制，播放 VIP 歌曲需要在 `.env` 中配置有效的 `MUSIC_U` Cookie。
- **API 额度**：AI 聊天和语音播报会消耗大模型 API 额度，请注意在阿里云控制台查看余额。

---

希望 **fenaudio** 能陪伴你度过每一个美好的音乐时光！如果有任何问题或建议，欢迎提交 Issue 或 Pull Request。

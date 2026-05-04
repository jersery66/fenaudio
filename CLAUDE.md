# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

fenaudio is a personalized AI radio station. An AI DJ named "Xiao Fen" (小芬) recommends music, generates radio commentary, and provides voice broadcasts — informed by listening history, weather, and time of day. Built on NeteaseCloudMusic with Alibaba DashScope/Qwen for AI and CosyVoice for TTS.

## Running the Project

Two processes must run simultaneously:

```bash
# Terminal 1: NeteaseCloudMusicApi (port 3000)
cd NeteaseCloudMusicApiGitee && node app.js

# Terminal 2: fenaudio server (port 3200)
npm run dev          # auto-restart on changes (node --watch)
npm start            # production mode
```

Windows shortcut: `start.bat` launches both. `stop.bat` / `restart.bat` for lifecycle.

Install deps in both `npm install` and `cd NeteaseCloudMusicApiGitee && npm install`.

No build step — frontend is served as raw static files. No test suite or linter configured.

## Architecture

**Backend** (`server/`): Express app on port 3200 with four route groups:
- `/api/music` — search, playback, audio proxy, history, user profile (delegates to NeteaseCloudMusicApi on port 3000)
- `/api/chat` — AI DJ conversation, TTS synthesis, radio mode, weather context
- `/api/playlist` — import and manage Netease playlists
- `/api/auth` — QR code login, login status, cookie management

**Service layer** (`server/services/`): `ai.js` (DashScope/Qwen LLM), `netease.js` (NeteaseCloudMusicApi HTTP client), `tts.js` (CosyVoice with LRU cache), `weather.js` (OpenWeather with mood mapping).

**Database** (`server/db/database.js`): SQLite via better-sqlite3, WAL mode. Tables: `tracks`, `playlists`, `playlist_tracks`, `play_history`, `chat_messages`, `user_preferences`. All access through exported prepared statements (`stmts`).

**Frontend** (`public/`): Vanilla JS SPA, no framework, no bundler. Four classes loaded via script tags:
- `FenaudioApp` (app.js) — main controller, sidebar, search, playlist management
- `Player` (player.js) — audio playback, visualizer, lyrics, radio mode with TTS overlay
- `ChatService` (chat.js) — AI chat UI, song card rendering from `【SONG】{...}【/SONG】` tags
- `ParticleSystem` (particles.js) — canvas particle background, audio-reactive

**Configuration** (`server/config.js`): Loads `.env` via dotenv. See `.env.example` for all variables. Key defaults: port 3200, AI model `qwen-plus`, TTS model `cosyvoice-v3-flash`.

## Key Patterns

- Audio streams are proxied through `/api/music/proxy` to handle CORS and Netease auth headers
- AI responses embed song recommendations as `【SONG】{"id":123,"name":"...","artist":"..."}【/SONG】` — parsed client-side to render clickable cards
- Song URL resolution tries quality tiers: exhigh → higher → standard
- TTS uses an LRU cache (max 50 entries) to avoid re-synthesizing identical text
- Radio mode ducks music volume to 15% during TTS speech playback
- VIP songs require a valid Netease cookie — obtained via QR login in the UI, stored in `user_preferences` DB table, auto-refreshed every 30 minutes

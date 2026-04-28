const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const dataDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(config.DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    netease_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    artist TEXT,
    album TEXT,
    duration INTEGER,
    pic_url TEXT,
    url TEXT,
    tags TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    netease_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    cover_url TEXT,
    track_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id INTEGER,
    track_id INTEGER,
    position INTEGER,
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id),
    FOREIGN KEY (track_id) REFERENCES tracks(id)
  );

  CREATE TABLE IF NOT EXISTS play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    play_duration INTEGER DEFAULT 0,
    FOREIGN KEY (track_id) REFERENCES tracks(id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

const stmts = {
  upsertTrack: db.prepare(`
    INSERT INTO tracks (netease_id, name, artist, album, duration, pic_url, url, tags)
    VALUES (@netease_id, @name, @artist, @album, @duration, @pic_url, @url, @tags)
    ON CONFLICT(netease_id) DO UPDATE SET
      name = @name, artist = @artist, album = @album,
      duration = @duration, pic_url = @pic_url, url = @url, tags = @tags
  `),

  getTrackByNeteaseId: db.prepare('SELECT * FROM tracks WHERE netease_id = ?'),

  getAllTracks: db.prepare('SELECT * FROM tracks ORDER BY created_at DESC'),

  upsertPlaylist: db.prepare(`
    INSERT INTO playlists (netease_id, name, description, cover_url, track_count)
    VALUES (@netease_id, @name, @description, @cover_url, @track_count)
    ON CONFLICT(netease_id) DO UPDATE SET
      name = @name, description = @description,
      cover_url = @cover_url, track_count = @track_count
  `),

  addPlaylistTrack: db.prepare(`
    INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position)
    VALUES (?, ?, ?)
  `),

  getPlaylistTracks: db.prepare(`
    SELECT t.* FROM tracks t
    JOIN playlist_tracks pt ON t.id = pt.track_id
    WHERE pt.playlist_id = ?
    ORDER BY pt.position
  `),

  getAllPlaylists: db.prepare('SELECT * FROM playlists ORDER BY created_at DESC'),

  addPlayHistory: db.prepare(`
    INSERT INTO play_history (track_id, play_duration) VALUES (?, ?)
  `),

  getRecentHistory: db.prepare(`
    SELECT t.*, ph.played_at, ph.play_duration FROM play_history ph
    JOIN tracks t ON t.id = ph.track_id
    ORDER BY ph.played_at DESC LIMIT ?
  `),

  addChatMessage: db.prepare(`
    INSERT INTO chat_messages (role, content) VALUES (?, ?)
  `),

  getChatHistory: db.prepare(`
    SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT ?
  `),

  setPreference: db.prepare(`
    INSERT INTO user_preferences (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = ?
  `),

  getPreference: db.prepare('SELECT value FROM user_preferences WHERE key = ?'),

  searchTracks: db.prepare(`
    SELECT * FROM tracks WHERE name LIKE ? OR artist LIKE ? OR album LIKE ? LIMIT ?
  `),

  getTrackById: db.prepare('SELECT * FROM tracks WHERE id = ?'),
};

module.exports = { db, stmts };

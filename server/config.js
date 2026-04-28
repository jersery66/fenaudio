require('dotenv').config();
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

module.exports = {
  PORT: process.env.PORT || 3200,
  NETEASE_API_BASE: process.env.NETEASE_API_BASE || 'http://localhost:3000',
  NETEASE_COOKIE: process.env.NETEASE_COOKIE || '',
  AI_API_BASE: process.env.AI_API_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  AI_API_KEY: process.env.AI_API_KEY || '',
  AI_MODEL: process.env.AI_MODEL || 'qwen-plus',
  WEATHER_API_KEY: process.env.WEATHER_API_KEY || '',
  WEATHER_CITY: process.env.WEATHER_CITY || 'nanchang',
  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY || process.env.AI_API_KEY || '',
  TTS_MODEL: process.env.TTS_MODEL || 'cosyvoice-v3-flash',
  TTS_VOICE: process.env.TTS_VOICE || 'longanyang',
  DB_PATH: path.join(ROOT_DIR, 'data', 'fenaudio.db'),
  PUBLIC_DIR: path.join(ROOT_DIR, 'public'),
};

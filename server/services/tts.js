const fetch = require('node-fetch');
const config = require('../config');

class TTSService {
  constructor() {
    this.apiKey = config.DASHSCOPE_API_KEY || config.AI_API_KEY;
    this.model = config.TTS_MODEL || 'cosyvoice-v3-flash';
    this.voice = config.TTS_VOICE || 'longanyang';
    this._cache = new Map();
  }

  async synthesize(text) {
    if (!this.apiKey) {
      console.error('TTS: No API key configured');
      return null;
    }

    const trimmed = text.substring(0, 300).trim();
    if (trimmed.length < 2) {
      console.error('TTS: text too short');
      return null;
    }

    const cacheKey = `${this.model}:${this.voice}:${trimmed}`;
    if (this._cache.has(cacheKey)) {
      console.log('TTS: cache hit');
      return this._cache.get(cacheKey);
    }

    console.log(`TTS: synthesizing ${trimmed.length} chars`);

    const result = await this._callSpeechSynthesizer(this.apiKey, trimmed, this.model, this.voice);
    if (result) {
      if (this._cache.size > 50) {
        const firstKey = this._cache.keys().next().value;
        this._cache.delete(firstKey);
      }
      this._cache.set(cacheKey, result);
      return result;
    }

    if (this.model !== 'cosyvoice-v3-flash') {
      console.log('TTS: trying fallback model cosyvoice-v3-flash');
      const fallback = await this._callSpeechSynthesizer(this.apiKey, trimmed, 'cosyvoice-v3-flash', 'longanyang');
      if (fallback) return fallback;
    }

    return null;
  }

  async _callSpeechSynthesizer(apiKey, text, model, voice) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch('https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          input: {
            text: text,
            voice: voice,
            format: 'mp3',
            sample_rate: 22050,
            rate: 1.0,
            pitch: 1.0,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const contentType = res.headers.get('content-type') || '';

      if (!res.ok) {
        let errMsg = `status=${res.status}`;
        try {
          const data = await res.json();
          errMsg = `${data.code || res.status} - ${data.message || ''}`;
        } catch (e) {}
        console.error(`TTS error: ${errMsg}`);
        return null;
      }

      if (contentType.includes('audio/') || contentType.includes('octet-stream')) {
        const buffer = await res.buffer();
        if (buffer.length > 100) {
          console.log(`TTS audio: ${buffer.length} bytes`);
          return buffer;
        }
        console.error(`TTS audio too small: ${buffer.length} bytes`);
        return null;
      }

      const buffer = await res.buffer();

      if (buffer.length > 1000 && !contentType.includes('json')) {
        console.log(`TTS raw audio: ${buffer.length} bytes`);
        return buffer;
      }

      const bodyText = buffer.toString('utf8');

      try {
        const data = JSON.parse(bodyText);

        if (data.code && data.code !== 'ok' && data.code !== 'success') {
          console.error(`TTS ${model}: ${data.code} - ${data.message || ''}`);
          return null;
        }

        if (data.output?.audio) {
          const audioInfo = data.output.audio;
          const audioUrl = typeof audioInfo === 'string' ? audioInfo : audioInfo.url;
          if (audioUrl) {
            const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(15000) });
            const audioBuffer = await audioRes.buffer();
            if (audioBuffer.length > 100) {
              console.log(`TTS audio url: ${audioBuffer.length} bytes`);
              return audioBuffer;
            }
          }
          if (audioInfo.data) {
            const audioBuffer = Buffer.from(audioInfo.data, 'base64');
            if (audioBuffer.length > 100) {
              console.log(`TTS base64: ${audioBuffer.length} bytes`);
              return audioBuffer;
            }
          }
        }

        console.error('TTS unexpected response:', bodyText.substring(0, 200));
        return null;
      } catch (jsonErr) {
        if (buffer.length > 1000) {
          console.log(`TTS fallback buffer: ${buffer.length} bytes`);
          return buffer;
        }
        console.error(`TTS cannot parse: len=${buffer.length}, content-type=${contentType}`);
        return null;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error(`TTS ${model} timeout (30s)`);
      } else {
        console.error(`TTS ${model} error:`, err.message);
      }
      return null;
    }
  }
}

module.exports = new TTSService();

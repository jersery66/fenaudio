const express = require('express');
const router = express.Router();
const netease = require('../services/netease');

router.get('/qr/key', async (req, res) => {
  try {
    const data = await netease.request('/login/qr/key', { timestamp: Date.now() });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/qr/create', async (req, res) => {
  try {
    const { key, qrimg } = req.query;
    if (!key) return res.status(400).json({ error: '请提供 key 参数' });
    const data = await netease.request('/login/qr/create', {
      key,
      qrimg: qrimg || 'true',
      timestamp: Date.now(),
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/qr/check', async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: '请提供 key 参数' });
    const data = await netease.request('/login/qr/check', {
      key,
      timestamp: Date.now(),
    });

    if (data.code === 803) {
      const cookie = data.cookie;
      if (cookie) {
        netease.updateCookie(cookie);
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const status = await netease.getLoginStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
  netease.updateCookie('');
  res.json({ success: true });
});

module.exports = router;

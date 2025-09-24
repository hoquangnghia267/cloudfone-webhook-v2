const express = require('express');
const fs = require('fs');
const path = require('path');
const { LOG_FILE } = require('../config/config');
const router = express.Router();

router.get('/report-range', (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Thiếu tham số from hoặc to (YYYY-MM-DD)' });
  }

  let logs = [];
  if (fs.existsSync(LOG_FILE)) {
    try {
      logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    } catch (err) {
      return res.status(500).json({ error: 'Lỗi đọc logs.json' });
    }
  }

  const fromTime = new Date(from + 'T00:00:00').getTime();
  const toTime = new Date(to + 'T23:59:59').getTime();

  const filtered = logs.filter(c => {
    const callTime = new Date(c.time).getTime();
    return callTime >= fromTime && callTime <= toTime;
  });

  const answered = filtered.filter(c => /đã trả lời/i.test(c.status)).length;
  const notAnswered = filtered.filter(c =>
    /(không bắt máy|cuộc gọi nhỡ)/i.test(c.status)
  ).length;
  const noPickUp = filtered.filter(c => /không nhấc máy/i.test(c.note || '')).length;
  const calledBack = filtered.filter(c => /liên hệ lại/i.test(c.note || '')).length;

  const total = filtered.length;
  const ratio = total > 0 ? Math.round((answered / total) * 100) : 0;

  res.json({
    from,
    to,
    total,
    answered,
    notAnswered,
    ratio,
    noPickUp,
    calledBack
  });
});

module.exports = router;
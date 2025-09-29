const express = require('express');
const CallEvent = require('../models/callEvent');
const router = express.Router();

router.get('/report-range', async (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Thiếu tham số from hoặc to (YYYY-MM-DD)' });
  }

  const fromTime = new Date(from + 'T00:00:00');
  const toTime = new Date(to + 'T23:59:59');

  try {
    const logs = await CallEvent.find({
      time: { $gte: fromTime, $lte: toTime }
    });

    const answered = logs.filter(c => /đã trả lời/i.test(c.status)).length;
    const notAnswered = logs.filter(c =>
      /(không bắt máy|cuộc gọi nhỡ)/i.test(c.status)
    ).length;
    const noPickUp = logs.filter(c => /không nhấc máy/i.test(c.note || '')).length;
    const calledBack = logs.filter(c => /liên hệ lại/i.test(c.note || '')).length;

    const total = logs.length;
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
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi đọc dữ liệu từ MongoDB' });
  }
});

module.exports = router;
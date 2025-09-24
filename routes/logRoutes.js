const express = require('express');
const { getCallStatus } = require('../utils/callStatus');
const { saveLogs, getCallEvents, calcTotalDuration } = require('../utils/logUtils');
const router = express.Router();

router.get('/logs', (req, res) => {
  res.json(getCallEvents());
});

router.post('/mark-handled', (req, res) => {
  const { cid, ext, time, note } = req.body;
  const callEvents = getCallEvents();
  const idx = callEvents.findIndex(
    e => e.cid === cid && e.ext === ext && e.time === time
  );

  if (idx !== -1) {
    callEvents[idx].handled = true;
    callEvents[idx].note = note || '';
    saveLogs((err) => {
      if (err) return res.json({ success: false });
      console.log(`📝 Đánh dấu đã xử lý: ${cid} - ${ext} - ${time} (Ghi chú: ${note || 'Không có'})`);
      res.json({ success: true });
    });
  } else {
    res.json({ success: false, message: 'Không tìm thấy bản ghi' });
  }
});

router.post('/cloudfone-webhook', (req, res) => {
  const event = req.body;
  console.log('📞 Nhận sự kiện CloudFone:', event);

  const newStatus = getCallStatus(event);
  const parseDate = s => s ? new Date(s) : null;
  const timeEnd = parseDate(event.TimeEnd);
  const timeAnswer = parseDate(event.TimeAnswer);
  const timeCall = parseDate(event.TimeCall);

  let duration = 0;
  if (event.Duration && !isNaN(event.Duration)) {
    duration = parseInt(event.Duration, 10);
  } else if (timeEnd && timeAnswer) {
    duration = Math.floor((timeEnd - timeAnswer) / 1000);
  } else if (timeEnd && timeCall) {
    duration = Math.floor((timeEnd - timeCall) / 1000);
  }
  if (duration < 0) duration = 0;

  const callData = {
    cid: event.CID || 'Không rõ',
    ext: event.Ext || 'N/A',
    did: event.DID || '',
    dir: event.Dir || '',
    time: event.TimeCall || new Date().toISOString(),
    status: newStatus,
    duration,
    ivr: event.IVR || '',
    queue: event.Queue || '',
    billBy: event.BillSecBy || ''
  };

  const callEvents = getCallEvents();
  const idx = callEvents.findIndex(e =>
    e.cid === callData.cid &&
    e.ext === callData.ext &&
    e.time === callData.time
  );

  if (idx !== -1) {
    callEvents[idx] = {
      ...callEvents[idx],
      ...callData,
      status: (newStatus !== '❔ Không rõ') ? newStatus : callEvents[idx].status
    };
  } else {
    callEvents.push({
      ...callData,
      handled: false,
      note: ''
    });
  }

  saveLogs((err) => {
    if (!err) {
      const io = require('socket.io').sockets;
      io.emit('call-event', callData);
      io.emit('total-duration', calcTotalDuration());
    }
  });

  switch (event.Event) {
    case 'show':
      console.log('👉 Cuộc gọi đến - show popup:', event.CID);
      break;
    case 'hide':
      console.log('🙈 Ẩn popup. Lý do:', event.Disposition);
      break;
    case 'answer':
      console.log('✅ Trả lời cuộc gọi tại máy nhánh:', event.Ext);
      break;
    case 'finish':
      console.log('📴 Kết thúc cuộc gọi. File ghi âm:', event.recordingfileURL);
      console.log(`⏱ Thời lượng: ${callData.duration} giây`);
      break;
    default:
      console.log('⚠️ Sự kiện không xác định:', event.Event);
  }

  res.status(200).send('OK');
});

module.exports = router;
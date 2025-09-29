const CallEvent = require('../models/callEvent');

let callEvents = [];

async function initLogs() {
  try {
    callEvents = await CallEvent.find().sort({ time: -1 });
    console.log(`📁 Đã nạp ${callEvents.length} log từ MongoDB`);
  } catch (err) {
    console.error('❌ Lỗi đọc từ MongoDB:', err);
    callEvents = [];
  }
}

function calcTotalDuration() {
  return callEvents.reduce((sum, call) => sum + (call.duration || 0), 0);
}

async function saveLogs(callData) {
  try {
    const existing = await CallEvent.findOne({ cid: callData.cid, ext: callData.ext, time: callData.time });

    if (existing) {
      const newStatus = callData.status !== '❔ Không rõ' ? callData.status : existing.status;
      await CallEvent.updateOne(
        { _id: existing._id },
        { $set: { ...callData, status: newStatus } }
      );
      callEvents = callEvents.map(e => (e.cid === callData.cid && e.ext === callData.ext && e.time === callData.time ? { ...e, ...callData, status: newStatus } : e));
    } else {
      const newEvent = new CallEvent(callData);
      await newEvent.save();
      callEvents.push(callData);
    }

    console.log(`💾 Đã lưu bản ghi vào MongoDB`);
  } catch (err) {
    console.error('❌ Lỗi lưu vào MongoDB:', err);
  }
}

async function updateHandled(cid, ext, time, note) {
  try {
    const result = await CallEvent.updateOne(
      { cid, ext, time },
      { $set: { handled: true, note: note || '' } }
    );
    if (result.matchedCount > 0) {
      callEvents = callEvents.map(e => (e.cid === cid && e.ext === ext && e.time === time ? { ...e, handled: true, note: note || '' } : e));
      return true;
    }
    return false;
  } catch (err) {
    console.error('❌ Lỗi cập nhật handled:', err);
    return false;
  }
}

function initSocket(io) {
  io.on('connection', async (socket) => {
    console.log('🟢 Trình duyệt kết nối:', socket.id);
    const events = await getCallEvents();
    socket.emit('init-log', events);
    socket.emit('total-duration', calcTotalDuration());
  });
}

async function getCallEvents() {
  if (callEvents.length === 0) {
    await initLogs();
  }
  return callEvents;
}

module.exports = { saveLogs, getCallEvents, calcTotalDuration, initSocket, initLogs, updateHandled };
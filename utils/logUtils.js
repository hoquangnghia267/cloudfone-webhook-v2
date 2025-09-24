const fs = require('fs');
const { LOG_FILE } = require('../config/config');

let callEvents = [];

if (fs.existsSync(LOG_FILE)) {
  try {
    const data = fs.readFileSync(LOG_FILE, 'utf-8');
    callEvents = JSON.parse(data);
    console.log(`📁 Đã nạp ${callEvents.length} log từ file logs.json`);
  } catch (err) {
    console.error('❌ Lỗi đọc logs.json:', err);
    callEvents = [];
  }
}

function calcTotalDuration() {
  return callEvents.reduce((sum, call) => sum + (call.duration || 0), 0);
}

function saveLogs(callback) {
  fs.writeFile(LOG_FILE, JSON.stringify(callEvents, null, 2), (err) => {
    if (err) {
      console.error('❌ Ghi file log thất bại:', err);
      if (callback) callback(err);
    } else {
      console.log(`💾 Đã lưu ${callEvents.length} bản ghi vào logs.json`);
      if (callback) callback(null);
    }
  });
}

function initSocket(io) {
  io.on('connection', (socket) => {
    console.log('🟢 Trình duyệt kết nối:', socket.id);
    socket.emit('init-log', callEvents);
    socket.emit('total-duration', calcTotalDuration());
  });
}

function getCallEvents() {
  return callEvents;
}

module.exports = { saveLogs, getCallEvents, calcTotalDuration, initSocket };
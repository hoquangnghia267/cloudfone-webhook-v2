const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { MONGO_URI } = require('./config/config');
const CallEvent = require('./models/callEvent');

async function importLogs() {
  try {
    // Kết nối MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Kết nối MongoDB thành công');

    // Đọc file logs.json
    const logFilePath = path.join(__dirname, 'logs.json');
    const data = fs.readFileSync(logFilePath, 'utf-8');
    const logs = JSON.parse(data);

    // Insert dữ liệu vào MongoDB
    const result = await CallEvent.insertMany(logs);
    console.log(`💾 Đã import ${result.length} bản ghi từ logs.json vào MongoDB`);

    // Đóng kết nối
    await mongoose.disconnect();
    console.log('✅ Đóng kết nối MongoDB');
  } catch (err) {
    console.error('❌ Lỗi import dữ liệu:', err);
  }
}

importLogs();
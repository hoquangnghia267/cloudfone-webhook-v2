const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const socketIo = require('socket.io');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const { PORT, SESSION_SECRET, MONGO_URI } = require('./config/config');
const authMiddleware = require('./middleware/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const logRoutes = require('./routes/logRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { initSocket, initLogs } = require('./utils/logUtils');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Kết nối MongoDB
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Kết nối MongoDB thành công');
    initLogs();
  })
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// Cấu hình session
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Đặt secure: true nếu dùng HTTPS
}));

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Áp dụng middleware xác thực, bỏ qua cho /cloudfone-webhook và /login
app.use((req, res, next) => {
  if (req.path === '/cloudfone-webhook' || req.path === '/login') {
    return next();
  }
  return authMiddleware(req, res, next);
});

// Routes
app.use(authRoutes);
app.use(logRoutes);
app.use(reportRoutes);

// Khởi tạo Socket.IO
initSocket(io);

// Khởi động server
server.listen(PORT, () => {
  console.log(`✅ Server chạy tại http://10.0.0.26:${PORT}/cloudfone-webhook`);
});
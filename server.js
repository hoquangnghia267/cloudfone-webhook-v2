const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const socketIo = require('socket.io');
const session = require('express-session');
const { PORT, SESSION_SECRET } = require('./config/config');
const authMiddleware = require('./middleware/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const logRoutes = require('./routes/logRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { initSocket } = require('./utils/logUtils');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Cấu hình session
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Đặt secure: true nếu dùng HTTPS
}));

// Middleware
app.use(bodyParser.json());
app.use(express.static('public')); // Phục vụ tài nguyên tĩnh từ public

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
  console.log(`✅ Server chạy tại http://localhost:${PORT}/cloudfone-webhook`);
});
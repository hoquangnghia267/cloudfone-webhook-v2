const express = require('express');
const path = require('path');
const { USERS } = require('../config/config');
const router = express.Router();

// Route cho login
router.get('/login', (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../views', 'login.html'));
});

// Route cho logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Xử lý đăng nhập
router.post('/login', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'No credentials provided' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  if (USERS[username] && USERS[username] === password) {
    req.session.isAuthenticated = true;
    return res.json({ success: true });
  }

  return res.status(401).json({ success: false, message: 'Invalid credentials' });
});

// Route cho các file HTML khác
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

router.get('/statistic', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'statistic.html'));
});

router.get('/all', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'all.html'));
});

router.get('/baocao', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'baocao.html'));
});

router.get('/baocaoall', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'baocaoall.html'));
});

module.exports = router;
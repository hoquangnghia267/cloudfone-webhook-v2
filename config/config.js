module.exports = {
  PORT: 2802,
  SESSION_SECRET: 'your-secret-key', // Thay bằng chuỗi bí mật mạnh hơn
  LOG_FILE: require('path').join(__dirname, '../logs.json'),
  USERS: {
    admin: 'Vina@,2025',
    luan: 'hcm,1234'
  }
};
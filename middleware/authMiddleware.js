const { USERS } = require('../config/config');

function authMiddleware(req, res, next) {
  if (req.session.isAuthenticated) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader && req.path !== '/login') {
    return res.redirect('/login');
  }

  if (authHeader) {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    if (USERS[username] && USERS[username] === password) {
      req.session.isAuthenticated = true;
      return next();
    }
  }

  if (req.path === '/login') {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
  return res.redirect('/login');
}

module.exports = authMiddleware;
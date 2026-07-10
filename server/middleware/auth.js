const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'two-point-chat-secret-key-2026';

// 生成 Token
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

// JWT 认证中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

module.exports = { authMiddleware, generateToken, JWT_SECRET };

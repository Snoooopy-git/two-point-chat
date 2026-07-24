const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const WEAK_SECRET_PATTERN = /(change|default|example|please|secret-key|replace)/i;

function isWeakJwtSecret(secret) {
  return typeof secret !== 'string'
    || secret.length < 32
    || WEAK_SECRET_PATTERN.test(secret);
}

function resolveJwtSecret(env = process.env) {
  const configuredSecret = env.JWT_SECRET;
  if (env.NODE_ENV === 'production') {
    if (isWeakJwtSecret(configuredSecret)) {
      throw new Error('生产环境 JWT_SECRET 必须显式设置为至少 32 位的高强度随机值');
    }
    return configuredSecret;
  }

  return configuredSecret || crypto.randomBytes(32).toString('hex');
}

const JWT_SECRET = resolveJwtSecret();

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
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

module.exports = {
  authMiddleware,
  generateToken,
  isWeakJwtSecret,
  resolveJwtSecret,
  JWT_SECRET
};

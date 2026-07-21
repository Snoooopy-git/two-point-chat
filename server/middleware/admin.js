const db = require('../db');

// 管理员权限中间件 — 必须在 authMiddleware 之后使用
function adminMiddleware(req, res, next) {
  try {
    const user = db.prepare('SELECT role, status FROM users WHERE id = ?').get(req.userId);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: '账号已被禁用' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
  } catch (err) {
    console.error('管理员验证错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
}

module.exports = { adminMiddleware };

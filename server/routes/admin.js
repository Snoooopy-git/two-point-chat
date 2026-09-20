const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/admin');
const { disconnectUser } = require('../socket/chat');

const router = express.Router();

function isLastActiveAdmin(user) {
  if (user.role !== 'admin' || user.status !== 'active') return false;
  const row = db.prepare(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND status = 'active'"
  ).get();
  return row.count <= 1;
}

// 所有 admin 路由都需要认证 + 管理员权限
router.use(authMiddleware);
router.use(adminMiddleware);

// 1. 获取用户列表
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(
      'SELECT id, username, role, status, created_at FROM users ORDER BY created_at DESC'
    ).all();
    res.json({ users });
  } catch (err) {
    console.error('获取用户列表错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 2. 启用/禁用账号
router.put('/users/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ error: '状态值无效' });
    }

    const user = db.prepare(
      'SELECT id, username, role, status FROM users WHERE id = ?'
    ).get(id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    if (status === 'disabled' && isLastActiveAdmin(user)) {
      return res.status(400).json({ error: '不能禁用最后一个有效管理员' });
    }

    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
    if (status === 'disabled') {
      disconnectUser(req.app.get('io'), user.id);
    }
    res.json({ message: `用户「${user.username}」已${status === 'active' ? '启用' : '禁用'}` });
  } catch (err) {
    console.error('更新用户状态错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 3. 设置/取消管理员
router.put('/users/:id/role', (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: '角色值无效' });
    }

    const user = db.prepare(
      'SELECT id, username, role, status FROM users WHERE id = ?'
    ).get(id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 禁止修改自己的角色（防止误操作把自己降级）
    if (parseInt(id) === req.userId && role === 'user') {
      return res.status(400).json({ error: '不能取消自己的管理员权限' });
    }
    if (role === 'user' && isLastActiveAdmin(user)) {
      return res.status(400).json({ error: '不能取消最后一个有效管理员的权限' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    res.json({ message: `用户「${user.username}」已${role === 'admin' ? '设为' : '取消'}管理员` });
  } catch (err) {
    console.error('更新用户角色错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 4. 删除用户
router.delete('/users/:id', (req, res) => {
  try {
    const { id } = req.params;

    const user = db.prepare(
      'SELECT id, username, role, status FROM users WHERE id = ?'
    ).get(id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 禁止删除自己
    if (parseInt(id) === req.userId) {
      return res.status(400).json({ error: '不能删除自己的账号' });
    }

    // 禁止删除其他管理员
    if (user.role === 'admin') {
      return res.status(400).json({ error: '不能删除管理员账号' });
    }

    // 级联删除：好友申请 + 好友关系 + 消息
    const transaction = db.transaction(() => {
      db.prepare(
        'DELETE FROM friend_requests WHERE requester_id = ? OR recipient_id = ?'
      ).run(id, id);
      db.prepare('DELETE FROM friendships WHERE user_id = ? OR friend_id = ?').run(id, id);
      db.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?').run(id, id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    });
    transaction();
    disconnectUser(req.app.get('io'), user.id, '账号已被删除，请重新登录');

    res.json({ message: `用户「${user.username}」已删除` });
  } catch (err) {
    console.error('删除用户错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 5. 清理用户聊天展示（软删除消息）
router.post('/users/:id/clear-chat', (req, res) => {
  try {
    const { id } = req.params;

    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 软删除该用户的所有消息（标记 deleted=1，数据库保留）
    const result = db.prepare(
      'UPDATE messages SET deleted = 1 WHERE sender_id = ? OR receiver_id = ?'
    ).run(id, id);

    res.json({ message: `用户「${user.username}」的聊天记录已清理（${result.changes} 条消息已隐藏）` });
  } catch (err) {
    console.error('清理聊天记录错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;

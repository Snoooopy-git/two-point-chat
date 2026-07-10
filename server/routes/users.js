const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 搜索用户
router.get('/search', authMiddleware, (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.json({ users: [] });
    }

    const users = db.prepare(
      'SELECT id, username, avatar FROM users WHERE username LIKE ? AND id != ? LIMIT 10'
    ).all(`%${q.trim()}%`, req.userId);

    res.json({ users });
  } catch (err) {
    console.error('搜索用户错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 添加好友
router.post('/friends', authMiddleware, (req, res) => {
  try {
    const { friendId } = req.body;
    if (!friendId) {
      return res.status(400).json({ error: '请指定要添加的好友' });
    }
    if (friendId === req.userId) {
      return res.status(400).json({ error: '不能添加自己为好友' });
    }

    // 检查好友是否存在
    const friend = db.prepare('SELECT id, username FROM users WHERE id = ?').get(friendId);
    if (!friend) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 检查是否已经是好友
    const existing = db.prepare(
      'SELECT id FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
    ).get(req.userId, friendId, friendId, req.userId);

    if (existing) {
      return res.status(400).json({ error: '对方已经是你的好友' });
    }

    // 双向添加好友关系
    db.prepare('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)').run(req.userId, friendId);
    db.prepare('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)').run(friendId, req.userId);

    res.status(201).json({ message: '添加好友成功', friend: { id: friend.id, username: friend.username } });
  } catch (err) {
    console.error('添加好友错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取好友列表
router.get('/friends', authMiddleware, (req, res) => {
  try {
    const friends = db.prepare(`
      SELECT u.id, u.username, u.avatar
      FROM friendships f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ?
      ORDER BY u.username
    `).all(req.userId);

    // 获取每个好友的最后一条消息
    const friendsWithLastMsg = friends.map(friend => {
      const lastMsg = db.prepare(`
        SELECT content, type, created_at FROM messages
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at DESC LIMIT 1
      `).get(req.userId, friend.id, friend.id, req.userId);

      return {
        ...friend,
        lastMessage: lastMsg || null
      };
    });

    res.json({ friends: friendsWithLastMsg });
  } catch (err) {
    console.error('获取好友列表错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;

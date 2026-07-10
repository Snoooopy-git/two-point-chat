const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 获取与某好友的历史消息
router.get('/:friendId', authMiddleware, (req, res) => {
  try {
    const { friendId } = req.params;
    // 检查是否为好友关系
    const friendship = db.prepare(
      'SELECT id FROM friendships WHERE user_id = ? AND friend_id = ?'
    ).get(req.userId, friendId);

    if (!friendship) {
      return res.status(403).json({ error: '对方不是你的好友' });
    }

    const messages = db.prepare(`
      SELECT id, sender_id, receiver_id, content, type, file_url, created_at
      FROM messages
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
      LIMIT 200
    `).all(req.userId, friendId, friendId, req.userId);

    res.json({ messages });
  } catch (err) {
    console.error('获取消息错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;

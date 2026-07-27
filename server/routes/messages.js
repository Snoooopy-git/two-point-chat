const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { toUtcIsoTimestamp } = require('../utils/timestamps');

const router = express.Router();

// 获取与某好友的历史消息
router.get('/:friendId', authMiddleware, (req, res) => {
  try {
    const friendId = Number.parseInt(req.params.friendId, 10);
    const before = req.query.before === undefined
      ? null
      : Number.parseInt(req.query.before, 10);
    if (!Number.isInteger(friendId) || friendId <= 0) {
      return res.status(400).json({ error: '好友 ID 无效' });
    }
    if (req.query.before !== undefined && (!Number.isInteger(before) || before <= 0)) {
      return res.status(400).json({ error: '分页游标无效' });
    }
    // 检查是否为好友关系
    const friendship = db.prepare(
      'SELECT id FROM friendships WHERE user_id = ? AND friend_id = ?'
    ).get(req.userId, friendId);

    if (!friendship) {
      return res.status(403).json({ error: '对方不是你的好友' });
    }

    const rows = db.prepare(`
      SELECT id, sender_id, receiver_id, content, type, file_url,
             client_message_id, read, created_at
      FROM messages
      WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
        AND deleted = 0
        AND (? IS NULL OR id < ?)
      ORDER BY id DESC
      LIMIT 201
    `).all(req.userId, friendId, friendId, req.userId, before, before);

    const hasMore = rows.length > 200;
    const messages = rows.slice(0, 200).reverse().map(message => ({
      ...message,
      created_at: toUtcIsoTimestamp(message.created_at)
    }));
    const nextCursor = hasMore ? messages[0].id : null;

    res.json({ messages, nextCursor });
  } catch (err) {
    console.error('获取消息错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取所有好友的未读消息数
router.get('/unread/counts', authMiddleware, (req, res) => {
  try {
    const counts = db.prepare(`
      SELECT sender_id, COUNT(*) as count
      FROM messages
      WHERE receiver_id = ? AND read = 0 AND deleted = 0
      GROUP BY sender_id
    `).all(req.userId);
    res.json({ counts });
  } catch (err) {
    console.error('获取未读数错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 标记来自某好友的消息为已读
router.put('/:friendId/read', authMiddleware, (req, res) => {
  try {
    const { friendId } = req.params;
    db.prepare(`
      UPDATE messages SET read = 1
      WHERE sender_id = ? AND receiver_id = ? AND read = 0 AND deleted = 0
    `).run(friendId, req.userId);
    res.json({ success: true });
  } catch (err) {
    console.error('标记已读错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;

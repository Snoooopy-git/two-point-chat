const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { emitToUser } = require('../socket/chat');
const { areFriends, insertFriendshipPair } = require('../services/friendships');
const { toUtcIsoTimestamp } = require('../utils/timestamps');

const router = express.Router();
const MAX_SEARCH_LENGTH = 50;

function toRequest(row) {
  return {
    id: row.id,
    user: {
      id: row.user_id,
      username: row.username,
      avatar: row.avatar
    },
    created_at: toUtcIsoTimestamp(row.created_at)
  };
}

function findRequest(requestId) {
  return db.prepare(`
    SELECT id, requester_id, recipient_id, created_at
    FROM friend_requests
    WHERE id = ?
  `).get(requestId);
}

router.get('/search', authMiddleware, (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query) {
      return res.json({ users: [] });
    }
    if (query.length > MAX_SEARCH_LENGTH) {
      return res.status(400).json({ error: `搜索关键词不能超过 ${MAX_SEARCH_LENGTH} 个字符` });
    }

    const keyword = query.replace(/[\\%_]/g, match => `\\${match}`);
    const users = db.prepare(`
      SELECT u.id, u.username, u.avatar,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM friendships f
            WHERE f.user_id = ? AND f.friend_id = u.id
          ) THEN 'friend'
          WHEN EXISTS (
            SELECT 1 FROM friend_requests fr
            WHERE fr.requester_id = ? AND fr.recipient_id = u.id
          ) THEN 'outgoing_pending'
          WHEN EXISTS (
            SELECT 1 FROM friend_requests fr
            WHERE fr.requester_id = u.id AND fr.recipient_id = ?
          ) THEN 'incoming_pending'
          ELSE 'none'
        END AS relationship
      FROM users u
      WHERE u.username LIKE ? ESCAPE '\\'
        AND u.id != ?
        AND u.status = 'active'
      ORDER BY u.username
      LIMIT 10
    `).all(req.userId, req.userId, req.userId, `%${keyword}%`, req.userId);

    res.json({ users });
  } catch (err) {
    console.error('搜索用户错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/friend-requests', authMiddleware, (req, res) => {
  try {
    const recipientId = Number.parseInt(req.body.recipientId, 10);
    if (!Number.isInteger(recipientId) || recipientId <= 0) {
      return res.status(400).json({ error: '请指定要添加的用户' });
    }
    if (recipientId === req.userId) {
      return res.status(400).json({ error: '不能添加自己为好友' });
    }

    const recipient = db.prepare(`
      SELECT id, username, avatar FROM users
      WHERE id = ? AND status = 'active'
    `).get(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: '用户不存在或已被禁用' });
    }
    if (areFriends(req.userId, recipientId)) {
      return res.status(409).json({ error: '对方已经是你的好友' });
    }

    const createRequest = db.transaction(() => {
      const reverse = db.prepare(`
        SELECT id FROM friend_requests
        WHERE requester_id = ? AND recipient_id = ?
      `).get(recipientId, req.userId);
      if (reverse) return { conflict: true };

      const existing = db.prepare(`
        SELECT id, created_at FROM friend_requests
        WHERE requester_id = ? AND recipient_id = ?
      `).get(req.userId, recipientId);
      if (existing) return { row: existing, created: false };

      const result = db.prepare(`
        INSERT INTO friend_requests (requester_id, recipient_id)
        VALUES (?, ?)
      `).run(req.userId, recipientId);
      return {
        row: findRequest(Number(result.lastInsertRowid)),
        created: true
      };
    });
    const result = createRequest();
    if (result.conflict) {
      return res.status(409).json({ error: '对方已向你发送申请，请先处理该申请' });
    }

    const requester = db.prepare(
      'SELECT id, username, avatar FROM users WHERE id = ?'
    ).get(req.userId);
    const payload = {
      id: result.row.id,
      user: requester,
      created_at: toUtcIsoTimestamp(result.row.created_at)
    };
    if (result.created) {
      emitToUser(req.app.get('io'), recipientId, 'friend_request_received', payload);
    }

    res.status(result.created ? 201 : 200).json({
      message: result.created ? '好友申请已发送' : '好友申请已在等待处理',
      request: {
        id: result.row.id,
        user: recipient,
        created_at: toUtcIsoTimestamp(result.row.created_at)
      }
    });
  } catch (err) {
    console.error('发送好友申请错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/friend-requests', authMiddleware, (req, res) => {
  try {
    const incoming = db.prepare(`
      SELECT fr.id, fr.created_at, u.id AS user_id, u.username, u.avatar
      FROM friend_requests fr
      JOIN users u ON u.id = fr.requester_id
      WHERE fr.recipient_id = ? AND u.status = 'active'
      ORDER BY fr.id DESC
    `).all(req.userId).map(toRequest);
    const outgoing = db.prepare(`
      SELECT fr.id, fr.created_at, u.id AS user_id, u.username, u.avatar
      FROM friend_requests fr
      JOIN users u ON u.id = fr.recipient_id
      WHERE fr.requester_id = ? AND u.status = 'active'
      ORDER BY fr.id DESC
    `).all(req.userId).map(toRequest);

    res.json({ incoming, outgoing });
  } catch (err) {
    console.error('获取好友申请错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/friend-requests/:id/accept', authMiddleware, (req, res) => {
  try {
    const requestId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ error: '好友申请 ID 无效' });
    }

    const acceptRequest = db.transaction(() => {
      const request = findRequest(requestId);
      if (!request) return { status: 404 };
      if (request.recipient_id !== req.userId) return { status: 403 };

      const requester = db.prepare(`
        SELECT id, username, avatar FROM users
        WHERE id = ? AND status = 'active'
      `).get(request.requester_id);
      if (!requester) return { status: 409 };

      insertFriendshipPair(request.requester_id, request.recipient_id);
      db.prepare(`
        DELETE FROM friend_requests
        WHERE (requester_id = ? AND recipient_id = ?)
           OR (requester_id = ? AND recipient_id = ?)
      `).run(
        request.requester_id,
        request.recipient_id,
        request.recipient_id,
        request.requester_id
      );
      return { status: 200, request, requester };
    });
    const result = acceptRequest();
    if (result.status === 404) return res.status(404).json({ error: '好友申请不存在' });
    if (result.status === 403) return res.status(403).json({ error: '无权处理该好友申请' });
    if (result.status === 409) return res.status(409).json({ error: '申请用户不存在或已被禁用' });

    const recipient = db.prepare(
      'SELECT id, username, avatar FROM users WHERE id = ?'
    ).get(req.userId);
    emitToUser(req.app.get('io'), result.request.requester_id, 'friend_request_resolved', {
      requestId,
      action: 'accepted'
    });
    emitToUser(req.app.get('io'), result.request.requester_id, 'friend_added', {
      friend: recipient
    });
    emitToUser(req.app.get('io'), req.userId, 'friend_added', {
      friend: result.requester
    });

    res.json({ message: '已通过好友申请', friend: result.requester });
  } catch (err) {
    console.error('接受好友申请错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.delete('/friend-requests/:id', authMiddleware, (req, res) => {
  try {
    const requestId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ error: '好友申请 ID 无效' });
    }
    const request = findRequest(requestId);
    if (!request) return res.status(404).json({ error: '好友申请不存在' });
    if (![request.requester_id, request.recipient_id].includes(req.userId)) {
      return res.status(403).json({ error: '无权处理该好友申请' });
    }

    db.prepare('DELETE FROM friend_requests WHERE id = ?').run(requestId);
    const action = req.userId === request.requester_id ? 'cancelled' : 'rejected';
    const otherUserId = action === 'cancelled' ? request.recipient_id : request.requester_id;
    emitToUser(req.app.get('io'), otherUserId, 'friend_request_resolved', {
      requestId,
      action
    });
    res.json({ message: action === 'cancelled' ? '好友申请已取消' : '好友申请已拒绝' });
  } catch (err) {
    console.error('处理好友申请错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/friends', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT u.id, u.username, u.avatar,
             last_message.content AS last_message_content,
             last_message.type AS last_message_type,
             last_message.created_at AS last_message_created_at
      FROM friendships f
      JOIN users u ON u.id = f.friend_id
      LEFT JOIN messages last_message ON last_message.id = (
        SELECT m.id
        FROM messages m
        WHERE ((m.sender_id = ? AND m.receiver_id = u.id)
            OR (m.sender_id = u.id AND m.receiver_id = ?))
          AND m.deleted = 0
        ORDER BY m.id DESC
        LIMIT 1
      )
      WHERE f.user_id = ? AND u.status = 'active'
      ORDER BY u.username
    `).all(req.userId, req.userId, req.userId);
    const friends = rows.map(row => ({
      id: row.id,
      username: row.username,
      avatar: row.avatar,
      lastMessage: row.last_message_created_at ? {
        content: row.last_message_content,
        type: row.last_message_type,
        created_at: toUtcIsoTimestamp(row.last_message_created_at)
      } : null
    }));

    res.json({ friends });
  } catch (err) {
    console.error('获取好友列表错误:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;

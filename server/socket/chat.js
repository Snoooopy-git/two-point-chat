const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, getActiveUser } = require('../middleware/auth');
const { toUtcIsoTimestamp } = require('../utils/timestamps');
const { areFriends } = require('../services/friendships');

const onlineUsers = new Map();
const MAX_TEXT_LENGTH = 5000;
const CLIENT_MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function getUserSockets(userId) {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  return onlineUsers.get(userId);
}

function emitToUser(io, userId, event, payload) {
  const socketIds = onlineUsers.get(userId);
  if (!socketIds) return;
  socketIds.forEach(socketId => io.to(socketId).emit(event, payload));
}

function requireActiveSocketUser(socket) {
  if (getActiveUser(socket.userId)) return true;
  socket.emit('session_revoked', { error: '账号不存在或已被禁用，请重新登录' });
  socket.disconnect(true);
  return false;
}

function normalizeMessage(data) {
  const receiverId = Number.parseInt(data?.to, 10);
  const type = data?.type || 'text';
  const clientMessageId = data?.clientMessageId;
  const content = typeof data?.content === 'string' ? data.content.trim() : '';

  if (!Number.isInteger(receiverId) || receiverId <= 0) {
    throw new Error('接收者无效');
  }
  if (!['text', 'image'].includes(type)) {
    throw new Error('消息类型无效');
  }
  if (!CLIENT_MESSAGE_ID_PATTERN.test(clientMessageId || '')) {
    throw new Error('客户端消息 ID 无效');
  }
  if (!content || content.length > MAX_TEXT_LENGTH) {
    throw new Error(`消息内容必须在 1-${MAX_TEXT_LENGTH} 个字符之间`);
  }
  if (type === 'image' && !/^\/uploads\/[A-Za-z0-9_-]+\.(jpe?g|png|gif|webp|bmp)$/.test(content)) {
    throw new Error('图片地址无效');
  }

  return {
    receiverId,
    type,
    content,
    fileUrl: type === 'image' ? content : null,
    clientMessageId
  };
}

function toSocketMessage(row) {
  return {
    id: row.id,
    from: row.sender_id,
    to: row.receiver_id,
    content: row.content,
    type: row.type,
    fileUrl: row.file_url,
    clientMessageId: row.client_message_id,
    read: row.read,
    timestamp: toUtcIsoTimestamp(row.created_at)
  };
}

function saveMessage(senderId, message) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO messages
      (sender_id, receiver_id, content, type, file_url, client_message_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insert.run(
    senderId,
    message.receiverId,
    message.content,
    message.type,
    message.fileUrl,
    message.clientMessageId
  );

  return db.prepare(`
    SELECT id, sender_id, receiver_id, content, type, file_url,
           client_message_id, read, created_at
    FROM messages
    WHERE sender_id = ? AND client_message_id = ?
  `).get(senderId, message.clientMessageId);
}

function setupChatSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('未登录'));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = getActiveUser(decoded.userId);
      if (!user) {
        return next(new Error('账号不存在或已被禁用'));
      }
      socket.userId = user.id;
      next();
    } catch {
      next(new Error('登录已过期'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    getUserSockets(userId).add(socket.id);

    const onlineFriendIds = db.prepare(`
      SELECT friend_id
      FROM friendships
      WHERE user_id = ?
    `).all(userId)
      .map(row => row.friend_id)
      .filter(friendId => onlineUsers.has(friendId));
    socket.emit('online_users', { userIds: onlineFriendIds });
    notifyFriendsOnlineStatus(io, userId, true);

    socket.on('private_message', (data) => {
      try {
        if (!requireActiveSocketUser(socket)) return;
        const message = normalizeMessage(data);
        if (!areFriends(userId, message.receiverId)) {
          throw new Error('对方不是你的好友');
        }

        const existing = db.prepare(`
          SELECT id FROM messages
          WHERE sender_id = ? AND client_message_id = ?
        `).get(userId, message.clientMessageId);
        const saved = saveMessage(userId, message);
        const messageData = toSocketMessage(saved);

        if (!existing) {
          emitToUser(io, message.receiverId, 'new_message', messageData);
        }
        socket.emit('message_sent', messageData);
      } catch (error) {
        socket.emit('message_error', {
          clientMessageId: data?.clientMessageId,
          error: error.message || '消息发送失败'
        });
      }
    });

    const forwardTyping = (event, data) => {
      if (!requireActiveSocketUser(socket)) return;
      const receiverId = Number.parseInt(data?.to, 10);
      if (!Number.isInteger(receiverId) || !areFriends(userId, receiverId)) return;
      emitToUser(io, receiverId, event, { from: userId });
    };

    socket.on('typing', data => forwardTyping('typing', data));
    socket.on('stop_typing', data => forwardTyping('stop_typing', data));

    socket.on('mark_read', (data) => {
      try {
        if (!requireActiveSocketUser(socket)) return;
        const senderId = Number.parseInt(data?.from, 10);
        if (!Number.isInteger(senderId) || !areFriends(userId, senderId)) return;

        const result = db.prepare(`
          UPDATE messages SET read = 1
          WHERE sender_id = ? AND receiver_id = ? AND read = 0 AND deleted = 0
        `).run(senderId, userId);
        // 已读回执属于原发送方，必须投递给他而不是读取方自己
        if (result.changes > 0) {
          emitToUser(io, senderId, 'messages_read', {
            from: userId,
            count: result.changes
          });
        }
      } catch (error) {
        console.error('标记已读错误:', error);
      }
    });

    socket.on('disconnect', () => {
      const userSockets = onlineUsers.get(userId);
      if (!userSockets) return;
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);
        notifyFriendsOnlineStatus(io, userId, false);
      }
    });
  });
}

function notifyFriendsOnlineStatus(io, userId, isOnline) {
  try {
    const friends = db.prepare(
      'SELECT friend_id FROM friendships WHERE user_id = ?'
    ).all(userId);
    friends.forEach(friend => {
      emitToUser(
        io,
        friend.friend_id,
        isOnline ? 'friend_online' : 'friend_offline',
        { userId }
      );
    });
  } catch (error) {
    console.error('通知在线状态错误:', error);
  }
}

function disconnectUser(io, userId, reason = '账号状态已变更，请重新登录') {
  const socketIds = [...(onlineUsers.get(Number(userId)) || [])];
  socketIds.forEach(socketId => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('session_revoked', { error: reason });
      socket.disconnect(true);
    }
  });
  return socketIds.length;
}

module.exports = {
  setupChatSocket,
  disconnectUser,
  emitToUser,
  normalizeMessage
};

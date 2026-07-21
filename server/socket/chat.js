const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

// 在线用户映射：userId -> Set of socket IDs
const onlineUsers = new Map();

function setupChatSocket(io) {
  // Socket.io 认证中间件
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('未登录'));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('登录已过期'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`用户 ${userId} 上线`);

    // 记录在线状态
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // 通知好友该用户上线
    notifyFriendsOnlineStatus(io, userId, true);

    // 处理私聊消息
    socket.on('private_message', (data) => {
      try {
        const { to, content, type, fileUrl } = data;
        const receiverId = parseInt(to);

        if (!receiverId || !content) return;

        // 验证是否互为好友
        const friendship = db.prepare(
          'SELECT id FROM friendships WHERE user_id = ? AND friend_id = ?'
        ).get(userId, receiverId);

        if (!friendship) return;

        // 保存消息到数据库
        const result = db.prepare(
          'INSERT INTO messages (sender_id, receiver_id, content, type, file_url) VALUES (?, ?, ?, ?, ?)'
        ).run(userId, receiverId, content, type || 'text', fileUrl || null);

        const messageData = {
          id: result.lastInsertRowid,
          from: userId,
          content,
          type: type || 'text',
          fileUrl: fileUrl || null,
          timestamp: new Date().toISOString()
        };

        // 发送给接收者（如果在线）
        const receiverSockets = onlineUsers.get(receiverId);
        if (receiverSockets) {
          receiverSockets.forEach(sid => {
            io.to(sid).emit('new_message', messageData);
          });
        }

        // 回传给发送者确认
        socket.emit('message_sent', messageData);
      } catch (err) {
        console.error('发送消息错误:', err);
        socket.emit('message_error', { error: '消息发送失败' });
      }
    });

    // 正在输入状态
    socket.on('typing', (data) => {
      const { to } = data;
      const receiverId = parseInt(to);
      const receiverSockets = onlineUsers.get(receiverId);
      if (receiverSockets) {
        receiverSockets.forEach(sid => {
          io.to(sid).emit('typing', { from: userId });
        });
      }
    });

    // 停止输入状态
    socket.on('stop_typing', (data) => {
      const { to } = data;
      const receiverId = parseInt(to);
      const receiverSockets = onlineUsers.get(receiverId);
      if (receiverSockets) {
        receiverSockets.forEach(sid => {
          io.to(sid).emit('stop_typing', { from: userId });
        });
      }
    });

    // 标记消息已读
    socket.on('mark_read', (data) => {
      try {
        const { from } = data;
        const senderId = parseInt(from);
        if (!senderId) return;

        db.prepare(`
          UPDATE messages SET read = 1
          WHERE sender_id = ? AND receiver_id = ? AND read = 0
        `).run(senderId, userId);
      } catch (err) {
        console.error('标记已读错误:', err);
      }
    });

    // 断开连接
    socket.on('disconnect', () => {
      console.log(`用户 ${userId} socket 断开`);
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        // 如果该用户所有 socket 都断开，则标记为离线
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          notifyFriendsOnlineStatus(io, userId, false);
        }
      }
    });
  });
}

// 通知好友在线状态变化
function notifyFriendsOnlineStatus(io, userId, isOnline) {
  try {
    const friends = db.prepare(`
      SELECT friend_id FROM friendships WHERE user_id = ?
    `).all(userId);

    friends.forEach(friend => {
      const friendSockets = onlineUsers.get(friend.friend_id);
      if (friendSockets) {
        friendSockets.forEach(sid => {
          io.to(sid).emit(isOnline ? 'friend_online' : 'friend_offline', { userId });
        });
      }
    });
  } catch (err) {
    console.error('通知在线状态错误:', err);
  }
}

// 检查用户是否在线
function isUserOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

module.exports = { setupChatSocket, isUserOnline };

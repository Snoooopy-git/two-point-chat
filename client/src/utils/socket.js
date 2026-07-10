// Socket.io 客户端封装
import { io } from 'socket.io-client';

let socket = null;

export function connectSocket(token) {
  if (socket) {
    socket.disconnect();
  }

  socket = io({
    auth: { token },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('WebSocket 已连接');
  });

  socket.on('disconnect', (reason) => {
    console.log('WebSocket 已断开:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('WebSocket 连接错误:', err.message);
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

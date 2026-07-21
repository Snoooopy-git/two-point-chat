const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const { setupChatSocket } = require('./socket/chat');

// 路由模块
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Socket.io CORS 配置
const io = new Server(server, {
  cors: {
    origin: isProduction ? false : (process.env.CORS_ORIGIN || 'http://localhost:5173'),
    methods: ['GET', 'POST']
  },
  // 生产环境优化
  pingTimeout: 60000,
  pingInterval: 25000
});

// 中间件
app.use(cors(isProduction ? {} : { origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// 生产环境安全检查
if (isProduction && process.env.JWT_SECRET === 'two-point-chat-secret-key-2026') {
  console.warn('⚠️  警告: 生产环境使用了默认 JWT_SECRET，请设置环境变量 JWT_SECRET');
}

// 静态文件服务 - 上传的图片
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: isProduction ? '7d' : 0
}));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 生产环境下托管前端静态文件
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath, {
  maxAge: isProduction ? '30d' : 0
}));

// SPA 兜底路由：非 API/静态资源请求返回 index.html
app.get('/{*path}', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.startsWith('/socket.io')) {
    res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
      if (err) {
        if (!res.headersSent) {
          res.status(404).json({ error: '前端资源未找到，请先构建前端 (npm run build)' });
        }
      }
    });
  }
});

// 设置 Socket.io 聊天
setupChatSocket(io);

// 启动服务
server.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ 聊天服务已启动: http://127.0.0.1:${PORT}`);
  console.log(`   环境: ${isProduction ? '生产' : '开发'}`);
  console.log(`   API: http://127.0.0.1:${PORT}/api`);
  console.log(`   健康检查: http://127.0.0.1:${PORT}/api/health`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});

module.exports = { app, server, io };

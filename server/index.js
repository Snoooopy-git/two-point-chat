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
const uploadPath = process.env.CHAT_UPLOAD_PATH
  ? path.resolve(process.env.CHAT_UPLOAD_PATH)
  : path.join(__dirname, 'uploads');

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
app.set('io', io);

// 中间件
if (!isProduction) {
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
}
app.disable('x-powered-by');
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// 静态文件服务 - 上传的图片
app.use('/uploads', express.static(uploadPath, {
  maxAge: isProduction ? '7d' : 0,
  setHeaders(res) {
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
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

app.all('/api/{*path}', (req, res) => {
  res.status(404).json({ error: 'API 接口不存在' });
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

function startServer(port = PORT, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(server.address());
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

function stopServer() {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

if (require.main === module) {
  startServer().then((address) => {
    const actualPort = address.port;
    console.log(`✅ 聊天服务已启动: http://127.0.0.1:${actualPort}`);
    console.log(`   环境: ${isProduction ? '生产' : '开发'}`);
    console.log(`   API: http://127.0.0.1:${actualPort}/api`);
    console.log(`   健康检查: http://127.0.0.1:${actualPort}/api/health`);
  }).catch((error) => {
    console.error('服务启动失败:', error);
    process.exit(1);
  });

  const shutdown = async () => {
    console.log('\n正在关闭服务...');
    try {
      await stopServer();
      console.log('服务已关闭');
      process.exit(0);
    } catch (error) {
      console.error('服务关闭失败:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { app, server, io, startServer, stopServer };

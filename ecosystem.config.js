// PM2 进程管理配置
module.exports = {
  apps: [
    {
      name: 'two-point-chat',
      script: 'server/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // ⚠️ 部署时请修改这个密钥为随机字符串
        JWT_SECRET: 'two-point-chat-production-change-me-please',
        // 管理员用户名：注册时匹配此值的用户自动获得管理员权限
        ADMIN_USERNAME: 'admin'
      },
      // 内存超限自动重启
      max_memory_restart: '300M',
      // 日志
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      // 优雅重启
      kill_timeout: 5000,
      listen_timeout: 10000
    }
  ]
};

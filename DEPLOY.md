# 双点聊天 - 阿里云 Linux 3 部署指南

## 前置准备

### 1. 开放阿里云安全组端口

登录阿里云控制台 → 云服务器 ECS → 安全组 → 添加规则：

| 方向 | 端口 | 协议 | 授权对象 | 说明 |
|------|------|------|----------|------|
| 入方向 | 80 | TCP | 0.0.0.0/0 | HTTP 访问 |
| 入方向 | 443 | TCP | 0.0.0.0/0 | HTTPS（可选） |

> ⚠️ **关键步骤**：不放行端口 80，外部无法访问！

---

## 部署步骤

### 步骤 1：上传项目到服务器

在**本地电脑**执行（将项目上传到服务器 `/opt/two-point-chat/`）：

```bash
# 方式 A：使用 scp 上传（替换 YOUR_SERVER_IP 为你的服务器 IP）
scp -r e:/Project-test/two-point/* root@YOUR_SERVER_IP:/opt/two-point-chat/

# 方式 B：使用 Git（先在 GitHub/Gitee 创建仓库）
# 在服务器上执行：
# git clone https://github.com/你的用户名/仓库名.git /opt/two-point-chat
```

### 步骤 2：SSH 登录服务器

```bash
ssh root@YOUR_SERVER_IP
```

### 步骤 3：执行一键部署脚本

```bash
cd /opt/two-point-chat
sudo bash deploy.sh
```

脚本会自动完成：
1. 安装 Node.js 20
2. 安装 PM2 进程管理器
3. 安装项目依赖
4. 构建前端
5. 配置 Nginx 反向代理
6. 启动应用

### 步骤 4：验证部署

```bash
# 检查服务状态
pm2 status

# 检查 Nginx 状态
systemctl status nginx

# 测试接口
curl http://127.0.0.1:3000/api/health
```

然后在浏览器访问：**http://你的服务器IP**

---

## 常用运维命令

```bash
# 查看应用状态
pm2 status

# 查看实时日志
pm2 logs two-point-chat

# 重启应用（更新代码后）
cd /opt/two-point-chat
git pull                    # 拉取最新代码
npm run build               # 重新构建前端
pm2 restart two-point-chat  # 重启服务

# 停止应用
pm2 stop two-point-chat

# 查看 Nginx 日志
tail -f /var/log/nginx/chat-access.log

# 查看错误日志
tail -f /var/log/nginx/chat-error.log
```

---

## 数据库备份

```bash
# 手动备份
cp /opt/two-point-chat/server/chat.db /opt/backups/chat-$(date +%Y%m%d).db

# 设置每日自动备份（crontab -e 添加）
0 3 * * * cp /opt/two-point-chat/server/chat.db /opt/backups/chat-$(date +\%Y\%m\%d).db
```

---

## 可选：配置 SSL/HTTPS

如果有域名，可以申请免费 SSL 证书：

```bash
# 安装 certbot
dnf install -y certbot python3-certbot-nginx

# 申请证书（替换为你的域名）
certbot --nginx -d chat.example.com

# 证书会自动续期
```

---

## 故障排查

### 无法访问？
1. **检查安全组**：阿里云控制台确认 80 端口已开放
2. **检查防火墙**：`systemctl status firewalld`
3. **检查 Nginx**：`systemctl status nginx`
4. **检查应用**：`pm2 status` 和 `pm2 logs two-point-chat`

### WebSocket 连接失败？
- 确认 Nginx 配置中 `/socket.io/` 路径包含 WebSocket 升级头
- 检查 `nginx -t` 配置是否正确

### 图片上传失败？
- 检查 `server/uploads/` 目录权限：`chmod 755 /opt/two-point-chat/server/uploads`
- 检查 Nginx `client_max_body_size` 是否足够大

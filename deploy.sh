#!/bin/bash
# ============================================
# 双点聊天 - 阿里云 Linux 3 一键部署脚本
# ============================================
# 使用方法:
#   1. 将整个项目上传到 /opt/two-point-chat/
#   2. 执行: sudo bash /opt/two-point-chat/deploy.sh
# ============================================

set -e

APP_DIR="/opt/two-point-chat"
NODE_VERSION="20"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")

echo "========================================"
echo "  双点聊天 - 服务器部署脚本"
echo "  检测到公网 IP: ${SERVER_IP}"
echo "========================================"

# ---- 1. 安装系统依赖 ----
echo "[1/7] 安装系统依赖..."
dnf install -y curl git nginx 2>/dev/null || yum install -y curl git nginx

# ---- 2. 安装 Node.js 20 ----
echo "[2/7] 安装 Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
    dnf install -y nodejs 2>/dev/null || yum install -y nodejs
fi
echo "Node.js $(node -v) | npm $(npm -v)"

# ---- 3. 安装 PM2 ----
echo "[3/7] 安装 PM2 进程管理器..."
npm install -g pm2 2>/dev/null || true

# ---- 4. 安装项目依赖并构建前端 ----
echo "[4/7] 安装项目依赖..."
cd "$APP_DIR"
npm install --production
cd "$APP_DIR/client"
npm install
echo "[4/7] 构建前端..."
npx vite build

# ---- 5. 创建必要目录 ----
echo "[5/7] 创建运行目录..."
mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/server/uploads"
chmod 755 "$APP_DIR/server/uploads"

# ---- 6. 配置 Nginx ----
echo "[6/7] 配置 Nginx 反向代理..."
# 复制配置文件
cp "$APP_DIR/nginx.conf" /etc/nginx/conf.d/chat.conf
# 替换占位符
sed -i "s/YOUR_SERVER_IP/${SERVER_IP}/g" /etc/nginx/conf.d/chat.conf 2>/dev/null || true
# 检查配置
nginx -t
# 启动 Nginx
systemctl enable nginx
systemctl restart nginx

# ---- 7. 启动应用 ----
echo "[7/7] 启动聊天服务..."
cd "$APP_DIR"
# 更新 PM2 配置中的 IP 占位符
sed -i "s/YOUR_SERVER_IP/${SERVER_IP}/g" ecosystem.config.js 2>/dev/null || true
# 停止旧进程（如果存在）
pm2 stop two-point-chat 2>/dev/null || true
pm2 delete two-point-chat 2>/dev/null || true
# 启动
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# ---- 完成 ----
echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo "  访问地址: http://${SERVER_IP}"
echo "  管理命令:"
echo "    pm2 status          - 查看状态"
echo "    pm2 logs chat       - 查看日志"
echo "    pm2 restart chat    - 重启服务"
echo ""
echo "  ⚠️ 重要: 请确保阿里云安全组已开放 80 端口!"
echo "========================================"

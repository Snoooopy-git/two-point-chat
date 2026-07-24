#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
PM2_APP_NAME="${PM2_APP_NAME:-two-point-chat}"

on_error() {
  local exit_code=$?
  echo "部署在第 ${BASH_LINENO[0]} 行失败，后续步骤已停止。" >&2
  echo "请保留日志，并按照 docs/deployment.md 使用预先确认的版本处理回退。" >&2
  exit "$exit_code"
}
trap on_error ERR

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少必要命令: $1" >&2
    exit 1
  fi
}

require_outside_repository() {
  local candidate
  candidate="$(realpath -m "$1")"
  case "$candidate" in
    "$APP_DIR"|"$APP_DIR"/*)
      echo "路径必须位于代码目录之外: $candidate" >&2
      exit 1
      ;;
  esac
}

require_command node
require_command npm
require_command pm2
require_command curl
require_command realpath
require_command grep
require_command mkdir
require_command dirname

: "${DEPLOY_VERSION:?必须设置 DEPLOY_VERSION，例如 0.2.0}"
: "${JWT_SECRET:?必须通过运行环境设置 JWT_SECRET}"
: "${CHAT_DB_PATH:?必须设置代码目录之外的 CHAT_DB_PATH}"
: "${BACKUP_DIR:?必须设置代码目录之外的 BACKUP_DIR}"

require_outside_repository "$CHAT_DB_PATH"
require_outside_repository "$BACKUP_DIR"

cd "$APP_DIR"
PACKAGE_VERSION="$(node -p "require('./package.json').version")"
if [[ "$DEPLOY_VERSION" != "$PACKAGE_VERSION" ]]; then
  echo "部署版本与 package.json 不一致: $DEPLOY_VERSION != $PACKAGE_VERSION" >&2
  exit 1
fi

if [[ "${NODE_ENV:-production}" != "production" ]]; then
  echo "生产部署要求 NODE_ENV=production" >&2
  exit 1
fi
export NODE_ENV=production
export JWT_SECRET
export CHAT_DB_PATH

mkdir -p "$(dirname "$CHAT_DB_PATH")" "$BACKUP_DIR"

echo "[1/7] 部署前数据库备份"
if [[ -f "$CHAT_DB_PATH" ]]; then
  npm run db:backup -- --source "$CHAT_DB_PATH" --out-dir "$BACKUP_DIR"
else
  echo "数据库尚不存在，按首次部署处理。"
fi

echo "[2/7] 使用 lockfile 安装依赖"
npm ci
npm ci --prefix client

echo "[3/7] 在目标环境重建原生依赖"
npm rebuild better-sqlite3

echo "[4/7] 执行完整质量门禁"
npm run check

echo "[5/7] 移除生产不需要的开发依赖"
npm prune --omit=dev
npm prune --omit=dev --prefix client

echo "[6/7] 更新单实例 PM2 进程"
pm2 startOrReload ecosystem.config.js --update-env

echo "[7/7] 健康检查与数据库完整性检查"
health_ok=false
for _attempt in {1..15}; do
  if curl --fail --silent --show-error "$HEALTH_URL" | grep -q '"status":"ok"'; then
    health_ok=true
    break
  fi
  sleep 2
done

if [[ "$health_ok" != "true" ]]; then
  echo "健康检查失败: $HEALTH_URL" >&2
  pm2 logs "$PM2_APP_NAME" --lines 100 --nostream >&2 || true
  exit 1
fi

verify_args=(--database "$CHAT_DB_PATH")
if [[ -n "${VERIFY_USERNAME:-}" ]]; then
  verify_args+=(--username "$VERIFY_USERNAME")
fi
npm run db:verify -- "${verify_args[@]}"

echo "部署验证完成: v${DEPLOY_VERSION}"

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function requireFile(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push(`缺少治理文件: ${relativePath}`);
  }
}

[
  'AGENTS.md',
  'CHANGELOG.md',
  'docs/architecture.md',
  'docs/testing.md',
  'docs/security.md',
  'docs/deployment.md',
  'docs/incidents/2026-07-20-emoji-picker.md',
  'docs/incidents/2026-07-21-database-overwrite.md',
  '.github/workflows/ci.yml',
  '.github/workflows/codeql.yml'
].forEach(requireFile);

const rootPackage = JSON.parse(read('package.json'));
const clientPackage = JSON.parse(read('client/package.json'));
if (rootPackage.version !== clientPackage.version) {
  failures.push(`前后端版本不一致: ${rootPackage.version} / ${clientPackage.version}`);
}

const trackedFiles = execFileSync('git', ['ls-files'], {
  cwd: root,
  encoding: 'utf8'
}).split(/\r?\n/).filter(Boolean);
const forbiddenTracked = trackedFiles.filter(file =>
  /(^|\/)(chat\.db(?:-(?:wal|shm))?|uploads\/.+|logs\/.+|backups\/.+|\.env)$/i.test(file)
);
if (forbiddenTracked.length > 0) {
  failures.push(`Git 跟踪了运行时数据: ${forbiddenTracked.join(', ')}`);
}

const sensitiveSources = [
  'ecosystem.config.js',
  'server/index.js',
  'server/middleware/auth.js',
  'server/routes/auth.js'
].map(file => `${file}\n${read(file)}`).join('\n');
if (/JWT_SECRET\s*:\s*['"][^'"]+['"]/.test(sensitiveSources)) {
  failures.push('发现硬编码 JWT_SECRET');
}
if (/ADMIN_USERNAME/.test(sensitiveSources)) {
  failures.push('发现基于用户名的管理员引导配置');
}

const gitignore = read('.gitignore');
for (const expected of ['*.db', '*.db-wal', '*.db-shm', '.env*', 'backups/']) {
  if (!gitignore.includes(expected)) {
    failures.push(`.gitignore 缺少: ${expected}`);
  }
}

const deployScript = read('deploy.sh');
for (const marker of [
  'set -Eeuo pipefail',
  'db:backup',
  'npm ci --include=dev',
  'npm ci --prefix client --include=dev',
  'npm rebuild better-sqlite3',
  'npm run check',
  'npm prune --omit=dev --package-lock=false',
  'npm prune --omit=dev --prefix client --package-lock=false',
  'LOCKFILE_FINGERPRINT_BEFORE',
  'LOCKFILE_FINGERPRINT_AFTER',
  '/api/health'
]) {
  if (!deployScript.includes(marker)) {
    failures.push(`deploy.sh 缺少门禁: ${marker}`);
  }
}

if (failures.length > 0) {
  console.error(failures.map(item => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(`治理检查通过，版本 ${rootPackage.version}`);

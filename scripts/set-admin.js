const path = require('path');
const { parseArgs, resolvePath } = require('./lib/cli');

function main() {
  const args = parseArgs(process.argv.slice(2));
  const username = args.username;
  if (!username) {
    throw new Error('必须通过 --username 指定现有用户');
  }
  if (args.confirm !== username) {
    throw new Error('必须通过 --confirm 再次提供完全相同的用户名');
  }

  process.env.CHAT_DB_PATH = resolvePath(
    args.database,
    process.env.CHAT_DB_PATH || path.join(__dirname, '..', 'server', 'chat.db')
  );
  const db = require('../server/db');

  try {
    const user = db.prepare(
      'SELECT id, username, role, status FROM users WHERE username = ?'
    ).get(username);
    if (!user) {
      throw new Error(`用户不存在: ${username}`);
    }
    if (user.status !== 'active') {
      throw new Error(`用户不是 active 状态: ${username}`);
    }
    if (user.role === 'admin') {
      console.log(`用户已经是管理员: ${username}`);
      return;
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', user.id);
    console.log(`管理员权限已授予: ${username}`);
  } finally {
    db.close();
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`管理员设置失败: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { main };

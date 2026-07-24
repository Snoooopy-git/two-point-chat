const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const REQUIRED_TABLES = ['users', 'friendships', 'messages'];

function verifyDatabase(databasePath, options = {}) {
  if (!fs.existsSync(databasePath)) {
    throw new Error(`数据库不存在: ${databasePath}`);
  }

  const database = new Database(databasePath, {
    readonly: true,
    fileMustExist: true
  });

  try {
    const integrityRows = database.pragma('integrity_check');
    const integrity = integrityRows.map(row => row.integrity_check);
    if (integrity.length !== 1 || integrity[0] !== 'ok') {
      throw new Error(`数据库完整性检查失败: ${integrity.join('; ')}`);
    }

    const tables = database.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).all().map(row => row.name);
    const missingTables = REQUIRED_TABLES.filter(table => !tables.includes(table));
    if (missingTables.length > 0) {
      throw new Error(`数据库缺少必要表: ${missingTables.join(', ')}`);
    }

    let expectedUser = null;
    if (options.username) {
      expectedUser = database.prepare(
        'SELECT id, username, role, status FROM users WHERE username = ?'
      ).get(options.username);
      if (!expectedUser) {
        throw new Error(`关键账号不存在: ${options.username}`);
      }
    }

    return {
      path: path.resolve(databasePath),
      integrity: 'ok',
      tables: REQUIRED_TABLES,
      userCount: database.prepare('SELECT COUNT(*) AS count FROM users').get().count,
      messageCount: database.prepare('SELECT COUNT(*) AS count FROM messages').get().count,
      expectedUser
    };
  } finally {
    database.close();
  }
}

module.exports = { REQUIRED_TABLES, verifyDatabase };

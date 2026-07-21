const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'chat.db');
const db = new Database(dbPath);

// 启用 WAL 模式提升性能
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 创建表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id),
    UNIQUE(user_id, friend_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    file_url TEXT DEFAULT NULL,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  );
`);

// 数据库迁移
const migrations = [
  { name: 'messages.read', sql: 'ALTER TABLE messages ADD COLUMN read INTEGER DEFAULT 0' },
  { name: 'users.role', sql: "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'" },
  { name: 'users.status', sql: "ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'" },
  { name: 'messages.deleted', sql: 'ALTER TABLE messages ADD COLUMN deleted INTEGER DEFAULT 0' }
];

for (const migration of migrations) {
  try {
    db.exec(migration.sql);
    console.log(`✅ 数据库迁移：已添加 ${migration.name} 列`);
  } catch (e) {
    // 列已存在，忽略
  }
}

module.exports = db;

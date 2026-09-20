const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.CHAT_DB_PATH
  ? path.resolve(process.env.CHAT_DB_PATH)
  : path.join(__dirname, 'chat.db');
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
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
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

  CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id),
    FOREIGN KEY (recipient_id) REFERENCES users(id),
    UNIQUE(requester_id, recipient_id),
    CHECK(requester_id != recipient_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    file_url TEXT DEFAULT NULL,
    client_message_id TEXT DEFAULT NULL,
    read INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  );
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(item => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

const migrate = db.transaction(() => {
  ensureColumn('messages', 'read', 'INTEGER DEFAULT 0');
  ensureColumn('users', 'role', "TEXT DEFAULT 'user'");
  ensureColumn('users', 'status', "TEXT DEFAULT 'active'");
  ensureColumn('messages', 'deleted', 'INTEGER DEFAULT 0');
  ensureColumn('messages', 'client_message_id', 'TEXT DEFAULT NULL');

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_friendships_user_friend
      ON friendships(user_id, friend_id);
    CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient_created
      ON friend_requests(recipient_id, created_at, id);
    CREATE INDEX IF NOT EXISTS idx_friend_requests_requester_created
      ON friend_requests(requester_id, created_at, id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(sender_id, receiver_id, created_at, id);
    CREATE INDEX IF NOT EXISTS idx_messages_unread
      ON messages(receiver_id, read, deleted, sender_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_sender_client_id
      ON messages(sender_id, client_message_id)
      WHERE client_message_id IS NOT NULL;
  `);
});

migrate();

module.exports = db;

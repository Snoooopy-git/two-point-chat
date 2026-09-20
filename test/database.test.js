const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'two-point-db-test-'));
process.env.CHAT_DB_PATH = path.join(testDirectory, 'chat.db');
const db = require('../server/db');

test.after(() => {
  db.close();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test('database creates the complete current schema', () => {
  const userColumns = db.prepare('PRAGMA table_info(users)').all().map(row => row.name);
  const messageColumns = db.prepare('PRAGMA table_info(messages)').all().map(row => row.name);
  const friendRequestColumns = db.prepare('PRAGMA table_info(friend_requests)')
    .all().map(row => row.name);

  assert.ok(userColumns.includes('role'));
  assert.ok(userColumns.includes('status'));
  assert.ok(messageColumns.includes('read'));
  assert.ok(messageColumns.includes('deleted'));
  assert.ok(messageColumns.includes('client_message_id'));
  assert.deepEqual(
    friendRequestColumns,
    ['id', 'requester_id', 'recipient_id', 'created_at']
  );
});

test('database creates query indexes and passes integrity check', () => {
  const indexes = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'index'"
  ).all().map(row => row.name);

  assert.ok(indexes.includes('idx_messages_conversation'));
  assert.ok(indexes.includes('idx_messages_unread'));
  assert.ok(indexes.includes('idx_messages_sender_client_id'));
  assert.ok(indexes.includes('idx_friend_requests_recipient_created'));
  assert.ok(indexes.includes('idx_friend_requests_requester_created'));
  assert.deepEqual(db.pragma('integrity_check'), [{ integrity_check: 'ok' }]);
});

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { verifyDatabase } = require('../scripts/lib/database-tools');

function createDatabase({ includeFriendRequests = true, asymmetric = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'two-point-verify-'));
  const databasePath = path.join(directory, 'chat.db');
  const database = new Database(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, role TEXT, status TEXT);
    CREATE TABLE friendships (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      friend_id INTEGER NOT NULL REFERENCES users(id)
    );
    CREATE TABLE messages (id INTEGER PRIMARY KEY);
    INSERT INTO users VALUES (1, 'first', 'user', 'active'), (2, 'second', 'user', 'active');
    INSERT INTO friendships (id, user_id, friend_id) VALUES (1, 1, 2);
    ${asymmetric ? '' : 'INSERT INTO friendships (id, user_id, friend_id) VALUES (2, 2, 1);'}
    ${includeFriendRequests ? 'CREATE TABLE friend_requests (id INTEGER PRIMARY KEY);' : ''}
  `);
  database.close();
  return { directory, databasePath };
}

test('database verification reports friend data and accepts symmetric relationships', () => {
  const fixture = createDatabase();
  try {
    const result = verifyDatabase(fixture.databasePath);
    assert.equal(result.friendshipCount, 2);
    assert.equal(result.friendRequestCount, 0);
    assert.ok(result.tables.includes('friend_requests'));
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('database verification requires the friend request table', () => {
  const fixture = createDatabase({ includeFriendRequests: false });
  try {
    assert.throws(
      () => verifyDatabase(fixture.databasePath),
      /friend_requests/
    );
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('database verification rejects asymmetric friendships', () => {
  const fixture = createDatabase({ asymmetric: true });
  try {
    assert.throws(
      () => verifyDatabase(fixture.databasePath),
      /非对称好友关系/
    );
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});

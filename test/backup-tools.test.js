const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { createBackup } = require('../scripts/backup-database');
const { runRecoveryDrill } = require('../scripts/recovery-drill');

test('online backup and recovery drill preserve a valid database', async () => {
  const sourceDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'two-point-source-'));
  const backupDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'two-point-backup-'));
  const sourcePath = path.join(sourceDirectory, 'chat.db');
  const source = new Database(sourcePath);

  try {
    source.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        username TEXT,
        role TEXT,
        status TEXT
      );
      CREATE TABLE friendships (id INTEGER PRIMARY KEY);
      CREATE TABLE messages (id INTEGER PRIMARY KEY);
      INSERT INTO users VALUES (1, 'recovery-user', 'admin', 'active');
    `);

    const backup = await createBackup({
      source: sourcePath,
      outDir: backupDirectory
    });
    assert.equal(backup.verification.integrity, 'ok');
    assert.ok(fs.existsSync(backup.backup));

    const drill = runRecoveryDrill({
      backup: backup.backup,
      username: 'recovery-user'
    });
    assert.equal(drill.integrity, 'ok');
    assert.equal(drill.expectedUser.username, 'recovery-user');
  } finally {
    source.close();
    fs.rmSync(sourceDirectory, { recursive: true, force: true });
    fs.rmSync(backupDirectory, { recursive: true, force: true });
  }
});

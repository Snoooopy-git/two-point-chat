const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'two-point-smoke-'));
process.env.CHAT_DB_PATH = path.join(testDirectory, 'chat.db');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local-smoke-test-secret-with-more-than-32-characters';

const { startServer, stopServer } = require('../server/index');
const db = require('../server/db');

let baseUrl;

test.before(async () => {
  const address = await startServer(0);
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await stopServer();
  db.close();
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

test('health endpoint responds locally', async () => {
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.status, 'ok');
});

test('public registration always creates a normal user', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'governance-user',
      password: 'local-test-password'
    })
  });

  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.user.role, 'user');
});

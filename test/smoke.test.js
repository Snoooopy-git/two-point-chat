const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'two-point-smoke-'));
process.env.CHAT_DB_PATH = path.join(testDirectory, 'chat.db');
process.env.CHAT_UPLOAD_PATH = path.join(testDirectory, 'uploads');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'local-smoke-test-secret-with-more-than-32-characters';

const { startServer, stopServer } = require('../server/index');
const db = require('../server/db');
const { io: createSocket } = require('socket.io-client');

let baseUrl;
let usernameSequence = 0;

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json();
  return { response, body };
}

async function register(prefix = 'user') {
  usernameSequence += 1;
  const username = `${prefix}-${usernameSequence}`;
  const { response, body } = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'local-test-password' })
  });
  assert.equal(response.status, 201);
  return body;
}

function authorized(token, method = 'GET', body) {
  return {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  };
}

function waitForEvent(socket, event) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`等待 Socket 事件超时: ${event}`));
    }, 3000);
    const onEvent = (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    };
    socket.once(event, onEvent);
  });
}

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

test('unknown API endpoint returns a JSON 404 without hanging', async () => {
  const { response, body } = await request('/api/not-found');
  assert.equal(response.status, 404);
  assert.equal(body.error, 'API 接口不存在');
});

test('disabled account loses HTTP and existing Socket access', async () => {
  const admin = await register('admin');
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(admin.user.id);
  const target = await register('disabled');

  const socket = createSocket(baseUrl, {
    auth: { token: target.token },
    transports: ['websocket'],
    autoConnect: false
  });
  const connected = waitForEvent(socket, 'connect');
  socket.connect();
  await connected;

  const revoked = waitForEvent(socket, 'session_revoked');
  const { response } = await request(
    `/api/admin/users/${target.user.id}/status`,
    authorized(admin.token, 'PUT', { status: 'disabled' })
  );
  assert.equal(response.status, 200);
  assert.match((await revoked).error, /禁用|状态/);

  const me = await request('/api/auth/me', authorized(target.token));
  assert.equal(me.response.status, 401);
  socket.close();
});

test('administrator deletion and last active administrator are protected', async () => {
  const first = await register('admin-protect');
  const second = await register('admin-protect');
  db.prepare("UPDATE users SET role = 'user'").run();
  db.prepare("UPDATE users SET role = 'admin' WHERE id IN (?, ?)").run(
    first.user.id,
    second.user.id
  );

  const deleteAdmin = await request(
    `/api/admin/users/${second.user.id}`,
    authorized(first.token, 'DELETE')
  );
  assert.equal(deleteAdmin.response.status, 400);
  assert.match(deleteAdmin.body.error, /管理员/);

  db.prepare("UPDATE users SET role = 'user' WHERE id = ?").run(second.user.id);
  const disableLast = await request(
    `/api/admin/users/${first.user.id}/status`,
    authorized(first.token, 'PUT', { status: 'disabled' })
  );
  assert.equal(disableLast.response.status, 400);
  assert.match(disableLast.body.error, /最后一个/);
});

test('friendship creation is bidirectional, transactional and idempotent', async () => {
  const first = await register('friend');
  const second = await register('friend');

  const firstAttempt = await request(
    '/api/users/friends',
    authorized(first.token, 'POST', { friendId: second.user.id })
  );
  const secondAttempt = await request(
    '/api/users/friends',
    authorized(first.token, 'POST', { friendId: second.user.id })
  );
  assert.equal(firstAttempt.response.status, 201);
  assert.equal(secondAttempt.response.status, 200);

  const rows = db.prepare(`
    SELECT user_id, friend_id FROM friendships
    WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
  `).all(first.user.id, second.user.id, second.user.id, first.user.id);
  assert.equal(rows.length, 2);
});

test('history returns the newest page and uses a stable cursor', async () => {
  const first = await register('history');
  const second = await register('history');
  await request(
    '/api/users/friends',
    authorized(first.token, 'POST', { friendId: second.user.id })
  );

  const insert = db.prepare(`
    INSERT INTO messages (sender_id, receiver_id, content)
    VALUES (?, ?, ?)
  `);
  const ids = [];
  const insertBatch = db.transaction(() => {
    for (let index = 0; index < 205; index += 1) {
      ids.push(Number(insert.run(first.user.id, second.user.id, `message-${index}`).lastInsertRowid));
    }
  });
  insertBatch();

  const latest = await request(
    `/api/messages/${second.user.id}`,
    authorized(first.token)
  );
  assert.equal(latest.response.status, 200);
  assert.equal(latest.body.messages.length, 200);
  assert.equal(latest.body.messages[0].id, ids[5]);
  assert.equal(latest.body.messages.at(-1).id, ids[204]);
  assert.equal(latest.body.nextCursor, ids[5]);

  const older = await request(
    `/api/messages/${second.user.id}?before=${latest.body.nextCursor}`,
    authorized(first.token)
  );
  assert.deepEqual(
    older.body.messages.map(message => message.id),
    ids.slice(0, 5)
  );
  assert.equal(older.body.nextCursor, null);
});

test('deleted messages are excluded from contact summaries', async () => {
  const first = await register('summary');
  const second = await register('summary');
  await request(
    '/api/users/friends',
    authorized(first.token, 'POST', { friendId: second.user.id })
  );
  db.prepare(`
    INSERT INTO messages (sender_id, receiver_id, content, deleted)
    VALUES (?, ?, 'visible', 0), (?, ?, 'hidden', 1)
  `).run(first.user.id, second.user.id, first.user.id, second.user.id);

  const friends = await request('/api/users/friends', authorized(first.token));
  const contact = friends.body.friends.find(item => item.id === second.user.id);
  assert.equal(contact.lastMessage.content, 'visible');
});

test('upload verifies actual image signature and generates a safe filename', async () => {
  const user = await register('upload');
  const validForm = new FormData();
  validForm.append(
    'image',
    new Blob([Buffer.from('89504e470d0a1a0a00000000', 'hex')], { type: 'image/png' }),
    '../../unsafe-name.png'
  );
  const valid = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}` },
    body: validForm
  });
  const validBody = await valid.json();
  assert.equal(valid.status, 201);
  assert.match(validBody.filename, /^[0-9a-f-]{36}\.png$/);
  assert.equal(fs.existsSync(path.join(process.env.CHAT_UPLOAD_PATH, validBody.filename)), true);
  const served = await fetch(`${baseUrl}${validBody.fileUrl}`);
  assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
  assert.match(served.headers.get('content-security-policy'), /default-src 'none'/);

  const invalidForm = new FormData();
  invalidForm.append(
    'image',
    new Blob(['<script>alert(1)</script>'], { type: 'image/png' }),
    'fake.png'
  );
  const invalid = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}` },
    body: invalidForm
  });
  assert.equal(invalid.status, 400);
});

test('Socket snapshot and client message ID make delivery reconnect-safe', async () => {
  const sender = await register('socket');
  const receiver = await register('socket');
  await request(
    '/api/users/friends',
    authorized(sender.token, 'POST', { friendId: receiver.user.id })
  );

  const receiverSocket = createSocket(baseUrl, {
    auth: { token: receiver.token },
    transports: ['websocket'],
    autoConnect: false
  });
  const receiverConnected = waitForEvent(receiverSocket, 'connect');
  receiverSocket.connect();
  await receiverConnected;

  const senderSocket = createSocket(baseUrl, {
    auth: { token: sender.token },
    transports: ['websocket'],
    autoConnect: false
  });
  const snapshot = waitForEvent(senderSocket, 'online_users');
  senderSocket.connect();
  assert.deepEqual((await snapshot).userIds, [receiver.user.id]);

  const payload = {
    to: receiver.user.id,
    content: 'idempotent message',
    type: 'text',
    clientMessageId: 'client-message-id-0001'
  };
  let deliveries = 0;
  receiverSocket.on('new_message', () => {
    deliveries += 1;
  });

  const firstConfirmation = waitForEvent(senderSocket, 'message_sent');
  senderSocket.emit('private_message', payload);
  const firstMessage = await firstConfirmation;
  const secondConfirmation = waitForEvent(senderSocket, 'message_sent');
  senderSocket.emit('private_message', payload);
  const secondMessage = await secondConfirmation;

  assert.equal(firstMessage.id, secondMessage.id);
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(deliveries, 1);
  const count = db.prepare(`
    SELECT COUNT(*) AS count FROM messages
    WHERE sender_id = ? AND client_message_id = ?
  `).get(sender.user.id, payload.clientMessageId);
  assert.equal(count.count, 1);

  senderSocket.close();
  receiverSocket.close();
});

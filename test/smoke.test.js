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

async function sendFriendRequest(requester, recipient) {
  return request(
    '/api/users/friend-requests',
    authorized(requester.token, 'POST', { recipientId: recipient.user.id })
  );
}

async function becomeFriends(requester, recipient) {
  const sent = await sendFriendRequest(requester, recipient);
  assert.ok([200, 201].includes(sent.response.status));
  const accepted = await request(
    `/api/users/friend-requests/${sent.body.request.id}/accept`,
    authorized(recipient.token, 'PUT')
  );
  assert.equal(accepted.response.status, 200);
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

test('friend request requires recipient approval and creates a bidirectional friendship', async () => {
  const first = await register('friend');
  const second = await register('friend');

  const firstAttempt = await sendFriendRequest(first, second);
  const secondAttempt = await sendFriendRequest(first, second);
  assert.equal(firstAttempt.response.status, 201);
  assert.equal(secondAttempt.response.status, 200);
  assert.equal(firstAttempt.body.request.id, secondAttempt.body.request.id);

  let rows = db.prepare(`
    SELECT user_id, friend_id FROM friendships
    WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
  `).all(first.user.id, second.user.id, second.user.id, first.user.id);
  assert.equal(rows.length, 0);

  const incoming = await request('/api/users/friend-requests', authorized(second.token));
  assert.equal(incoming.response.status, 200);
  assert.equal(incoming.body.incoming[0].user.id, first.user.id);

  const accepted = await request(
    `/api/users/friend-requests/${firstAttempt.body.request.id}/accept`,
    authorized(second.token, 'PUT')
  );
  assert.equal(accepted.response.status, 200);

  rows = db.prepare(`
    SELECT user_id, friend_id FROM friendships
    WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
  `).all(first.user.id, second.user.id, second.user.id, first.user.id);
  assert.equal(rows.length, 2);
});

test('friend requests enforce direction, ownership, rejection and cancellation', async () => {
  const requester = await register('request-rules');
  const recipient = await register('request-rules');
  const outsider = await register('request-rules');

  const sent = await sendFriendRequest(requester, recipient);
  const reverse = await sendFriendRequest(recipient, requester);
  assert.equal(reverse.response.status, 409);
  assert.match(reverse.body.error, /已向你发送/);

  const unauthorized = await request(
    `/api/users/friend-requests/${sent.body.request.id}/accept`,
    authorized(outsider.token, 'PUT')
  );
  assert.equal(unauthorized.response.status, 403);

  const rejected = await request(
    `/api/users/friend-requests/${sent.body.request.id}`,
    authorized(recipient.token, 'DELETE')
  );
  assert.equal(rejected.response.status, 200);
  assert.equal(db.prepare(`
    SELECT COUNT(*) AS count FROM friendships
    WHERE user_id IN (?, ?) AND friend_id IN (?, ?)
  `).get(requester.user.id, recipient.user.id, requester.user.id, recipient.user.id).count, 0);

  const resent = await sendFriendRequest(requester, recipient);
  const cancelled = await request(
    `/api/users/friend-requests/${resent.body.request.id}`,
    authorized(requester.token, 'DELETE')
  );
  assert.equal(cancelled.response.status, 200);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM friend_requests WHERE id = ?')
      .get(resent.body.request.id).count,
    0
  );
});

test('friend request lifecycle emits realtime events', async () => {
  const requester = await register('request-socket');
  const recipient = await register('request-socket');
  const requesterSocket = createSocket(baseUrl, {
    auth: { token: requester.token },
    transports: ['websocket'],
    autoConnect: false
  });
  const recipientSocket = createSocket(baseUrl, {
    auth: { token: recipient.token },
    transports: ['websocket'],
    autoConnect: false
  });
  const requesterConnected = waitForEvent(requesterSocket, 'connect');
  const recipientConnected = waitForEvent(recipientSocket, 'connect');
  requesterSocket.connect();
  recipientSocket.connect();
  await Promise.all([requesterConnected, recipientConnected]);

  const receivedEvent = waitForEvent(recipientSocket, 'friend_request_received');
  const sent = await sendFriendRequest(requester, recipient);
  assert.equal((await receivedEvent).user.id, requester.user.id);

  const resolvedEvent = waitForEvent(requesterSocket, 'friend_request_resolved');
  const friendAddedEvent = waitForEvent(requesterSocket, 'friend_added');
  const accepted = await request(
    `/api/users/friend-requests/${sent.body.request.id}/accept`,
    authorized(recipient.token, 'PUT')
  );
  assert.equal(accepted.response.status, 200);
  assert.equal((await resolvedEvent).action, 'accepted');
  assert.equal((await friendAddedEvent).friend.id, recipient.user.id);

  requesterSocket.close();
  recipientSocket.close();
});

test('history returns the newest page and uses a stable cursor', async () => {
  const first = await register('history');
  const second = await register('history');
  await becomeFriends(first, second);

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
  assert.match(latest.body.messages[0].created_at, /^\d{4}-\d{2}-\d{2}T.*Z$/);

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
  await becomeFriends(first, second);
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
  await becomeFriends(sender, receiver);

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
  assert.match(firstMessage.timestamp, /^\d{4}-\d{2}-\d{2}T.*Z$/);
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

test('read cursor rejects a non-numeric friend id', async () => {
  const user = await register('read-guard');

  const invalid = await request(
    '/api/messages/not-a-number/read',
    authorized(user.token, 'PUT')
  );
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.body.error, /好友 ID/);

  const missing = await request(
    '/api/messages/0/read',
    authorized(user.token, 'PUT')
  );
  assert.equal(missing.response.status, 400);
});

test('user search escapes LIKE wildcards and hides disabled accounts', async () => {
  const searcher = await register('search');
  const target = await register('search-visible');

  const wildcard = await request('/api/users/search?q=%25', authorized(searcher.token));
  assert.equal(wildcard.response.status, 200);
  assert.deepEqual(wildcard.body.users, []);

  const underscore = await request('/api/users/search?q=_', authorized(searcher.token));
  assert.deepEqual(underscore.body.users, []);

  const substring = await request('/api/users/search?q=visible', authorized(searcher.token));
  assert.deepEqual(
    substring.body.users.map(user => user.username),
    [target.user.username]
  );

  db.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").run(target.user.id);
  const disabled = await request('/api/users/search?q=visible', authorized(searcher.token));
  assert.deepEqual(disabled.body.users, []);
});

test('read receipts are delivered to the original sender', async () => {
  const sender = await register('receipt');
  const reader = await register('receipt');
  await becomeFriends(sender, reader);

  const senderSocket = createSocket(baseUrl, {
    auth: { token: sender.token },
    transports: ['websocket'],
    autoConnect: false
  });
  const senderConnected = waitForEvent(senderSocket, 'connect');
  senderSocket.connect();
  await senderConnected;

  // 路径 1：读取方通过 HTTP 标记已读
  const httpConfirmation = waitForEvent(senderSocket, 'message_sent');
  senderSocket.emit('private_message', {
    to: reader.user.id,
    content: 'http read receipt probe',
    type: 'text',
    clientMessageId: 'read-receipt-http-0001'
  });
  assert.equal((await httpConfirmation).read, 0);

  const httpReceipt = waitForEvent(senderSocket, 'messages_read');
  const markRead = await request(
    `/api/messages/${sender.user.id}/read`,
    authorized(reader.token, 'PUT')
  );
  assert.equal(markRead.response.status, 200);
  const httpPayload = await httpReceipt;
  assert.equal(httpPayload.from, reader.user.id);
  assert.equal(httpPayload.count, 1);

  // 路径 2：读取方通过 Socket 标记已读
  const socketConfirmation = waitForEvent(senderSocket, 'message_sent');
  senderSocket.emit('private_message', {
    to: reader.user.id,
    content: 'socket read receipt probe',
    type: 'text',
    clientMessageId: 'read-receipt-socket-0002'
  });
  await socketConfirmation;

  const readerSocket = createSocket(baseUrl, {
    auth: { token: reader.token },
    transports: ['websocket'],
    autoConnect: false
  });
  const readerConnected = waitForEvent(readerSocket, 'connect');
  readerSocket.connect();
  await readerConnected;

  const socketReceipt = waitForEvent(senderSocket, 'messages_read');
  readerSocket.emit('mark_read', { from: sender.user.id });
  const socketPayload = await socketReceipt;
  assert.equal(socketPayload.from, reader.user.id);
  assert.equal(socketPayload.count, 1);

  // 重复标记已读不应再产生回执
  const duplicate = db.prepare(
    "SELECT COUNT(*) AS count FROM messages WHERE receiver_id = ? AND read = 0"
  ).get(reader.user.id);
  assert.equal(duplicate.count, 0);

  readerSocket.close();
  senderSocket.close();
});

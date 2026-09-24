const path = require('path');
const { pathToFileURL } = require('url');
const test = require('node:test');
const assert = require('node:assert/strict');

const apiModuleUrl = pathToFileURL(
  path.join(__dirname, '..', 'client', 'src', 'utils', 'api.js')
).href;
const authModuleUrl = pathToFileURL(
  path.join(__dirname, '..', 'client', 'src', 'stores', 'auth.js')
).href;
const piniaModuleUrl = pathToFileURL(
  path.join(__dirname, '..', 'client', 'node_modules', 'pinia', 'dist', 'pinia.mjs')
).href;

function createLocalStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

test('API 401 preserves the status and invokes the session expiry handler', async () => {
  global.localStorage = createLocalStorage({ token: 'expired-token' });
  global.fetch = async () => new Response(
    JSON.stringify({ error: '登录已过期，请重新登录' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );

  const { api, setUnauthorizedHandler, ApiError } = await import(apiModuleUrl);
  let handledError = null;
  setUnauthorizedHandler(error => {
    handledError = error;
  });

  await assert.rejects(
    api.get('/api/users/friends'),
    error => error instanceof ApiError && error.status === 401
  );
  assert.equal(handledError?.status, 401);
  setUnauthorizedHandler(null);
});

test('non-authentication API failures do not expire the session', async () => {
  global.localStorage = createLocalStorage({ token: 'valid-token' });
  global.fetch = async () => new Response(
    JSON.stringify({ error: '服务器错误' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );

  const { api, setUnauthorizedHandler } = await import(apiModuleUrl);
  let handlerCalls = 0;
  setUnauthorizedHandler(() => {
    handlerCalls += 1;
  });

  await assert.rejects(api.get('/api/users/friends'), error => error.status === 500);
  assert.equal(handlerCalls, 0);
  setUnauthorizedHandler(null);
});

test('startup validation clears an expired persisted session', async () => {
  global.localStorage = createLocalStorage({
    token: 'expired-token',
    user: JSON.stringify({ id: 7, username: 'Ji', role: 'user' })
  });
  global.fetch = async () => new Response(
    JSON.stringify({ error: '登录已过期，请重新登录' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  );

  const { createPinia, setActivePinia } = await import(piniaModuleUrl);
  const { setUnauthorizedHandler } = await import(apiModuleUrl);
  const { useAuthStore } = await import(authModuleUrl);
  setActivePinia(createPinia());
  const authStore = useAuthStore();
  setUnauthorizedHandler(() => authStore.expireSession());

  await authStore.init();

  assert.equal(authStore.isAuthenticated, false);
  assert.equal(authStore.sessionExpired, true);
  assert.equal(authStore.initialized, true);
  assert.equal(global.localStorage.getItem('token'), null);
  assert.equal(global.localStorage.getItem('user'), null);
  setUnauthorizedHandler(null);
});

test.after(() => {
  delete global.fetch;
  delete global.localStorage;
});

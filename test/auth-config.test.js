const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isWeakJwtSecret,
  resolveJwtSecret
} = require('../server/middleware/auth');

test('production rejects a missing JWT secret', () => {
  assert.throws(
    () => resolveJwtSecret({ NODE_ENV: 'production' }),
    /JWT_SECRET/
  );
});

test('production rejects weak and placeholder JWT secrets', () => {
  assert.equal(isWeakJwtSecret('short'), true);
  assert.equal(isWeakJwtSecret('replace-with-a-long-placeholder-secret-value'), true);
});

test('production accepts a strong JWT secret', () => {
  const secret = '9f50a76105df4b76a266f8f25f29e66366f83b9d18dc0ec9';
  assert.equal(resolveJwtSecret({
    NODE_ENV: 'production',
    JWT_SECRET: secret
  }), secret);
});

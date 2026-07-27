const test = require('node:test');
const assert = require('node:assert/strict');
const { toUtcIsoTimestamp } = require('../server/utils/timestamps');

test('SQLite UTC timestamps are serialized as unambiguous ISO timestamps', () => {
  const timestamp = toUtcIsoTimestamp('2026-07-27 10:00:41');

  assert.equal(timestamp, '2026-07-27T10:00:41.000Z');
  assert.equal(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(timestamp)),
    '18:00'
  );
  assert.equal(
    toUtcIsoTimestamp('2026-07-27 10:00:41.125'),
    '2026-07-27T10:00:41.125Z'
  );
});

test('timestamps that already declare their timezone remain unchanged', () => {
  assert.equal(
    toUtcIsoTimestamp('2026-07-27T10:00:41.000Z'),
    '2026-07-27T10:00:41.000Z'
  );
  assert.equal(toUtcIsoTimestamp(null), null);
});

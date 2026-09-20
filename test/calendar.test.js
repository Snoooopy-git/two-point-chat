const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('url');

const calendarModuleUrl = pathToFileURL(
  path.join(__dirname, '..', 'client', 'src', 'utils', 'calendar.js')
).href;

test('calendar starts on Monday and always returns six complete weeks', async () => {
  const { buildCalendarDays } = await import(calendarModuleUrl);
  const days = buildCalendarDays(2026, 8, new Date(2026, 8, 20, 12));

  assert.equal(days.length, 42);
  assert.equal(days[0].key, '2026-08-31');
  assert.equal(days[6].key, '2026-09-06');
  assert.equal(days.filter(day => day.isToday).length, 1);
  assert.equal(days.find(day => day.isToday).key, '2026-09-20');
});

test('calendar handles leap-year February without UTC date drift', async () => {
  const { buildCalendarDays, toDateKey } = await import(calendarModuleUrl);
  const days = buildCalendarDays(2028, 1, new Date(2028, 1, 29, 12));

  assert.ok(days.some(day => day.key === '2028-02-29' && day.inCurrentMonth));
  assert.equal(toDateKey(new Date(2028, 1, 29, 23, 30)), '2028-02-29');
});

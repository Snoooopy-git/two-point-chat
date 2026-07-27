const SQLITE_UTC_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

function toUtcIsoTimestamp(value) {
  if (typeof value !== 'string' || !SQLITE_UTC_TIMESTAMP.test(value)) {
    return value;
  }

  return new Date(`${value.replace(' ', 'T')}Z`).toISOString();
}

module.exports = { toUtcIsoTimestamp };

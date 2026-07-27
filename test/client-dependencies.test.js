const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const clientPackage = require(path.join(
  __dirname,
  '..',
  'client',
  'package.json'
));
const clientLock = require(path.join(
  __dirname,
  '..',
  'client',
  'package-lock.json'
));

function isVersionAtLeast(version, minimum) {
  const actual = version.split('.').map(Number);
  const required = minimum.split('.').map(Number);

  for (let index = 0; index < required.length; index += 1) {
    if (actual[index] !== required[index]) {
      return actual[index] > required[index];
    }
  }

  return true;
}

test('client pins PostCSS outside GHSA-r28c-9q8g-f849 range', () => {
  const postcss = clientLock.packages['node_modules/postcss'];

  assert.equal(clientPackage.overrides.postcss, '^8.5.18');
  assert.ok(postcss, 'client lockfile must contain PostCSS');
  assert.ok(
    isVersionAtLeast(postcss.version, '8.5.18'),
    `PostCSS ${postcss.version} is vulnerable to GHSA-r28c-9q8g-f849`
  );
});

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

test('client dependency floors exclude known parser and generator advisories', () => {
  const parser = clientLock.packages['node_modules/socket.io-parser'];
  const nanoid = clientLock.packages['node_modules/nanoid'];

  assert.equal(clientPackage.dependencies['socket.io-client'], '^4.8.4');
  assert.ok(parser, 'client lockfile must contain socket.io-parser');
  assert.ok(nanoid, 'client lockfile must contain nanoid');
  assert.ok(
    isVersionAtLeast(parser.version, '4.2.7'),
    `socket.io-parser ${parser.version} is vulnerable to GHSA-2m8v-j782-fhvr`
  );
  assert.ok(
    isVersionAtLeast(nanoid.version, '3.3.18'),
    `nanoid ${nanoid.version} is vulnerable to GHSA-2v37-7h3g-55p8`
  );
});

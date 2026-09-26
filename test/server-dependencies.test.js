const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const rootPackage = require(path.join(__dirname, '..', 'package.json'));
const rootLock = require(path.join(__dirname, '..', 'package-lock.json'));

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

function assertSafeVersion(packageName, minimum, advisory) {
  const dependency = rootLock.packages[`node_modules/${packageName}`];
  assert.ok(dependency, `root lockfile must contain ${packageName}`);
  assert.ok(
    isVersionAtLeast(dependency.version, minimum),
    `${packageName} ${dependency.version} is vulnerable to ${advisory}`
  );
}

test('server dependency floors exclude known upload and parsing advisories', () => {
  assert.equal(rootPackage.dependencies.multer, '^2.4.0');
  assert.equal(rootPackage.dependencies['socket.io'], '^4.8.4');
  assertSafeVersion('multer', '2.3.0', 'Multer denial-of-service advisories');
  assertSafeVersion('qs', '6.16.0', 'GHSA-x5fp-wj9c-mxmx and GHSA-4mjr-xmp4-gh2g');
  assertSafeVersion('socket.io-parser', '4.2.7', 'GHSA-2m8v-j782-fhvr');
});

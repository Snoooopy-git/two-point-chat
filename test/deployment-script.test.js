const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const deployScript = fs.readFileSync(
  path.join(__dirname, '..', 'deploy.sh'),
  'utf8'
);

test('deployment installs quality-gate dependencies before pruning them', () => {
  const rootInstall = deployScript.indexOf('npm ci --include=dev');
  const clientInstall = deployScript.indexOf('npm ci --prefix client --include=dev');
  const qualityGate = deployScript.indexOf('npm run check');
  const rootPrune = deployScript.indexOf('npm prune --omit=dev');
  const clientPrune = deployScript.indexOf('npm prune --omit=dev --prefix client');

  for (const position of [
    rootInstall,
    clientInstall,
    qualityGate,
    rootPrune,
    clientPrune
  ]) {
    assert.notEqual(position, -1);
  }

  assert.ok(rootInstall < qualityGate);
  assert.ok(clientInstall < qualityGate);
  assert.ok(qualityGate < rootPrune);
  assert.ok(qualityGate < clientPrune);
});

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
  const rootPrune = deployScript.indexOf(
    'npm prune --omit=dev --package-lock=false'
  );
  const clientPrune = deployScript.indexOf(
    'npm prune --omit=dev --prefix client --package-lock=false'
  );
  const lockfileGate = deployScript.indexOf(
    'LOCKFILE_FINGERPRINT_AFTER='
  );
  const processReload = deployScript.indexOf(
    'pm2 startOrReload ecosystem.config.js --update-env'
  );

  for (const position of [
    rootInstall,
    clientInstall,
    qualityGate,
    rootPrune,
    clientPrune,
    lockfileGate,
    processReload
  ]) {
    assert.notEqual(position, -1);
  }

  assert.ok(rootInstall < qualityGate);
  assert.ok(clientInstall < qualityGate);
  assert.ok(qualityGate < rootPrune);
  assert.ok(qualityGate < clientPrune);
  assert.ok(rootPrune < lockfileGate);
  assert.ok(clientPrune < lockfileGate);
  assert.ok(lockfileGate < processReload);
});

test('deployment rejects lockfile mutations before updating PM2', () => {
  assert.match(
    deployScript,
    /LOCKFILE_FINGERPRINT_BEFORE="\$\(sha256sum -- package-lock\.json client\/package-lock\.json\)"/
  );
  assert.match(
    deployScript,
    /if \[\[ "\$LOCKFILE_FINGERPRINT_AFTER" != "\$LOCKFILE_FINGERPRINT_BEFORE" \]\]/
  );
  assert.match(
    deployScript,
    /依赖安装或裁剪修改了 lockfile，拒绝更新 PM2 进程。/
  );
});

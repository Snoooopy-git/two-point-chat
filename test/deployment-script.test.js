const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const deployScript = fs.readFileSync(
  path.join(__dirname, '..', 'deploy.sh'),
  'utf8'
);

test('deployment validates with development dependencies before an exact production install', () => {
  const rootInstall = deployScript.indexOf('npm ci --include=dev');
  const clientInstall = deployScript.indexOf('npm ci --prefix client --include=dev');
  const qualityGate = deployScript.indexOf('npm run check');
  const rootProductionInstall = deployScript.indexOf(
    'npm ci --omit=dev'
  );
  const clientProductionInstall = deployScript.indexOf(
    'npm ci --prefix client --omit=dev'
  );
  const lockfileGate = deployScript.indexOf(
    'LOCKFILE_FINGERPRINT_AFTER='
  );
  const productionRebuild = deployScript.lastIndexOf('npm rebuild better-sqlite3');
  const processReload = deployScript.indexOf(
    'pm2 startOrReload ecosystem.config.js --update-env'
  );

  for (const position of [
    rootInstall,
    clientInstall,
    qualityGate,
    rootProductionInstall,
    clientProductionInstall,
    productionRebuild,
    lockfileGate,
    processReload
  ]) {
    assert.notEqual(position, -1);
  }

  assert.ok(rootInstall < qualityGate);
  assert.ok(clientInstall < qualityGate);
  assert.ok(qualityGate < rootProductionInstall);
  assert.ok(qualityGate < clientProductionInstall);
  assert.ok(rootProductionInstall < lockfileGate);
  assert.ok(clientProductionInstall < lockfileGate);
  assert.ok(rootProductionInstall < productionRebuild);
  assert.ok(clientProductionInstall < productionRebuild);
  assert.ok(productionRebuild < lockfileGate);
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
    /依赖安装修改了 lockfile，拒绝更新 PM2 进程。/
  );
});

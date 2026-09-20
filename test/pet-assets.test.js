const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const assetRoot = path.join(__dirname, '..', 'client', 'src', 'assets', 'pet');
const manifest = JSON.parse(fs.readFileSync(path.join(assetRoot, 'manifest.json'), 'utf8'));
const motion = JSON.parse(fs.readFileSync(path.join(assetRoot, 'motion.json'), 'utf8'));

test('desktop pet manifest and every referenced atlas are packaged', () => {
  assert.equal(manifest.character, '跳跳信使 / Pixel Hopper');
  assert.equal(manifest.actions.length, 12);

  for (const action of manifest.actions) {
    assert.equal(action.frameCount, 8);
    assert.deepEqual(action.atlasGrid, [4, 2]);
    assert.equal(fs.existsSync(path.join(assetRoot, action.atlas)), true, action.name);
  }
});

test('desktop pet idle motion uses a calm cycle with a natural pause', () => {
  const idleInterval = motion.intervals['idle-breathe'];
  assert.equal(idleInterval, 180);
  assert.ok(motion.idleSequence.length * idleInterval >= 5000);
  assert.ok(motion.idleSequence.filter(frame => frame === 0).length >= 16);
  assert.deepEqual(motion.defaultSequence, [0, 1, 2, 3, 4, 5, 6, 7]);
});

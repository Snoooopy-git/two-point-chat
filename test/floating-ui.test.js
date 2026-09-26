const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('url');

const root = path.join(__dirname, '..');
const positionModuleUrl = pathToFileURL(
  path.join(root, 'client', 'src', 'utils', 'floatingPosition.js')
).href;

test('floating position stays inside the viewport and survives viewport resizing', async () => {
  const {
    clampFloatingPosition,
    normalizeFloatingPosition,
    restoreFloatingPosition
  } = await import(positionModuleUrl);
  const viewport = { width: 1000, height: 800 };
  const item = { width: 100, height: 80 };

  assert.deepEqual(
    clampFloatingPosition({ x: -20, y: 900 }, viewport, item),
    { x: 0, y: 720 }
  );

  const normalized = normalizeFloatingPosition({ x: 450, y: 360 }, viewport, item);
  assert.deepEqual(normalized, { x: 0.5, y: 0.5 });
  assert.deepEqual(
    restoreFloatingPosition(normalized, { width: 600, height: 500 }, item),
    { x: 250, y: 210 }
  );
});

test('emoji picker and wooden fish escape local stacking contexts', () => {
  const picker = fs.readFileSync(
    path.join(root, 'client', 'src', 'components', 'EmojiPicker.vue'),
    'utf8'
  );
  const fish = fs.readFileSync(
    path.join(root, 'client', 'src', 'components', 'FloatingWoodenFish.vue'),
    'utf8'
  );
  const chat = fs.readFileSync(path.join(root, 'client', 'src', 'views', 'Chat.vue'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'client', 'src', 'style.css'), 'utf8');
  const woodenFishAssets = [
    path.join(root, 'client', 'src', 'assets', 'wooden-fish', 'wooden-fish-body.png'),
    path.join(root, 'client', 'src', 'assets', 'wooden-fish', 'wooden-fish-mallet.png')
  ];

  assert.match(picker, /<Teleport to="body">/);
  assert.match(picker, /anchorElement/);
  assert.match(chat, /:anchor-element="emojiButtonRef"/);
  assert.match(fish, /<Teleport to="body">/);
  assert.match(fish, /class="floating-wooden-fish"/);
  assert.match(fish, /wooden-fish-body\.png/);
  assert.match(fish, /wooden-fish-mallet\.png/);
  woodenFishAssets.forEach(asset => assert.ok(fs.statSync(asset).size > 10_000));
  assert.match(styles, /\.floating-wooden-fish\s*{[\s\S]*?position:\s*fixed;[\s\S]*?background:\s*transparent;[\s\S]*?border:\s*0;/);
  assert.match(styles, /@keyframes wooden-fish-mallet-strike\s*{[\s\S]*?rotate\(36deg\)[\s\S]*?rotate\(-42deg\)/);
  assert.match(styles, /\.emoji-picker-panel\s*{[\s\S]*?z-index:\s*901;/);
});

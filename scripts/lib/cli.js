const path = require('path');

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
      throw new Error(`无法识别的参数: ${item}`);
    }
    const key = item.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`参数 --${key} 缺少值`);
    }
    result[key] = value;
    index += 1;
  }
  return result;
}

function resolvePath(value, fallback) {
  const selected = value || fallback;
  if (!selected) {
    throw new Error('缺少路径参数');
  }
  return path.resolve(selected);
}

function isInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

module.exports = { parseArgs, resolvePath, isInside };

export function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function clampFloatingPosition(position, viewport, item) {
  return {
    x: clamp(position.x, 0, viewport.width - item.width),
    y: clamp(position.y, 0, viewport.height - item.height)
  };
}

export function normalizeFloatingPosition(position, viewport, item) {
  const bounded = clampFloatingPosition(position, viewport, item);
  const availableWidth = Math.max(1, viewport.width - item.width);
  const availableHeight = Math.max(1, viewport.height - item.height);

  return {
    x: bounded.x / availableWidth,
    y: bounded.y / availableHeight
  };
}

export function restoreFloatingPosition(normalized, viewport, item) {
  const availableWidth = Math.max(0, viewport.width - item.width);
  const availableHeight = Math.max(0, viewport.height - item.height);

  return clampFloatingPosition({
    x: Number(normalized?.x) * availableWidth,
    y: Number(normalized?.y) * availableHeight
  }, viewport, item);
}

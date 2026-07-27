import { ref } from 'vue';

const THEME_KEY = 'two-point-theme';
const VALID_MODES = ['system', 'light', 'dark', 'midnight'];

export const themeMode = ref('system');

let mediaQuery = null;

function resolveTheme(mode) {
  if (mode === 'system') {
    return mediaQuery?.matches ? 'dark' : 'light';
  }
  return mode;
}

function applyTheme(mode) {
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved === 'light' ? 'light' : 'dark';
}

function handleSystemThemeChange() {
  if (themeMode.value === 'system') {
    applyTheme('system');
  }
}

export function initTheme() {
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const savedMode = localStorage.getItem(THEME_KEY);
  themeMode.value = VALID_MODES.includes(savedMode) ? savedMode : 'system';
  applyTheme(themeMode.value);
  mediaQuery.addEventListener('change', handleSystemThemeChange);
}

export function setTheme(mode) {
  if (!VALID_MODES.includes(mode)) return;
  themeMode.value = mode;
  localStorage.setItem(THEME_KEY, mode);
  applyTheme(mode);
}

<template>
  <label class="theme-control">
    <span class="sr-only">界面主题</span>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42m0-12.72-1.42 1.42M7.06 16.94l-1.42 1.42" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
    <select :value="themeMode" @change="setTheme($event.target.value)">
      <option value="system">跟随系统</option>
      <option value="light">浅色</option>
      <option value="dark">深色</option>
      <option value="midnight">Midnight</option>
    </select>
  </label>
</template>

<script setup>
import { themeMode, setTheme } from '../utils/theme.js';
</script>

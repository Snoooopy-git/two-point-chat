<template>
  <div class="brand-lockup" :class="{ 'brand-lockup-compact': compact }">
    <svg
      class="brand-mark"
      viewBox="0 0 44 44"
      role="img"
      aria-label="two-point logo"
    >
      <defs>
        <linearGradient :id="gradientId" x1="5" y1="5" x2="39" y2="39">
          <stop offset="0" stop-color="#8b7cff" />
          <stop offset="1" stop-color="#5a4de8" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="14" :fill="`url(#${gradientId})`" />
      <path
        d="M13.5 27.5C18 27.5 18 16.5 22 16.5C26 16.5 26 27.5 30.5 27.5"
        fill="none"
        stroke="white"
        stroke-linecap="round"
        stroke-width="3.2"
      />
      <circle cx="12.5" cy="27.5" r="3.8" fill="white" />
      <circle cx="31.5" cy="27.5" r="3.8" fill="white" />
    </svg>
    <span v-if="!compact" class="brand-wordmark">two-point</span>
  </div>
</template>

<script setup>
import { useId } from 'vue';

defineProps({
  compact: { type: Boolean, default: false }
});

const gradientId = useId();
</script>

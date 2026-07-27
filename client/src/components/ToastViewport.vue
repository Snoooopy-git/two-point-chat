<template>
  <div class="toast-viewport" aria-live="polite" aria-atomic="true">
    <TransitionGroup name="toast">
      <div
        v-for="toast in uiStore.toasts"
        :key="toast.id"
        class="toast-message"
        :class="`toast-${toast.tone}`"
        role="status"
      >
        <span class="toast-indicator"></span>
        <span>{{ toast.message }}</span>
        <button type="button" aria-label="关闭提示" @click="uiStore.dismiss(toast.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { useUiStore } from '../stores/ui.js';

const uiStore = useUiStore();
</script>

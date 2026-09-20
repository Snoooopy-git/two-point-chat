<template>
  <aside
    class="utility-rail"
    :class="{ open }"
    aria-label="日历与桌面宠物"
    :aria-hidden="!open"
    :inert="!open"
  >
    <header class="utility-rail-header">
      <div>
        <span class="eyebrow">MY SPACE</span>
        <strong>我的角落</strong>
      </div>
      <button type="button" class="icon-button utility-close" aria-label="关闭工具面板" @click="$emit('close')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </header>
    <MiniCalendar />
    <DesktopPet />
  </aside>
</template>

<script setup>
import DesktopPet from './DesktopPet.vue';
import MiniCalendar from './MiniCalendar.vue';

defineProps({
  open: {
    type: Boolean,
    default: false
  }
});

defineEmits(['close']);
</script>

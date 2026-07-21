<template>
  <div v-if="visible">
    <div class="emoji-picker-overlay" @click.stop="$emit('close')"></div>
    <div class="emoji-picker-panel">
      <emoji-picker
        locale="zh"
        data-source="/emoji-data.json"
        @emoji-click="onEmojiClick"
      ></emoji-picker>
    </div>
  </div>
</template>

<script setup>
import 'emoji-picker-element';

defineProps({
  visible: { type: Boolean, default: false }
});

const emit = defineEmits(['select', 'close']);

function onEmojiClick(e) {
  const emoji = e.detail?.unicode;
  if (emoji) {
    emit('select', emoji);
  }
}
</script>

<style scoped>
.emoji-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
}

.emoji-picker-panel {
  position: fixed;
  bottom: 80px;
  right: 20px;
  z-index: 101;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  max-height: 420px;
}
</style>

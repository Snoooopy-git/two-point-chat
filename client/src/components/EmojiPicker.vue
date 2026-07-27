<template>
  <div v-if="visible">
    <div class="emoji-picker-overlay" @click.stop="$emit('close')"></div>
    <div class="emoji-picker-panel" role="dialog" aria-label="选择表情">
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

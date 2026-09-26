<template>
  <Teleport to="body">
    <div v-if="visible">
      <div class="emoji-picker-overlay" @click.stop="$emit('close')"></div>
      <div
        ref="panelRef"
        class="emoji-picker-panel"
        :style="panelStyle"
        role="dialog"
        aria-label="选择表情"
      >
        <emoji-picker
          locale="zh"
          data-source="/emoji-data.json"
          @emoji-click="onEmojiClick"
        ></emoji-picker>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import 'emoji-picker-element';

const props = defineProps({
  visible: { type: Boolean, default: false },
  anchorElement: { type: Object, default: null }
});

const emit = defineEmits(['select', 'close']);
const panelRef = ref(null);
const panelStyle = ref({ visibility: 'hidden' });

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

async function positionPanel() {
  if (!props.visible) return;
  panelStyle.value = { visibility: 'hidden' };
  await nextTick();
  const anchor = props.anchorElement?.getBoundingClientRect?.();
  const panel = panelRef.value?.getBoundingClientRect();
  if (!anchor || !panel) return;

  const margin = 16;
  const gap = 12;
  const left = clamp(anchor.left, margin, window.innerWidth - panel.width - margin);
  const preferredTop = anchor.top - panel.height - gap;
  const top = preferredTop >= margin
    ? preferredTop
    : clamp(anchor.bottom + gap, margin, window.innerHeight - panel.height - margin);

  panelStyle.value = {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    visibility: 'visible'
  };
}

watch(() => props.visible, visible => {
  if (visible) positionPanel();
}, { immediate: true });

window.addEventListener('resize', positionPanel);
onBeforeUnmount(() => window.removeEventListener('resize', positionPanel));

function onEmojiClick(e) {
  const emoji = e.detail?.unicode;
  if (emoji) {
    emit('select', emoji);
  }
}
</script>

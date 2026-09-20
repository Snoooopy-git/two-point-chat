<template>
  <section
    ref="stageRef"
    class="pet-stage"
    aria-label="跳跳信使桌面宠物"
    @pointerdown="recordActivity"
    @pointermove="handlePointerMove"
  >
    <header class="pet-stage-header">
      <span class="pet-status">{{ statusLabel }}</span>
    </header>

    <div class="pet-ground" aria-hidden="true"></div>
    <button
      ref="petRef"
      type="button"
      class="desktop-pet"
      :class="{ dragging, mirrored, sleeping: action === 'sleep-transition' }"
      :style="petStyle"
      aria-label="和跳跳信使互动"
      @click="handleClick"
      @pointerdown.stop="startDrag"
      @pointermove.stop="handlePointerMove"
      @pointerup.stop="endDrag"
      @pointercancel.stop="endDrag"
      @mouseenter="handlePointerEnter"
      @mouseleave="handlePointerLeave"
    ></button>
    <p class="pet-hint">点击、轻拖，或等它自己逛一逛</p>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useChatStore } from '../stores/chat.js';
import { getPetFrameInterval, getPetFrameSequence, petAtlases } from '../utils/petAssets.js';

const chatStore = useChatStore();
const stageRef = ref(null);
const petRef = ref(null);
const action = ref('idle-breathe');
const frame = ref(0);
const dragging = ref(false);
const mirrored = ref(false);
const position = ref({ x: 150, y: 235 });
const reducedMotion = ref(false);

let currentPriority = 0;
let actionTimer = null;
let frameTimer = null;
let sleepTimer = null;
let walkTimer = null;
let resizeObserver = null;
let motionQuery = null;
let preloadHandle = null;
let dragPointerId = null;
let dragStart = null;
let suppressClick = false;
let lastClickAt = 0;
let frameStep = 0;
let frameLoopActive = false;
const preloadedAtlases = [];
const nonLoopingActions = new Set(['new-message-alert', 'sleep-transition']);

const statusLabels = {
  'click-reaction': '被你逗到了',
  'drag-held': '被抱起来了',
  'happy-hop': '心情很好',
  'idle-breathe': '悠闲待机',
  'new-message-alert': '有新消息',
  'pointer-follow': '正在看你',
  'response-complete': '收到回复',
  'sleep-transition': '睡着了',
  typing: '陪你等回复',
  'waiting-reply': '等待回信',
  'walk-cycle': '四处走走',
  'wave-hello': '向你问好'
};

const statusLabel = computed(() => statusLabels[action.value]);
const petStyle = computed(() => {
  const column = frame.value % 4;
  const row = Math.floor(frame.value / 4);
  return {
    left: `${position.value.x}px`,
    top: `${position.value.y}px`,
    backgroundImage: `url("${petAtlases[action.value]}")`,
    backgroundPosition: `${column * 33.333333}% ${row * 100}%`
  };
});

function baseAction() {
  if (chatStore.typingUsers[chatStore.activeContactId]) return 'typing';
  return 'idle-breathe';
}

function playAction(name, { duration = 0, priority = 10 } = {}) {
  if (priority < currentPriority) return;
  window.clearTimeout(actionTimer);
  action.value = name;
  frame.value = 0;
  frameStep = 0;
  currentPriority = priority;
  if (duration > 0) {
    actionTimer = window.setTimeout(() => resetAction(priority), duration);
  }
}

function resetAction(priority = currentPriority) {
  if (priority < currentPriority || dragging.value) return;
  window.clearTimeout(actionTimer);
  currentPriority = 0;
  action.value = baseAction();
  frame.value = 0;
  frameStep = 0;
}

function recordActivity() {
  if (action.value === 'sleep-transition') resetAction();
  window.clearTimeout(sleepTimer);
  if (!reducedMotion.value) {
    sleepTimer = window.setTimeout(() => {
      if (!dragging.value && action.value === 'idle-breathe') {
        playAction('sleep-transition', { priority: 5 });
      }
    }, 60000);
  }
}

function handlePointerEnter() {
  recordActivity();
  if (!dragging.value) playAction('pointer-follow', { priority: 15 });
}

function handlePointerLeave() {
  if (!dragging.value && action.value === 'pointer-follow') resetAction(15);
}

function handleClick() {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  recordActivity();
  const now = Date.now();
  const isRapidClick = now - lastClickAt < 480;
  lastClickAt = now;
  playAction(isRapidClick ? 'click-reaction' : 'wave-hello', {
    duration: isRapidClick ? 1100 : 1300,
    priority: 50
  });
}

function startDrag(event) {
  if (event.button !== 0) return;
  recordActivity();
  dragging.value = true;
  dragPointerId = event.pointerId;
  dragStart = { x: event.clientX, y: event.clientY };
  suppressClick = false;
  event.currentTarget.setPointerCapture(event.pointerId);
  playAction('drag-held', { priority: 100 });
}

function handlePointerMove(event) {
  if (!dragging.value || event.pointerId !== dragPointerId || !stageRef.value) return;
  const rect = stageRef.value.getBoundingClientRect();
  const moved = Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y);
  if (moved > 5) suppressClick = true;
  position.value = clampPosition(event.clientX - rect.left, event.clientY - rect.top);
}

function endDrag(event) {
  if (!dragging.value || event.pointerId !== dragPointerId) return;
  dragging.value = false;
  dragPointerId = null;
  event.currentTarget.releasePointerCapture?.(event.pointerId);
  currentPriority = 0;
  playAction('happy-hop', { duration: 900, priority: 40 });
}

function clampPosition(x, y) {
  const rect = stageRef.value?.getBoundingClientRect();
  if (!rect) return { x, y };
  const petRadius = (petRef.value?.offsetWidth || 136) / 2;
  const horizontalMargin = Math.min(petRadius, rect.width / 2);
  return {
    x: Math.min(Math.max(x, horizontalMargin), rect.width - horizontalMargin),
    y: Math.min(Math.max(y, Math.max(128, petRadius)), rect.height - Math.min(petRadius, 68))
  };
}

function resetPosition() {
  if (!stageRef.value) return;
  const rect = stageRef.value.getBoundingClientRect();
  position.value = clampPosition(rect.width / 2, rect.height - 76);
}

function takeWalk() {
  if (reducedMotion.value || dragging.value || action.value !== 'idle-breathe' || !stageRef.value) return;
  const rect = stageRef.value.getBoundingClientRect();
  const nextX = Math.max(68, Math.min(rect.width - 68, 68 + Math.random() * (rect.width - 136)));
  mirrored.value = nextX < position.value.x;
  playAction('walk-cycle', { duration: 2800, priority: 5 });
  position.value = { ...position.value, x: nextX };
}

function handleReducedMotion(event) {
  reducedMotion.value = event.matches;
  frame.value = 0;
  recordActivity();
}

function preloadAtlases() {
  Object.values(petAtlases).forEach((source) => {
    const image = new Image();
    image.src = source;
    preloadedAtlases.push(image);
  });
}

function advanceFrame() {
  if (reducedMotion.value || dragging.value) return;
  if (nonLoopingActions.has(action.value) && frame.value === 7) return;
  const sequence = getPetFrameSequence(action.value);
  frameStep = (frameStep + 1) % sequence.length;
  frame.value = sequence[frameStep];
}

function scheduleNextFrame() {
  window.clearTimeout(frameTimer);
  if (!frameLoopActive) return;
  frameTimer = window.setTimeout(() => {
    advanceFrame();
    scheduleNextFrame();
  }, getPetFrameInterval(action.value));
}

watch(() => chatStore.incomingMessageSignal, () => {
  recordActivity();
  playAction('new-message-alert', { duration: 1050, priority: 90 });
});

watch(() => chatStore.outgoingMessageSignal, () => {
  recordActivity();
  playAction('waiting-reply', { duration: 4200, priority: 30 });
});

watch(() => chatStore.typingUsers[chatStore.activeContactId], (isTyping) => {
  if (isTyping) playAction('typing', { priority: 35 });
  else if (action.value === 'typing') resetAction(35);
});

watch(action, () => {
  frameStep = 0;
  scheduleNextFrame();
});

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion.value = motionQuery.matches;
  motionQuery.addEventListener('change', handleReducedMotion);
  frameLoopActive = true;
  scheduleNextFrame();
  walkTimer = window.setInterval(takeWalk, 18000);
  resizeObserver = new ResizeObserver(() => {
    position.value = clampPosition(position.value.x, position.value.y);
  });
  resizeObserver.observe(stageRef.value);
  resetPosition();
  recordActivity();
  preloadHandle = window.requestIdleCallback
    ? window.requestIdleCallback(preloadAtlases, { timeout: 1500 })
    : window.setTimeout(preloadAtlases, 600);
});

onBeforeUnmount(() => {
  frameLoopActive = false;
  window.clearTimeout(actionTimer);
  window.clearTimeout(sleepTimer);
  window.clearTimeout(frameTimer);
  window.clearInterval(walkTimer);
  if (window.cancelIdleCallback && preloadHandle !== null) window.cancelIdleCallback(preloadHandle);
  else window.clearTimeout(preloadHandle);
  resizeObserver?.disconnect();
  motionQuery?.removeEventListener('change', handleReducedMotion);
  preloadedAtlases.length = 0;
});
</script>

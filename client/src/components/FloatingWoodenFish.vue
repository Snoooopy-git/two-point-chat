<template>
  <Teleport to="body">
    <button
      ref="fishRef"
      type="button"
      class="floating-wooden-fish"
      :class="{ dragging, striking }"
      :style="fishStyle"
      aria-label="敲击木鱼，拖动可调整位置"
      title="敲木鱼 · 运气 +1"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerCancel"
      @keydown="handleKeydown"
    >
      <span
        v-for="effect in luckEffects"
        :key="effect.id"
        class="wooden-fish-feedback"
        :style="{ '--effect-offset': `${effect.offset}px` }"
        aria-hidden="true"
      >
        <span class="wooden-fish-ripple ripple-one"></span>
        <span class="wooden-fish-ripple ripple-two"></span>
        <span class="wooden-fish-luck">运气 +1</span>
      </span>

      <span class="wooden-fish-art" aria-hidden="true">
        <img class="wooden-fish-body" :src="woodenFishBody" alt="">
        <img class="wooden-fish-mallet" :src="woodenFishMallet" alt="">
        <span class="wooden-fish-impact"></span>
      </span>
    </button>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import woodenFishBody from '../assets/wooden-fish/wooden-fish-body.png';
import woodenFishMallet from '../assets/wooden-fish/wooden-fish-mallet.png';
import {
  clampFloatingPosition,
  normalizeFloatingPosition,
  restoreFloatingPosition
} from '../utils/floatingPosition.js';

const storageKey = 'two-point-floating-wooden-fish-position';
const dragThreshold = 5;
const keyboardStep = 14;

const fishRef = ref(null);
const position = ref({ x: 0, y: 0 });
const dragging = ref(false);
const striking = ref(false);
const luckEffects = ref([]);

let activePointerId = null;
let pointerStart = null;
let effectSequence = 0;
let strikeTimer = null;
let audioContext = null;
const effectTimers = new Set();

const fishStyle = computed(() => ({
  transform: `translate3d(${position.value.x}px, ${position.value.y}px, 0)`
}));

function viewportSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function itemSize() {
  const bounds = fishRef.value?.getBoundingClientRect();
  return {
    width: bounds?.width || 132,
    height: bounds?.height || 112
  };
}

function defaultPosition() {
  const viewport = viewportSize();
  const item = itemSize();
  const desktopRailAllowance = viewport.width >= 1200 ? 340 : 20;

  return clampFloatingPosition({
    x: viewport.width - desktopRailAllowance - item.width - 24,
    y: viewport.height - item.height - 112
  }, viewport, item);
}

function readSavedPosition() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) {
      return restoreFloatingPosition(saved, viewportSize(), itemSize());
    }
  } catch {
    return defaultPosition();
  }
  return defaultPosition();
}

function persistPosition() {
  const normalized = normalizeFloatingPosition(position.value, viewportSize(), itemSize());
  try {
    localStorage.setItem(storageKey, JSON.stringify(normalized));
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

function handleResize() {
  position.value = clampFloatingPosition(position.value, viewportSize(), itemSize());
  persistPosition();
}

function handlePointerDown(event) {
  if (activePointerId !== null) return;
  activePointerId = event.pointerId;
  pointerStart = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    originX: position.value.x,
    originY: position.value.y
  };
  dragging.value = false;
  fishRef.value?.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function handlePointerMove(event) {
  if (event.pointerId !== activePointerId || !pointerStart) return;
  const deltaX = event.clientX - pointerStart.pointerX;
  const deltaY = event.clientY - pointerStart.pointerY;

  if (!dragging.value && Math.hypot(deltaX, deltaY) >= dragThreshold) {
    dragging.value = true;
  }
  if (!dragging.value) return;

  position.value = clampFloatingPosition({
    x: pointerStart.originX + deltaX,
    y: pointerStart.originY + deltaY
  }, viewportSize(), itemSize());
}

function finishPointer(event, shouldStrike) {
  if (event.pointerId !== activePointerId) return;
  if (fishRef.value?.hasPointerCapture(event.pointerId)) {
    fishRef.value.releasePointerCapture(event.pointerId);
  }
  const wasDragging = dragging.value;
  activePointerId = null;
  pointerStart = null;
  dragging.value = false;

  if (wasDragging) persistPosition();
  else if (shouldStrike) strike();
}

function handlePointerUp(event) {
  finishPointer(event, true);
}

function handlePointerCancel(event) {
  finishPointer(event, false);
}

function handleKeydown(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    strike();
    return;
  }

  const deltas = {
    ArrowLeft: [-keyboardStep, 0],
    ArrowRight: [keyboardStep, 0],
    ArrowUp: [0, -keyboardStep],
    ArrowDown: [0, keyboardStep]
  };
  const delta = deltas[event.key];
  if (!delta) return;
  event.preventDefault();
  position.value = clampFloatingPosition({
    x: position.value.x + delta[0],
    y: position.value.y + delta[1]
  }, viewportSize(), itemSize());
  persistPosition();
}

function playWoodenKnock() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ||= new AudioContextClass();
  const duration = 0.075;
  const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (Math.random() * 2 - 1) * Math.exp(-index / (audioContext.sampleRate * 0.016));
  }
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();
  filter.type = 'bandpass';
  filter.frequency.value = 720;
  filter.Q.value = 1.8;
  gain.gain.value = 0.12;
  source.buffer = buffer;
  source.connect(filter).connect(gain).connect(audioContext.destination);
  source.start();
}

function strike() {
  clearTimeout(strikeTimer);
  striking.value = false;
  requestAnimationFrame(() => {
    striking.value = true;
    strikeTimer = setTimeout(() => {
      striking.value = false;
    }, 560);
  });

  const id = ++effectSequence;
  const effect = { id, offset: ((id % 3) - 1) * 10 };
  luckEffects.value = [...luckEffects.value.slice(-3), effect];
  const effectTimer = setTimeout(() => {
    luckEffects.value = luckEffects.value.filter(item => item.id !== id);
    effectTimers.delete(effectTimer);
  }, 900);
  effectTimers.add(effectTimer);
  playWoodenKnock();
}

onMounted(async () => {
  await nextTick();
  position.value = readSavedPosition();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  clearTimeout(strikeTimer);
  effectTimers.forEach(timer => clearTimeout(timer));
  effectTimers.clear();
  window.removeEventListener('resize', handleResize);
  audioContext?.close();
});
</script>

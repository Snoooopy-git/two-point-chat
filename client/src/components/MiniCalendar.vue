<template>
  <section class="mini-calendar" aria-label="日历">
    <header class="calendar-header">
      <div>
        <span class="eyebrow">CALENDAR</span>
        <h2>{{ monthLabel }}</h2>
      </div>
      <div class="calendar-actions">
        <button type="button" aria-label="上个月" @click="changeMonth(-1)">‹</button>
        <button type="button" class="calendar-today" @click="goToday">今天</button>
        <button type="button" aria-label="下个月" @click="changeMonth(1)">›</button>
      </div>
    </header>

    <div class="calendar-weekdays" aria-hidden="true">
      <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
    </div>
    <div class="calendar-grid">
      <button
        v-for="item in days"
        :key="item.key"
        type="button"
        class="calendar-day"
        :class="{
          muted: !item.inCurrentMonth,
          today: item.isToday,
          selected: item.key === selectedKey
        }"
        :aria-label="formatAccessibleDate(item.date)"
        :aria-current="item.isToday ? 'date' : undefined"
        :aria-pressed="item.key === selectedKey"
        @click="selectDay(item)"
      >
        {{ item.day }}
      </button>
    </div>
    <p class="calendar-selection">{{ selectedLabel }}</p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { buildCalendarDays, toDateKey } from '../utils/calendar.js';

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
const today = new Date();
const visibleMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1, 12));
const selectedKey = ref(toDateKey(today));
const selectedDate = ref(new Date(today));

const monthLabel = computed(() => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long'
}).format(visibleMonth.value));
const days = computed(() => buildCalendarDays(
  visibleMonth.value.getFullYear(),
  visibleMonth.value.getMonth(),
  today
));
const selectedLabel = computed(() => new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long'
}).format(selectedDate.value));

function changeMonth(offset) {
  visibleMonth.value = new Date(
    visibleMonth.value.getFullYear(),
    visibleMonth.value.getMonth() + offset,
    1,
    12
  );
}

function goToday() {
  visibleMonth.value = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  selectedDate.value = new Date(today);
  selectedKey.value = toDateKey(today);
}

function selectDay(item) {
  selectedDate.value = new Date(item.date);
  selectedKey.value = item.key;
  if (!item.inCurrentMonth) {
    visibleMonth.value = new Date(item.date.getFullYear(), item.date.getMonth(), 1, 12);
  }
}

function formatAccessibleDate(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }).format(date);
}
</script>

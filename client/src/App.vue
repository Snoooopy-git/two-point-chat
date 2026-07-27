<template>
  <router-view />
  <ToastViewport />
</template>

<script setup>
import { watch, onMounted } from 'vue';
import { useChatStore } from './stores/chat.js';
import { requestNotificationPermission } from './utils/notifications.js';
import ToastViewport from './components/ToastViewport.vue';

const chatStore = useChatStore();

onMounted(() => {
  // 请求浏览器通知权限
  requestNotificationPermission();
});

// 动态更新页面标题（显示未读消息数）
watch(() => chatStore.totalUnread, (count) => {
  document.title = count > 0 ? `(${count}) two-point` : 'two-point';
}, { immediate: true });
</script>

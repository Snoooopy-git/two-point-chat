<template>
  <router-view />
</template>

<script setup>
import { watch, onMounted } from 'vue';
import { useChatStore } from './stores/chat.js';
import { requestNotificationPermission } from './utils/notifications.js';

const chatStore = useChatStore();

onMounted(() => {
  // 初始化全局 socket 监听器（只执行一次）
  chatStore.initSocketListeners();

  // 请求浏览器通知权限
  requestNotificationPermission();
});

// 动态更新页面标题（显示未读消息数）
watch(() => chatStore.totalUnread, (count) => {
  document.title = count > 0 ? `(${count}) 双点聊天` : '双点聊天';
}, { immediate: true });
</script>

<template>
  <section class="chat-page">
    <header class="chat-header">
      <button type="button" class="mobile-back" aria-label="返回消息列表" @click="goBack">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <div class="header-avatar">
        {{ contactAvatar }}
        <i v-if="chatStore.activeContact?.online" class="online-dot"></i>
      </div>
      <div class="header-info">
        <strong>{{ chatStore.activeContact?.username || '正在加载' }}</strong>
        <span v-if="chatStore.typingUsers[chatStore.activeContactId]" class="typing-indicator">
          正在输入<span>...</span>
        </span>
        <span v-else>{{ chatStore.activeContact?.online ? '在线' : '离线' }}</span>
      </div>
    </header>

    <div ref="messageListRef" class="message-list">
      <div class="message-list-inner">
        <button
          v-if="chatStore.activeHistoryCursor"
          type="button"
          class="btn-load-older"
          @click="loadOlder"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 12 4-4 4 4m-4-4v9" /></svg>
          加载更早消息
        </button>

        <div v-if="chatStore.activeMessages.length === 0" class="empty-chat">
          <div class="empty-chat-mark">
            <span>{{ contactAvatar }}</span>
            <i></i>
            <span>{{ myAvatar }}</span>
          </div>
          <h2>这是你们对话的起点</h2>
          <p>发送一条消息，向 {{ chatStore.activeContact?.username || '对方' }} 打个招呼。</p>
        </div>

        <div
          v-for="msg in chatStore.activeMessages"
          :key="msg.id"
          class="message-row"
          :class="{ 'row-self': isSelf(msg) }"
        >
          <div v-if="!isSelf(msg)" class="msg-avatar">{{ contactAvatar }}</div>
          <div class="message-wrapper" :class="{ 'message-self': isSelf(msg) }">
            <div v-if="msg.type === 'text'" class="message-bubble">
              {{ msg.content }}
            </div>
            <button
              v-else-if="msg.type === 'image'"
              type="button"
              class="message-bubble message-image"
              aria-label="预览图片"
              @click="previewImage(msg.file_url || msg.content)"
            >
              <img
                :src="msg.file_url || msg.content"
                alt="聊天图片"
                class="chat-image"
                loading="lazy"
              />
            </button>
            <div class="message-meta">
              <time>{{ formatTime(msg.created_at) }}</time>
              <span v-if="msg._temp" class="sending-state">发送中</span>
              <span
                v-else-if="isSelf(msg) && !msg._error"
                class="read-state"
                :class="{ 'read-state-done': msg.read }"
              >
                {{ msg.read ? '已读' : '未读' }}
              </span>
              <button
                v-if="msg._error"
                type="button"
                class="message-error"
                :title="msg._errorMessage"
                @click="retryMessage(msg.client_message_id)"
              >
                发送失败 · 重试
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer class="chat-composer">
      <div class="composer-shell">
        <ImageUpload @uploaded="handleImageUploaded" />
        <button
          type="button"
          class="composer-icon"
          :class="{ active: showEmoji }"
          title="选择表情"
          aria-label="选择表情"
          :aria-expanded="showEmoji"
          @click="showEmoji = !showEmoji"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 14.5s1.2 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01" />
          </svg>
        </button>
        <EmojiPicker
          :visible="showEmoji"
          @select="insertEmoji"
          @close="showEmoji = false"
        />
        <textarea
          ref="inputRef"
          v-model="inputText"
          class="text-input"
          placeholder="写一条消息…"
          rows="1"
          aria-label="消息内容"
          @keydown.enter.exact.prevent="handleSendText"
          @input="handleTyping"
        ></textarea>
        <button
          type="button"
          class="btn-send"
          :disabled="!inputText.trim()"
          aria-label="发送消息"
          @click="handleSendText"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m4 4 17 8-17 8 3-8-3-8Z" />
            <path d="M7 12h14" />
          </svg>
        </button>
      </div>
      <div class="composer-hint">Enter 发送 · Shift + Enter 换行</div>
    </footer>

    <div
      v-if="previewUrl"
      class="image-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      @click.self="previewUrl = null"
    >
      <button type="button" aria-label="关闭图片预览" @click="previewUrl = null">×</button>
      <img :src="previewUrl" alt="预览图片" class="preview-image" />
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useChatStore } from '../stores/chat.js';
import { useUiStore } from '../stores/ui.js';
import { getSocket } from '../utils/socket.js';
import ImageUpload from '../components/ImageUpload.vue';
import EmojiPicker from '../components/EmojiPicker.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const chatStore = useChatStore();
const uiStore = useUiStore();

const inputText = ref('');
const messageListRef = ref(null);
const inputRef = ref(null);
const previewUrl = ref(null);
const showEmoji = ref(false);

let typingTimer = null;
let socket = null;

const myAvatar = computed(() => (authStore.user?.username || '我')[0].toUpperCase());
const contactAvatar = computed(() => (chatStore.activeContact?.username || '?')[0].toUpperCase());

function isSelf(msg) {
  return msg.sender_id === 'self' || msg.sender_id === authStore.user?.id;
}

async function openRouteChat(userIdValue) {
  const userId = Number.parseInt(userIdValue, 10);
  if (!Number.isInteger(userId)) {
    router.replace('/contacts');
    return;
  }
  showEmoji.value = false;
  inputText.value = '';
  await chatStore.openChat(userId);
  await nextTick();
  scrollToBottom();
  inputRef.value?.focus();
}

function handleTypingEvent(data) {
  if (data.from === chatStore.activeContactId) {
    chatStore.setTyping(data.from);
  }
}

function handleStopTypingEvent(data) {
  if (data.from === chatStore.activeContactId) {
    chatStore.clearTyping(data.from);
  }
}

function handleEscape(event) {
  if (event.key === 'Escape') {
    previewUrl.value = null;
    showEmoji.value = false;
  }
}

onMounted(() => {
  socket = getSocket();
  socket?.on('typing', handleTypingEvent);
  socket?.on('stop_typing', handleStopTypingEvent);
  window.addEventListener('keydown', handleEscape);
});

onUnmounted(() => {
  clearTimeout(typingTimer);
  chatStore.activeContactId = null;
  socket?.off('typing', handleTypingEvent);
  socket?.off('stop_typing', handleStopTypingEvent);
  window.removeEventListener('keydown', handleEscape);
});

watch(() => route.params.userId, openRouteChat, { immediate: true });

watch(() => chatStore.activeMessages.length, () => {
  nextTick(scrollToBottom);
});

function scrollToBottom() {
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
  }
}

function handleSendText() {
  const content = inputText.value.trim();
  if (!content) return;
  if (!chatStore.sendTextMessage(content)) {
    uiStore.notify('连接尚未建立，请稍后重试', 'error');
    return;
  }
  inputText.value = '';
  showEmoji.value = false;
  nextTick(scrollToBottom);
  socket?.emit('stop_typing', { to: chatStore.activeContactId });
}

function handleTyping() {
  if (!socket || !chatStore.activeContactId) return;
  socket.emit('typing', { to: chatStore.activeContactId });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket?.emit('stop_typing', { to: chatStore.activeContactId });
  }, 2000);
}

function insertEmoji(emoji) {
  const element = inputRef.value;
  if (!element) {
    inputText.value += emoji;
    return;
  }
  const start = element.selectionStart;
  const end = element.selectionEnd;
  inputText.value = inputText.value.slice(0, start) + emoji + inputText.value.slice(end);
  nextTick(() => {
    element.focus();
    element.selectionStart = element.selectionEnd = start + emoji.length;
  });
}

function handleImageUploaded(fileUrl) {
  if (!chatStore.sendImageMessage(fileUrl)) {
    uiStore.notify('连接尚未建立，请稍后重试', 'error');
    return;
  }
  nextTick(scrollToBottom);
}

function retryMessage(clientMessageId) {
  if (!chatStore.retryMessage(clientMessageId)) {
    uiStore.notify('暂时无法重试，请检查连接', 'error');
  }
}

async function loadOlder() {
  const list = messageListRef.value;
  const previousHeight = list?.scrollHeight || 0;
  await chatStore.loadOlderMessages();
  await nextTick();
  if (list) {
    list.scrollTop += list.scrollHeight - previousHeight;
  }
}

function previewImage(url) {
  previewUrl.value = url;
}

function goBack() {
  router.push('/contacts');
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const time = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  if (date.toDateString() === now.toDateString()) return time;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
}
</script>

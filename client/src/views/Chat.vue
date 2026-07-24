<template>
  <div class="chat-page">
    <!-- 顶部导航 -->
    <header class="chat-header">
      <button class="btn-back" @click="goBack">← 返回</button>
      <div class="header-avatar">{{ contactAvatar }}</div>
      <div class="header-info">
        <div class="header-name">
          {{ chatStore.activeContact?.username || '加载中...' }}
          <span v-if="chatStore.activeContact?.online" class="online-status">在线</span>
          <span v-else class="offline-status">离线</span>
        </div>
        <div v-if="chatStore.typingUsers[chatStore.activeContactId]" class="typing-indicator">
          对方正在输入...
        </div>
      </div>
    </header>

    <!-- 消息列表 -->
    <div class="message-list" ref="messageListRef">
      <button
        v-if="chatStore.activeHistoryCursor"
        class="btn-load-older"
        @click="loadOlder"
      >
        加载更早消息
      </button>
      <div v-if="chatStore.activeMessages.length === 0" class="empty-chat">
        <p>开始你们的聊天吧！</p>
        <p class="empty-hint">发送一条消息打个招呼</p>
      </div>
      <div
        v-for="msg in chatStore.activeMessages"
        :key="msg.id"
        class="message-row"
        :class="{ 'row-self': isSelf(msg) }"
      >
        <!-- 对方消息：头像在左 -->
        <div v-if="!isSelf(msg)" class="msg-avatar">{{ contactAvatar }}</div>

        <div
          class="message-wrapper"
          :class="{ 'message-self': isSelf(msg) }"
        >
          <!-- 文字消息 -->
          <div v-if="msg.type === 'text'" class="message-bubble">
            {{ msg.content }}
          </div>
          <!-- 图片消息 -->
          <div v-else-if="msg.type === 'image'" class="message-bubble message-image">
            <img
              :src="msg.file_url || msg.content"
              alt="图片"
              class="chat-image"
              @click="previewImage(msg.file_url || msg.content)"
              loading="lazy"
            />
          </div>
          <div class="message-time">
            {{ formatTime(msg.created_at) }}
            <span v-if="msg._temp"> · 发送中</span>
            <button
              v-if="msg._error"
              class="message-error"
              :title="msg._errorMessage"
              @click="chatStore.retryMessage(msg.client_message_id)"
            >
              发送失败，点击重试
            </button>
          </div>
        </div>

        <!-- 自己消息：头像在右 -->
        <div v-if="isSelf(msg)" class="msg-avatar msg-avatar-self">{{ myAvatar }}</div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="chat-input-bar">
      <ImageUpload @uploaded="handleImageUploaded" />
      <button class="btn-emoji" @click="showEmoji = !showEmoji" title="表情">
        😊
      </button>
      <EmojiPicker
        :visible="showEmoji"
        @select="insertEmoji"
        @close="showEmoji = false"
      />
      <textarea
        v-model="inputText"
        class="text-input"
        placeholder="输入消息..."
        rows="1"
        @keydown.enter.exact.prevent="handleSendText"
        @input="handleTyping"
        ref="inputRef"
      ></textarea>
      <button
        class="btn-send"
        :disabled="!inputText.trim()"
        @click="handleSendText"
      >
        发送
      </button>
    </div>

    <!-- 图片预览弹窗 -->
    <div v-if="previewUrl" class="image-preview-overlay" @click="previewUrl = null">
      <img :src="previewUrl" alt="预览" class="preview-image" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useChatStore } from '../stores/chat.js';
import { getSocket } from '../utils/socket.js';
import ImageUpload from '../components/ImageUpload.vue';
import EmojiPicker from '../components/EmojiPicker.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const chatStore = useChatStore();

const inputText = ref('');
const messageListRef = ref(null);
const inputRef = ref(null);
const previewUrl = ref(null);
const showEmoji = ref(false);

let typingTimer = null;

// 头像：取用户名的首字
const myAvatar = computed(() => (authStore.user?.username || '我')[0].toUpperCase());
const contactAvatar = computed(() => (chatStore.activeContact?.username || '?')[0].toUpperCase());

function isSelf(msg) {
  return msg.sender_id === 'self' || msg.sender_id === authStore.user?.id;
}

onMounted(async () => {
  const userId = parseInt(route.params.userId);
  await chatStore.openChat(userId);

  const socket = getSocket();
  if (socket) {
    socket.on('typing', (data) => {
      if (data.from === userId) {
        chatStore.setTyping(data.from);
      }
    });
    socket.on('stop_typing', (data) => {
      if (data.from === userId) {
        chatStore.clearTyping(data.from);
      }
    });
  }

  await nextTick();
  scrollToBottom();
  inputRef.value?.focus();
});

onUnmounted(() => {
  chatStore.activeContactId = null;

  const socket = getSocket();
  if (socket) {
    socket.off('typing');
    socket.off('stop_typing');
  }
});

watch(() => chatStore.activeMessages.length, () => {
  nextTick(() => scrollToBottom());
});

function scrollToBottom() {
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
  }
}

function handleSendText() {
  if (!inputText.value.trim()) return;
  const sent = chatStore.sendTextMessage(inputText.value.trim());
  if (!sent) return;
  inputText.value = '';
  showEmoji.value = false;
  nextTick(() => scrollToBottom());

  const socket = getSocket();
  if (socket && chatStore.activeContactId) {
    socket.emit('stop_typing', { to: chatStore.activeContactId });
  }
}

function handleTyping() {
  const socket = getSocket();
  if (socket && chatStore.activeContactId) {
    socket.emit('typing', { to: chatStore.activeContactId });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      socket.emit('stop_typing', { to: chatStore.activeContactId });
    }, 2000);
  }
}

function insertEmoji(emoji) {
  const el = inputRef.value;
  if (!el) {
    inputText.value += emoji;
    return;
  }
  const start = el.selectionStart;
  const end = el.selectionEnd;
  inputText.value = inputText.value.slice(0, start) + emoji + inputText.value.slice(end);
  // 恢复光标位置
  nextTick(() => {
    el.focus();
    el.selectionStart = el.selectionEnd = start + emoji.length;
  });
}

function handleImageUploaded(fileUrl) {
  if (!chatStore.sendImageMessage(fileUrl)) {
    alert('连接尚未建立，请稍后重试');
    return;
  }
  nextTick(() => scrollToBottom());
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
  const isToday = date.toDateString() === now.toDateString();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  if (isToday) {
    return `${hours}:${minutes}`;
  }
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 700px;
  margin: 0 auto;
  background: #f5f5f5;
}

.chat-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.btn-back {
  background: rgba(255,255,255,0.2);
  color: #fff;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.header-avatar {
  width: 38px;
  height: 38px;
  background: rgba(255,255,255,0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 700;
  flex-shrink: 0;
}

.header-info {
  flex: 1;
}

.header-name {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.online-status {
  font-size: 12px;
  background: rgba(46,204,113,0.3);
  padding: 2px 8px;
  border-radius: 10px;
}

.offline-status {
  font-size: 12px;
  background: rgba(255,255,255,0.2);
  padding: 2px 8px;
  border-radius: 10px;
}

.typing-indicator {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 4px;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-chat {
  text-align: center;
  margin-top: 60px;
  color: #999;
}

.empty-hint {
  font-size: 13px;
  color: #bbb;
  margin-top: 8px;
}

.btn-load-older {
  align-self: center;
  border: none;
  border-radius: 14px;
  padding: 6px 14px;
  color: #667eea;
  background: #fff;
  cursor: pointer;
}

/* 消息行：头像 + 气泡 */
.message-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.row-self {
  justify-content: flex-end;
}

/* 消息小头像 */
.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

.msg-avatar-self {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.message-wrapper {
  display: flex;
  flex-direction: column;
  max-width: 65%;
}

.message-self {
  align-items: flex-end;
}

.message-bubble {
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 15px;
  line-height: 1.5;
  word-break: break-word;
}

.message-row:not(.row-self) .message-bubble {
  background: #fff;
  border-bottom-left-radius: 4px;
}

.message-self .message-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.message-image {
  padding: 4px;
  overflow: hidden;
}

.message-image img {
  max-width: 240px;
  max-height: 320px;
  border-radius: 12px;
  cursor: pointer;
  display: block;
}

.message-time {
  font-size: 11px;
  color: #bbb;
  margin-top: 4px;
  padding: 0 4px;
}

.message-self .message-time {
  text-align: right;
}

.message-error {
  border: none;
  padding: 0;
  background: transparent;
  color: #ff4757;
  cursor: pointer;
  font-size: inherit;
}

.chat-input-bar {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 16px;
  background: #fff;
  border-top: 1px solid #eee;
  flex-shrink: 0;
  position: relative;
}

.btn-emoji {
  background: none;
  border: none;
  font-size: 22px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  flex-shrink: 0;
}

.text-input {
  flex: 1;
  padding: 10px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  resize: none;
  max-height: 100px;
  font-family: inherit;
}

.text-input:focus {
  border-color: #667eea;
}

.btn-send {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.btn-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 图片预览 */
.image-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  cursor: pointer;
  padding: 20px;
}

.preview-image {
  max-width: 90%;
  max-height: 90%;
  border-radius: 8px;
  object-fit: contain;
}
</style>

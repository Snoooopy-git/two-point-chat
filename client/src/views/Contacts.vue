<template>
  <div class="contacts-page">
    <!-- 顶部导航 -->
    <header class="app-header">
      <h2>🎯 双点聊天</h2>
      <div class="header-right">
        <span class="user-name">{{ authStore.user?.username }}</span>
        <button class="btn-logout" @click="handleLogout">退出</button>
      </div>
    </header>

    <!-- 添加好友区域 -->
    <div class="add-friend-section">
      <form @submit.prevent="handleSearch" class="search-form">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索用户添加好友..."
          class="search-input"
          @input="handleSearchInput"
        />
        <button type="submit" class="btn-search">搜索</button>
      </form>

      <!-- 搜索结果 -->
      <div v-if="chatStore.searchResults.length > 0" class="search-results">
        <div
          v-for="user in chatStore.searchResults"
          :key="user.id"
          class="search-item"
        >
          <span>{{ user.username }}</span>
          <button class="btn-add" @click="handleAddFriend(user.id)">添加好友</button>
        </div>
      </div>
      <div v-if="searchQuery && searchDone && chatStore.searchResults.length === 0" class="search-empty">
        未找到用户
      </div>
    </div>

    <!-- 管理员入口 -->
    <div v-if="authStore.isAdmin" class="admin-entry">
      <button class="btn-admin" @click="$router.push('/admin')">⚙️ 后台管理</button>
    </div>

    <!-- 好友列表 -->
    <div class="contacts-section">
      <h3 class="section-title">我的好友 ({{ chatStore.contacts.length }})</h3>
      <div v-if="chatStore.contacts.length === 0" class="empty-list">
        <p>还没有好友，搜索并添加吧！</p>
      </div>
      <div class="contact-list">
        <div
          v-for="contact in chatStore.sortedContacts"
          :key="contact.id"
          class="contact-item"
          @click="openChat(contact.id)"
        >
          <div class="contact-avatar">
            <span class="avatar-text">{{ contact.username[0].toUpperCase() }}</span>
            <span v-if="contact.online" class="online-dot"></span>
          </div>
          <div class="contact-info">
            <div class="contact-name">{{ contact.username }}</div>
            <div class="contact-last-msg" v-if="contact.lastMessage">
              {{ contact.lastMessage.type === 'image' ? '📷 图片' : contact.lastMessage.content }}
            </div>
          </div>
          <div v-if="chatStore.unreadCounts[contact.id]" class="unread-badge">
            {{ chatStore.unreadCounts[contact.id] > 99 ? '99+' : chatStore.unreadCounts[contact.id] }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useChatStore } from '../stores/chat.js';

const router = useRouter();
const authStore = useAuthStore();
const chatStore = useChatStore();

const searchQuery = ref('');
const searchDone = ref(false);

let searchTimer = null;

onMounted(async () => {
  await chatStore.fetchContacts();
});

function handleSearchInput() {
  clearTimeout(searchTimer);
  searchDone.value = false;
  searchTimer = setTimeout(() => {
    if (searchQuery.value.trim()) {
      chatStore.searchUsers(searchQuery.value.trim());
      searchDone.value = true;
    }
  }, 300);
}

function handleSearch(e) {
  e.preventDefault();
  if (searchQuery.value.trim()) {
    chatStore.searchUsers(searchQuery.value.trim());
    searchDone.value = true;
  }
}

async function handleAddFriend(userId) {
  try {
    await chatStore.addFriend(userId);
    alert('添加好友成功！');
    searchQuery.value = '';
    chatStore.searchResults = [];
    searchDone.value = false;
  } catch (err) {
    alert(err.message);
  }
}

function openChat(userId) {
  router.push(`/chat/${userId}`);
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.contacts-page {
  max-width: 600px;
  margin: 0 auto;
  min-height: 100vh;
  background: #f5f5f5;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-header h2 {
  margin: 0;
  font-size: 20px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-name {
  font-size: 14px;
  opacity: 0.9;
}

.btn-logout {
  background: rgba(255,255,255,0.2);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.3);
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.add-friend-section {
  padding: 16px 20px;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.search-form {
  display: flex;
  gap: 8px;
}

.search-input {
  flex: 1;
  padding: 10px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
  outline: none;
}

.search-input:focus {
  border-color: #667eea;
}

.btn-search {
  padding: 10px 20px;
  background: #667eea;
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}

.search-results {
  margin-top: 12px;
  border: 1px solid #eee;
  border-radius: 10px;
  overflow: hidden;
}

.search-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: #fafafa;
  border-bottom: 1px solid #eee;
}

.search-item:last-child {
  border-bottom: none;
}

.search-empty {
  margin-top: 12px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.btn-add {
  padding: 6px 14px;
  background: #2ecc71;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.section-title {
  padding: 16px 20px 8px;
  font-size: 14px;
  color: #999;
  margin: 0;
}

.admin-entry {
  padding: 10px 20px;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.btn-admin {
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
}

.empty-list {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.contact-list {
  padding: 0 20px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: #fff;
  border-radius: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: transform 0.1s;
}

.contact-item:hover {
  transform: translateX(2px);
}

.contact-avatar {
  position: relative;
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-text {
  color: #fff;
  font-size: 20px;
  font-weight: 700;
}

.online-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 12px;
  height: 12px;
  background: #2ecc71;
  border-radius: 50%;
  border: 2px solid #fff;
}

.contact-info {
  flex: 1;
  min-width: 0;
}

.contact-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.contact-last-msg {
  font-size: 13px;
  color: #999;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 未读消息徽章 */
.unread-badge {
  background: #ff4757;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  flex-shrink: 0;
}
</style>

<template>
  <main class="workspace-shell" :class="{ 'conversation-open': route.name === 'Chat' }">
    <aside class="workspace-sidebar">
      <header class="sidebar-header">
        <BrandLogo />
        <ThemeToggle />
      </header>

      <div class="sidebar-account">
        <div class="user-avatar">
          {{ userAvatar }}
          <i class="user-online-dot"></i>
        </div>
        <div class="account-copy">
          <strong>{{ authStore.user?.username }}</strong>
          <span><i class="presence-dot"></i> 我的账号 · 在线</span>
        </div>
        <div class="account-actions">
          <button
            v-if="authStore.isAdmin"
            type="button"
            class="icon-button"
            title="后台管理"
            aria-label="后台管理"
            @click="router.push('/admin')"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20.3h-3v-.08a1.7 1.7 0 0 0-1.03-1.56A1.7 1.7 0 0 0 8.8 19l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7.02 15a1.7 1.7 0 0 0-1.56-1.03H5.4v-3h.06A1.7 1.7 0 0 0 7.02 9.94a1.7 1.7 0 0 0-.34-1.88L6.62 8l2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56V4.7h3v.02a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 8l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.04v3h-.04A1.7 1.7 0 0 0 19.4 15Z" />
            </svg>
          </button>
          <button
            type="button"
            class="icon-button"
            title="退出登录"
            aria-label="退出登录"
            @click="handleLogout"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />
            </svg>
          </button>
        </div>
      </div>

      <section class="contact-search">
        <form class="search-form" @submit.prevent="handleSearch">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="搜索并添加朋友"
            aria-label="搜索并添加朋友"
            @input="handleSearchInput"
          />
          <button type="submit" :disabled="!searchQuery.trim()">搜索</button>
        </form>

        <div v-if="showSearchPanel" class="search-panel">
          <div class="search-panel-label">搜索结果</div>
          <button
            v-for="user in chatStore.searchResults"
            :key="user.id"
            type="button"
            class="search-result"
            @click="handleAddFriend(user.id)"
          >
            <span class="mini-avatar">{{ user.username[0].toUpperCase() }}</span>
            <span>{{ user.username }}</span>
            <strong>添加</strong>
          </button>
          <div v-if="searchDone && chatStore.searchResults.length === 0" class="search-empty">
            没有找到匹配的用户
          </div>
        </div>
      </section>

      <section class="contacts-section">
        <div class="section-heading">
          <div>
            <span class="eyebrow">CONVERSATIONS</span>
            <h2>消息</h2>
          </div>
          <span class="contact-count">{{ chatStore.contacts.length }}</span>
        </div>

        <div v-if="chatStore.contacts.length === 0" class="sidebar-empty">
          <div class="empty-symbol">＋</div>
          <strong>还没有朋友</strong>
          <span>在上方搜索用户名，开始第一段对话。</span>
        </div>

        <nav v-else class="contact-list" aria-label="会话列表">
          <button
            v-for="contact in chatStore.sortedContacts"
            :key="contact.id"
            type="button"
            class="contact-item"
            :class="{ active: chatStore.activeContactId === contact.id }"
            @click="openChat(contact.id)"
          >
            <span class="contact-avatar">
              {{ contact.username[0].toUpperCase() }}
              <i v-if="contact.online" class="online-dot"></i>
            </span>
            <span class="contact-info">
              <span class="contact-row">
                <strong>{{ contact.username }}</strong>
                <time v-if="contact.lastMessage">{{ formatContactTime(contact.lastMessage.created_at) }}</time>
              </span>
              <span class="contact-row">
                <span class="contact-last-message">
                  {{ contact.lastMessage ? formatPreview(contact.lastMessage) : '还没有消息' }}
                </span>
                <span v-if="chatStore.unreadCounts[contact.id]" class="unread-badge">
                  {{ chatStore.unreadCounts[contact.id] > 99 ? '99+' : chatStore.unreadCounts[contact.id] }}
                </span>
              </span>
            </span>
          </button>
        </nav>
      </section>

      <footer class="sidebar-footer">
        <span>two-point 0.3.1</span>
        <span>两点之间，保持连接</span>
      </footer>
    </aside>

    <section class="workspace-content">
      <router-view />
    </section>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useChatStore } from '../stores/chat.js';
import { useUiStore } from '../stores/ui.js';
import BrandLogo from '../components/BrandLogo.vue';
import ThemeToggle from '../components/ThemeToggle.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const chatStore = useChatStore();
const uiStore = useUiStore();

const searchQuery = ref('');
const searchDone = ref(false);
const showSearchPanel = computed(() =>
  Boolean(searchQuery.value.trim()) && (searchDone.value || chatStore.searchResults.length > 0)
);
const userAvatar = computed(() => (authStore.user?.username || 'U')[0].toUpperCase());

let searchTimer = null;

onMounted(async () => {
  await chatStore.fetchContacts();
});

onBeforeUnmount(() => {
  clearTimeout(searchTimer);
});

function handleSearchInput() {
  clearTimeout(searchTimer);
  searchDone.value = false;
  if (!searchQuery.value.trim()) {
    chatStore.searchResults = [];
    return;
  }
  searchTimer = setTimeout(async () => {
    await chatStore.searchUsers(searchQuery.value.trim());
    searchDone.value = true;
  }, 300);
}

async function handleSearch() {
  if (!searchQuery.value.trim()) return;
  clearTimeout(searchTimer);
  await chatStore.searchUsers(searchQuery.value.trim());
  searchDone.value = true;
}

async function handleAddFriend(userId) {
  try {
    await chatStore.addFriend(userId);
    uiStore.notify('好友已添加，可以开始聊天了', 'success');
    searchQuery.value = '';
    chatStore.searchResults = [];
    searchDone.value = false;
  } catch (error) {
    uiStore.notify(error.message, 'error');
  }
}

function openChat(userId) {
  router.push(`/chat/${userId}`);
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

function formatPreview(message) {
  return message.type === 'image' ? '发送了一张图片' : message.content;
}

function formatContactTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
</script>

<template>
  <main
    class="workspace-shell"
    :class="{
      'conversation-open': route.name === 'Chat',
      'utility-open': utilityOpen
    }"
  >
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

      <section class="contacts-section">
        <div class="section-heading">
          <div>
            <span class="eyebrow">CONVERSATIONS</span>
            <h2>消息</h2>
          </div>
          <div class="section-heading-actions">
            <button
              type="button"
              class="add-friend-button"
              aria-label="添加好友和查看好友申请"
              title="添加好友"
              @click="friendDialogOpen = true"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span v-if="chatStore.incomingRequestCount" class="request-count-badge">
                {{ chatStore.incomingRequestCount > 99 ? '99+' : chatStore.incomingRequestCount }}
              </span>
            </button>
            <span class="contact-count">{{ chatStore.contacts.length }}</span>
          </div>
        </div>

        <div v-if="chatStore.contacts.length === 0" class="sidebar-empty">
          <div class="empty-symbol">＋</div>
          <strong>还没有朋友</strong>
          <span>点击消息标题旁的加号，添加第一位朋友。</span>
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
        <span>two-point {{ appVersion }}</span>
        <span>两点之间，保持连接</span>
      </footer>
    </aside>

    <section class="workspace-content">
      <router-view />
    </section>

    <button
      type="button"
      class="utility-toggle"
      aria-label="打开日历和桌面宠物"
      :aria-expanded="utilityOpen"
      @click="utilityOpen = !utilityOpen"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5.5" width="16" height="14" rx="3" />
        <path d="M8 3.5v4M16 3.5v4M4 10h16" />
      </svg>
      <span v-if="chatStore.totalUnread" class="utility-signal"></span>
    </button>
    <button
      v-if="utilityOpen"
      type="button"
      class="utility-backdrop"
      aria-label="关闭工具面板"
      @click="utilityOpen = false"
    ></button>
    <UtilityRail :open="utilityOpen" @close="utilityOpen = false" />

    <FriendRequestDialog v-if="friendDialogOpen" @close="friendDialogOpen = false" />
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useChatStore } from '../stores/chat.js';
import BrandLogo from '../components/BrandLogo.vue';
import FriendRequestDialog from '../components/FriendRequestDialog.vue';
import ThemeToggle from '../components/ThemeToggle.vue';
import UtilityRail from '../components/UtilityRail.vue';
import { version as appVersion } from '../../package.json';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const chatStore = useChatStore();
const friendDialogOpen = ref(false);
const utilityPreferenceKey = 'two-point-utility-panel-open';
const desktopUtilityQuery = window.matchMedia('(min-width: 1200px)');
const isDesktopUtility = ref(desktopUtilityQuery.matches);
const utilityOpen = ref(
  desktopUtilityQuery.matches && localStorage.getItem(utilityPreferenceKey) !== 'false'
);
const userAvatar = computed(() => (authStore.user?.username || 'U')[0].toUpperCase());

onMounted(async () => {
  window.addEventListener('keydown', handleEscape);
  desktopUtilityQuery.addEventListener('change', handleUtilityBreakpointChange);
  await Promise.all([chatStore.fetchContacts(), chatStore.fetchFriendRequests()]);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape);
  desktopUtilityQuery.removeEventListener('change', handleUtilityBreakpointChange);
});

watch(utilityOpen, value => {
  if (isDesktopUtility.value) localStorage.setItem(utilityPreferenceKey, String(value));
});

function handleUtilityBreakpointChange(event) {
  isDesktopUtility.value = event.matches;
  utilityOpen.value = event.matches
    ? localStorage.getItem(utilityPreferenceKey) !== 'false'
    : false;
}

function handleEscape(event) {
  if (event.key === 'Escape') utilityOpen.value = false;
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

<template>
  <Teleport to="body">
    <div class="friend-dialog-backdrop" @mousedown.self="closeDialog">
      <section
        class="friend-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-dialog-title"
      >
        <header class="friend-dialog-header">
          <div>
            <span class="eyebrow">CONNECTIONS</span>
            <h2 id="friend-dialog-title">添加朋友</h2>
          </div>
          <button type="button" class="icon-button" aria-label="关闭" @click="closeDialog">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div class="friend-dialog-tabs" role="tablist" aria-label="好友功能">
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'search'"
            :class="{ active: activeTab === 'search' }"
            @click="activeTab = 'search'"
          >
            添加好友
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeTab === 'requests'"
            :class="{ active: activeTab === 'requests' }"
            @click="activeTab = 'requests'"
          >
            好友申请
            <span v-if="chatStore.incomingRequestCount" class="request-tab-badge">
              {{ chatStore.incomingRequestCount > 99 ? '99+' : chatStore.incomingRequestCount }}
            </span>
          </button>
        </div>

        <div v-if="activeTab === 'search'" class="friend-dialog-body" role="tabpanel">
          <form class="friend-search-form" @submit.prevent="runSearch">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="search"
              maxlength="50"
              placeholder="输入用户名"
              aria-label="搜索用户名"
              @input="scheduleSearch"
            />
            <button type="submit" :disabled="!searchQuery.trim()">搜索</button>
          </form>

          <div class="friend-results" aria-live="polite">
            <article v-for="user in chatStore.searchResults" :key="user.id" class="friend-person-row">
              <span class="mini-avatar">{{ user.username[0].toUpperCase() }}</span>
              <div class="friend-person-copy">
                <strong>{{ user.username }}</strong>
                <span>{{ relationshipText(user.relationship) }}</span>
              </div>
              <button
                v-if="user.relationship === 'none'"
                type="button"
                class="friend-primary-action"
                :disabled="busyId === user.id"
                @click="sendRequest(user.id)"
              >
                {{ busyId === user.id ? '发送中' : '添加' }}
              </button>
              <button
                v-else-if="user.relationship === 'incoming_pending'"
                type="button"
                class="friend-secondary-action"
                @click="activeTab = 'requests'"
              >
                去处理
              </button>
              <span v-else class="friend-status-pill">
                {{ user.relationship === 'friend' ? '已是好友' : '等待通过' }}
              </span>
            </article>
            <div v-if="searchDone && chatStore.searchResults.length === 0" class="friend-empty-state">
              没有找到匹配的用户
            </div>
            <div v-else-if="!searchQuery.trim()" class="friend-empty-state">
              搜索用户名，向对方发送好友申请。
            </div>
          </div>
        </div>

        <div v-else class="friend-dialog-body friend-request-lists" role="tabpanel">
          <section>
            <div class="friend-list-heading">
              <strong>收到的申请</strong>
              <span>{{ chatStore.incomingFriendRequests.length }}</span>
            </div>
            <article
              v-for="request in chatStore.incomingFriendRequests"
              :key="request.id"
              class="friend-person-row"
            >
              <span class="mini-avatar">{{ request.user.username[0].toUpperCase() }}</span>
              <div class="friend-person-copy">
                <strong>{{ request.user.username }}</strong>
                <span>希望添加你为好友</span>
              </div>
              <div class="friend-row-actions">
                <button
                  type="button"
                  class="friend-secondary-action"
                  :disabled="busyId === request.id"
                  @click="removeRequest(request.id, 'reject')"
                >拒绝</button>
                <button
                  type="button"
                  class="friend-primary-action"
                  :disabled="busyId === request.id"
                  @click="acceptRequest(request.id)"
                >通过</button>
              </div>
            </article>
            <div v-if="chatStore.incomingFriendRequests.length === 0" class="friend-empty-state compact">
              暂无待处理申请
            </div>
          </section>

          <section>
            <div class="friend-list-heading">
              <strong>已发送</strong>
              <span>{{ chatStore.outgoingFriendRequests.length }}</span>
            </div>
            <article
              v-for="request in chatStore.outgoingFriendRequests"
              :key="request.id"
              class="friend-person-row"
            >
              <span class="mini-avatar">{{ request.user.username[0].toUpperCase() }}</span>
              <div class="friend-person-copy">
                <strong>{{ request.user.username }}</strong>
                <span>等待对方通过</span>
              </div>
              <button
                type="button"
                class="friend-secondary-action"
                :disabled="busyId === request.id"
                @click="removeRequest(request.id, 'cancel')"
              >取消</button>
            </article>
            <div v-if="chatStore.outgoingFriendRequests.length === 0" class="friend-empty-state compact">
              暂无等待中的申请
            </div>
          </section>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useChatStore } from '../stores/chat.js';
import { useUiStore } from '../stores/ui.js';

const emit = defineEmits(['close']);
const chatStore = useChatStore();
const uiStore = useUiStore();
const activeTab = ref('search');
const searchQuery = ref('');
const searchDone = ref(false);
const busyId = ref(null);
const searchInput = ref(null);
let searchTimer = null;

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown);
  chatStore.searchResults = [];
  await chatStore.fetchFriendRequests();
  await nextTick();
  searchInput.value?.focus();
});

onBeforeUnmount(() => {
  clearTimeout(searchTimer);
  window.removeEventListener('keydown', handleGlobalKeydown);
  chatStore.searchResults = [];
});

function handleGlobalKeydown(event) {
  if (event.key === 'Escape') closeDialog();
}

function closeDialog() {
  emit('close');
}

function scheduleSearch() {
  clearTimeout(searchTimer);
  searchDone.value = false;
  if (!searchQuery.value.trim()) {
    chatStore.searchResults = [];
    return;
  }
  searchTimer = setTimeout(runSearch, 300);
}

async function runSearch() {
  if (!searchQuery.value.trim()) return;
  clearTimeout(searchTimer);
  await chatStore.searchUsers(searchQuery.value.trim());
  searchDone.value = true;
}

function relationshipText(relationship) {
  return {
    friend: '你们已经是好友',
    outgoing_pending: '申请正在等待对方处理',
    incoming_pending: '对方已向你发送申请',
    none: '可以发送好友申请'
  }[relationship] || '';
}

async function sendRequest(userId) {
  busyId.value = userId;
  try {
    const result = await chatStore.sendFriendRequest(userId);
    uiStore.notify(result.message, 'success');
  } catch (error) {
    uiStore.notify(error.message, 'error');
  } finally {
    busyId.value = null;
  }
}

async function acceptRequest(requestId) {
  busyId.value = requestId;
  try {
    await chatStore.acceptFriendRequest(requestId);
    uiStore.notify('好友申请已通过', 'success');
  } catch (error) {
    uiStore.notify(error.message, 'error');
  } finally {
    busyId.value = null;
  }
}

async function removeRequest(requestId, action) {
  busyId.value = requestId;
  try {
    await chatStore.removeFriendRequest(requestId);
    uiStore.notify(action === 'cancel' ? '好友申请已取消' : '好友申请已拒绝');
  } catch (error) {
    uiStore.notify(error.message, 'error');
  } finally {
    busyId.value = null;
  }
}
</script>

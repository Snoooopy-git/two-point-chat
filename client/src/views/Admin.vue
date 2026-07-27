<template>
  <main class="admin-page">
    <header class="admin-topbar">
      <BrandLogo />
      <div class="admin-topbar-actions">
        <ThemeToggle />
        <button type="button" class="secondary-button" @click="router.push('/contacts')">
          返回消息
        </button>
      </div>
    </header>

    <section class="admin-content">
      <div class="admin-heading">
        <div>
          <span class="eyebrow">ADMINISTRATION</span>
          <h1>用户管理</h1>
          <p>管理账号状态与权限。高风险操作会在执行前再次确认。</p>
        </div>
        <div class="admin-stat">
          <strong>{{ users.length }}</strong>
          <span>注册用户</span>
        </div>
      </div>

      <div v-if="loading" class="admin-loading">
        <span class="button-spinner"></span>
        正在加载用户
      </div>

      <div v-else class="user-table-wrap">
        <table class="user-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>用户</th>
              <th>角色</th>
              <th>状态</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id" :class="{ 'row-disabled': user.status === 'disabled' }">
              <td data-label="ID">{{ user.id }}</td>
              <td data-label="用户">
                <div class="table-user">
                  <span>{{ user.username[0].toUpperCase() }}</span>
                  <strong>{{ user.username }}</strong>
                </div>
              </td>
              <td data-label="角色">
                <span class="status-badge" :class="user.role === 'admin' ? 'badge-admin' : 'badge-neutral'">
                  {{ user.role === 'admin' ? '管理员' : '普通用户' }}
                </span>
              </td>
              <td data-label="状态">
                <span class="status-badge" :class="user.status === 'active' ? 'badge-active' : 'badge-disabled'">
                  {{ user.status === 'active' ? '正常' : '已禁用' }}
                </span>
              </td>
              <td data-label="注册时间" class="time-cell">{{ formatDate(user.created_at) }}</td>
              <td data-label="操作">
                <div v-if="user.id !== authStore.user?.id" class="table-actions">
                  <button
                    type="button"
                    class="table-action"
                    :class="user.status === 'active' ? 'action-warning' : 'action-positive'"
                    @click="toggleStatus(user)"
                  >
                    {{ user.status === 'active' ? '禁用' : '启用' }}
                  </button>
                  <button
                    type="button"
                    class="table-action"
                    @click="setRole(user, user.role === 'admin' ? 'user' : 'admin')"
                  >
                    {{ user.role === 'admin' ? '取消管理员' : '设为管理员' }}
                  </button>
                  <button type="button" class="table-action" @click="clearChat(user)">清理聊天</button>
                  <button
                    v-if="user.role !== 'admin'"
                    type="button"
                    class="table-action action-danger"
                    @click="deleteUser(user)"
                  >
                    删除
                  </button>
                </div>
                <span v-else class="current-user-label">当前账号</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useUiStore } from '../stores/ui.js';
import { api } from '../utils/api.js';
import BrandLogo from '../components/BrandLogo.vue';
import ThemeToggle from '../components/ThemeToggle.vue';

const router = useRouter();
const authStore = useAuthStore();
const uiStore = useUiStore();
const users = ref([]);
const loading = ref(true);

onMounted(fetchUsers);

async function fetchUsers() {
  try {
    const data = await api.get('/api/admin/users');
    users.value = data.users;
  } catch (error) {
    uiStore.notify(`获取用户列表失败：${error.message}`, 'error');
  } finally {
    loading.value = false;
  }
}

async function toggleStatus(user) {
  const newStatus = user.status === 'active' ? 'disabled' : 'active';
  const label = newStatus === 'active' ? '启用' : '禁用';
  if (!window.confirm(`确定要${label}用户「${user.username}」吗？`)) return;
  try {
    await api.put(`/api/admin/users/${user.id}/status`, { status: newStatus });
    user.status = newStatus;
    uiStore.notify(`已${label}用户 ${user.username}`, 'success');
  } catch (error) {
    uiStore.notify(`操作失败：${error.message}`, 'error');
  }
}

async function setRole(user, role) {
  const label = role === 'admin' ? '设为管理员' : '取消管理员';
  if (!window.confirm(`确定要${label}「${user.username}」吗？`)) return;
  try {
    await api.put(`/api/admin/users/${user.id}/role`, { role });
    user.role = role;
    uiStore.notify(`已${label}`, 'success');
  } catch (error) {
    uiStore.notify(`操作失败：${error.message}`, 'error');
  }
}

async function deleteUser(user) {
  if (!window.confirm(`确定要删除用户「${user.username}」吗？\n此操作将同时删除其好友关系和所有聊天记录，不可恢复！`)) return;
  try {
    await api.delete(`/api/admin/users/${user.id}`);
    users.value = users.value.filter(item => item.id !== user.id);
    uiStore.notify(`用户 ${user.username} 已删除`, 'success');
  } catch (error) {
    uiStore.notify(`删除失败：${error.message}`, 'error');
  }
}

async function clearChat(user) {
  if (!window.confirm(`确定要清理用户「${user.username}」的聊天记录吗？\n数据库记录将保留，仅隐藏前端展示。`)) return;
  try {
    const data = await api.post(`/api/admin/users/${user.id}/clear-chat`);
    uiStore.notify(data.message, 'success');
  } catch (error) {
    uiStore.notify(`操作失败：${error.message}`, 'error');
  }
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('zh-CN');
}
</script>

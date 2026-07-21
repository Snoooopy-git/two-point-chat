<template>
  <div class="admin-page">
    <header class="admin-header">
      <button class="btn-back" @click="$router.push('/contacts')">← 返回</button>
      <h2>后台管理</h2>
      <span class="user-count">{{ users.length }} 个用户</span>
    </header>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else class="user-table-wrap">
      <table class="user-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>角色</th>
            <th>状态</th>
            <th>注册时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" :class="{ 'row-disabled': u.status === 'disabled' }">
            <td>{{ u.id }}</td>
            <td>{{ u.username }}</td>
            <td>
              <span :class="u.role === 'admin' ? 'badge-admin' : 'badge-user'">
                {{ u.role === 'admin' ? '管理员' : '普通用户' }}
              </span>
            </td>
            <td>
              <span :class="u.status === 'active' ? 'badge-active' : 'badge-disabled'">
                {{ u.status === 'active' ? '正常' : '已禁用' }}
              </span>
            </td>
            <td class="time-cell">{{ formatDate(u.created_at) }}</td>
            <td class="action-cell">
              <button
                v-if="u.id !== authStore.user?.id"
                class="btn-action"
                :class="u.status === 'active' ? 'btn-warn' : 'btn-ok'"
                @click="toggleStatus(u)"
              >
                {{ u.status === 'active' ? '禁用' : '启用' }}
              </button>
              <button
                v-if="u.id !== authStore.user?.id && u.role !== 'admin'"
                class="btn-action btn-ok"
                @click="setRole(u, 'admin')"
              >
                设为管理员
              </button>
              <button
                v-if="u.id !== authStore.user?.id && u.role === 'admin'"
                class="btn-action btn-warn"
                @click="setRole(u, 'user')"
              >
                取消管理员
              </button>
              <button
                v-if="u.id !== authStore.user?.id"
                class="btn-action btn-clear"
                @click="clearChat(u)"
              >
                清理聊天
              </button>
              <button
                v-if="u.id !== authStore.user?.id && u.role !== 'admin'"
                class="btn-action btn-danger"
                @click="deleteUser(u)"
              >
                删除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth.js';
import { api } from '../utils/api.js';

const authStore = useAuthStore();
const users = ref([]);
const loading = ref(true);

onMounted(() => {
  fetchUsers();
});

async function fetchUsers() {
  try {
    const data = await api.get('/api/admin/users');
    users.value = data.users;
  } catch (err) {
    alert('获取用户列表失败: ' + err.message);
  } finally {
    loading.value = false;
  }
}

async function toggleStatus(u) {
  const newStatus = u.status === 'active' ? 'disabled' : 'active';
  if (!confirm(`确定要${newStatus === 'active' ? '启用' : '禁用'}用户「${u.username}」吗？`)) return;
  try {
    await api.put(`/api/admin/users/${u.id}/status`, { status: newStatus });
    u.status = newStatus;
  } catch (err) {
    alert('操作失败: ' + err.message);
  }
}

async function setRole(u, role) {
  const label = role === 'admin' ? '设为管理员' : '取消管理员';
  if (!confirm(`确定要${label}「${u.username}」吗？`)) return;
  try {
    await api.put(`/api/admin/users/${u.id}/role`, { role });
    u.role = role;
  } catch (err) {
    alert('操作失败: ' + err.message);
  }
}

async function deleteUser(u) {
  if (!confirm(`确定要删除用户「${u.username}」吗？\n此操作将同时删除其好友关系和所有聊天记录，不可恢复！`)) return;
  try {
    await api.delete(`/api/admin/users/${u.id}`);
    users.value = users.value.filter(x => x.id !== u.id);
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
}

async function clearChat(u) {
  if (!confirm(`确定要清理用户「${u.username}」的聊天记录吗？\n数据库记录将保留，仅隐藏前端展示。`)) return;
  try {
    const data = await api.post(`/api/admin/users/${u.id}/clear-chat`);
    alert(data.message);
  } catch (err) {
    alert('操作失败: ' + err.message);
  }
}

function formatDate(t) {
  if (!t) return '';
  return new Date(t).toLocaleString('zh-CN');
}
</script>

<style scoped>
.admin-page {
  max-width: 900px;
  margin: 0 auto;
  min-height: 100vh;
  background: #f5f5f5;
}

.admin-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.admin-header h2 {
  margin: 0;
  font-size: 20px;
  flex: 1;
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

.user-count {
  font-size: 13px;
  opacity: 0.8;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #999;
}

.user-table-wrap {
  overflow-x: auto;
  padding: 16px;
}

.user-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  font-size: 14px;
}

.user-table th {
  background: #f8f9fa;
  padding: 12px 14px;
  text-align: left;
  font-weight: 600;
  color: #666;
  border-bottom: 2px solid #eee;
  white-space: nowrap;
}

.user-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f0f0f0;
}

.row-disabled td {
  opacity: 0.5;
}

.badge-admin { background: #667eea; color: #fff; padding: 2px 10px; border-radius: 10px; font-size: 12px; }
.badge-user { background: #e0e0e0; color: #666; padding: 2px 10px; border-radius: 10px; font-size: 12px; }
.badge-active { background: #e8f5e9; color: #2e7d32; padding: 2px 10px; border-radius: 10px; font-size: 12px; }
.badge-disabled { background: #ffebee; color: #c62828; padding: 2px 10px; border-radius: 10px; font-size: 12px; }

.time-cell { white-space: nowrap; color: #999; font-size: 12px; }

.action-cell {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.btn-action {
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

.btn-ok { background: #667eea; color: #fff; }
.btn-warn { background: #ff9800; color: #fff; }
.btn-danger { background: #ff4757; color: #fff; }
.btn-clear { background: #95a5a6; color: #fff; }
</style>

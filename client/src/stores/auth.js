import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../utils/api.js';
import { connectSocket, disconnectSocket, startSocket } from '../utils/socket.js';
import { useChatStore } from './chat.js';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const token = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const isAuthenticated = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  // 连接 socket 后立即初始化聊天监听器
  function _setupSocket(tokenValue) {
    const socket = connectSocket(tokenValue);
    useChatStore().initSocketListeners(socket);
    socket.once('session_revoked', () => {
      logout();
      window.location.assign('/login');
    });
    startSocket();
  }

  // 初始化：从 localStorage 恢复 token
  function init() {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      token.value = savedToken;
      user.value = JSON.parse(savedUser);
      _setupSocket(savedToken);
    }
  }

  async function login(username, password) {
    loading.value = true;
    error.value = null;
    try {
      const data = await api.post('/api/auth/login', { username, password });
      token.value = data.token;
      user.value = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      _setupSocket(data.token);
      return true;
    } catch (err) {
      error.value = err.message;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function register(username, password) {
    loading.value = true;
    error.value = null;
    try {
      const data = await api.post('/api/auth/register', { username, password });
      token.value = data.token;
      user.value = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      _setupSocket(data.token);
      return true;
    } catch (err) {
      error.value = err.message;
      return false;
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    useChatStore().resetState();
    disconnectSocket();
    user.value = null;
    token.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  return { user, token, loading, error, isAuthenticated, isAdmin, init, login, register, logout };
});

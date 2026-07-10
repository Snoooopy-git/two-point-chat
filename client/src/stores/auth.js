import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../utils/api.js';
import { connectSocket, disconnectSocket } from '../utils/socket.js';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const token = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const isAuthenticated = computed(() => !!token.value);

  // 初始化：从 localStorage 恢复 token
  function init() {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      token.value = savedToken;
      user.value = JSON.parse(savedUser);
      connectSocket(savedToken);
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
      connectSocket(data.token);
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
      connectSocket(data.token);
      return true;
    } catch (err) {
      error.value = err.message;
      return false;
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    user.value = null;
    token.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectSocket();
  }

  return { user, token, loading, error, isAuthenticated, init, login, register, logout };
});

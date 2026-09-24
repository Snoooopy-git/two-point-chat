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
  const initialized = ref(false);
  const sessionExpired = ref(false);
  let sessionExpiredHandler = null;

  const isAuthenticated = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  // 连接 socket 后立即初始化聊天监听器
  function _setupSocket(tokenValue) {
    const socket = connectSocket(tokenValue);
    useChatStore().initSocketListeners(socket);
    socket.once('session_revoked', () => {
      expireSession();
    });
    socket.on('connect_error', socketError => {
      if (['未登录', '登录已过期', '账号不存在或已被禁用'].includes(socketError.message)) {
        expireSession();
      }
    });
    startSocket();
  }

  // 初始化：从 localStorage 恢复 token
  async function init() {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      try {
        user.value = JSON.parse(savedUser);
      } catch {
        clearSession();
        initialized.value = true;
        return;
      }
      try {
        token.value = savedToken;
        const data = await api.get('/api/auth/me');
        user.value = data.user;
        localStorage.setItem('user', JSON.stringify(data.user));
        _setupSocket(savedToken);
      } catch (initError) {
        if (initError.status !== 401) {
          error.value = '暂时无法验证登录状态，请检查网络后重试';
          _setupSocket(savedToken);
        }
      }
    } else if (savedToken || savedUser) {
      clearSession();
    }
    initialized.value = true;
  }

  function clearSession() {
    useChatStore().resetState();
    disconnectSocket();
    user.value = null;
    token.value = null;
    error.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  function expireSession() {
    const hadSession = Boolean(token.value || localStorage.getItem('token'));
    clearSession();
    if (!hadSession) return;
    sessionExpired.value = true;
    sessionExpiredHandler?.();
  }

  function onSessionExpired(handler) {
    sessionExpiredHandler = typeof handler === 'function' ? handler : null;
  }

  async function login(username, password) {
    loading.value = true;
    error.value = null;
    sessionExpired.value = false;
    try {
      const data = await api.post('/api/auth/login', { username, password });
      token.value = data.token;
      user.value = data.user;
      sessionExpired.value = false;
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
    sessionExpired.value = false;
    try {
      const data = await api.post('/api/auth/register', { username, password });
      token.value = data.token;
      user.value = data.user;
      sessionExpired.value = false;
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
    sessionExpired.value = false;
    clearSession();
  }

  return {
    user,
    token,
    loading,
    error,
    initialized,
    sessionExpired,
    isAuthenticated,
    isAdmin,
    init,
    login,
    register,
    logout,
    expireSession,
    onSessionExpired
  };
});

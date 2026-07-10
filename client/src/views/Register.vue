<template>
  <div class="auth-container">
    <div class="auth-card">
      <h1 class="auth-title">🎯 双点聊天</h1>
      <p class="auth-subtitle">创建新账号</p>

      <div v-if="authStore.error" class="auth-error">{{ authStore.error }}</div>
      <div v-if="validationError" class="auth-error">{{ validationError }}</div>

      <form @submit.prevent="handleRegister" class="auth-form">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="2-20 个字符"
            required
            autocomplete="username"
          />
        </div>
        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="至少 4 位"
            required
            autocomplete="new-password"
          />
        </div>
        <div class="form-group">
          <label for="confirmPassword">确认密码</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            placeholder="再次输入密码"
            required
            autocomplete="new-password"
          />
        </div>
        <button type="submit" class="btn-primary" :disabled="authStore.loading">
          {{ authStore.loading ? '注册中...' : '注册' }}
        </button>
      </form>

      <p class="auth-link">
        已有账号？
        <router-link to="/login">立即登录</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const router = useRouter();
const authStore = useAuthStore();

const username = ref('');
const password = ref('');
const confirmPassword = ref('');
const validationError = ref('');

async function handleRegister() {
  validationError.value = '';

  if (username.value.length < 2 || username.value.length > 20) {
    validationError.value = '用户名长度需要在 2-20 个字符之间';
    return;
  }
  if (password.value.length < 4) {
    validationError.value = '密码长度不能少于 4 位';
    return;
  }
  if (password.value !== confirmPassword.value) {
    validationError.value = '两次输入的密码不一致';
    return;
  }

  const success = await authStore.register(username.value, password.value);
  if (success) {
    router.push('/contacts');
  }
}
</script>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.auth-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.auth-title {
  text-align: center;
  font-size: 28px;
  margin: 0 0 8px;
}

.auth-subtitle {
  text-align: center;
  color: #666;
  margin: 0 0 24px;
}

.auth-error {
  background: #fff0f0;
  color: #e74c3c;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.form-group input {
  padding: 12px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 15px;
  transition: border-color 0.2s;
  outline: none;
}

.form-group input:focus {
  border-color: #667eea;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  padding: 14px;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  margin-top: 8px;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-link {
  text-align: center;
  margin-top: 20px;
  color: #666;
  font-size: 14px;
}

.auth-link a {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
}
</style>

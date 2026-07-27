<template>
  <main class="auth-page">
    <div class="auth-ambient auth-ambient-one"></div>
    <div class="auth-ambient auth-ambient-two"></div>
    <header class="auth-topbar">
      <BrandLogo />
      <ThemeToggle />
    </header>
    <section class="auth-stage">
      <div class="auth-intro">
        <span class="eyebrow">PRIVATE CONVERSATION</span>
        <h1>留一点安静，<br />给重要的对话。</h1>
        <p>专注于人与人之间最直接的连接。没有信息噪音，只有你们的此刻。</p>
        <div class="connection-visual" aria-hidden="true">
          <span class="connection-point"></span>
          <span class="connection-line"></span>
          <span class="connection-point"></span>
        </div>
      </div>

      <div class="auth-card">
        <div class="auth-card-heading">
          <span class="auth-mobile-logo"><BrandLogo :compact="true" /></span>
          <h2>欢迎回来</h2>
          <p>登录你的 two-point 账号</p>
        </div>

        <div v-if="authStore.error" class="auth-error" role="alert">{{ authStore.error }}</div>

        <form @submit.prevent="handleLogin" class="auth-form">
          <div class="form-group">
            <label for="username">用户名</label>
            <input
              id="username"
              v-model="username"
              type="text"
              placeholder="请输入用户名"
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
              placeholder="请输入密码"
              required
              autocomplete="current-password"
            />
          </div>
          <button type="submit" class="btn-primary" :disabled="authStore.loading">
            <span v-if="authStore.loading" class="button-spinner"></span>
            {{ authStore.loading ? '正在登录' : '进入 two-point' }}
          </button>
        </form>

        <p class="auth-link">
          还没有账号？
          <router-link to="/register">创建账号</router-link>
        </p>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import BrandLogo from '../components/BrandLogo.vue';
import ThemeToggle from '../components/ThemeToggle.vue';

const router = useRouter();
const authStore = useAuthStore();

const username = ref('');
const password = ref('');

async function handleLogin() {
  const success = await authStore.login(username.value, password.value);
  if (success) {
    router.push('/contacts');
  }
}
</script>

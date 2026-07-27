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
        <span class="eyebrow">YOUR PRIVATE SPACE</span>
        <h1>从两个点，<br />开始一段连接。</h1>
        <p>创建属于你的安静空间，让每一条消息都回到沟通本身。</p>
        <div class="connection-visual" aria-hidden="true">
          <span class="connection-point"></span>
          <span class="connection-line"></span>
          <span class="connection-point"></span>
        </div>
      </div>

      <div class="auth-card">
        <div class="auth-card-heading">
          <span class="auth-mobile-logo"><BrandLogo :compact="true" /></span>
          <h2>创建账号</h2>
          <p>加入 two-point，开始你的对话</p>
        </div>

        <div v-if="authStore.error" class="auth-error" role="alert">{{ authStore.error }}</div>
        <div v-if="validationError" class="auth-error" role="alert">{{ validationError }}</div>

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
            <span v-if="authStore.loading" class="button-spinner"></span>
            {{ authStore.loading ? '正在创建' : '创建账号' }}
          </button>
        </form>

        <p class="auth-link">
          已有账号？
          <router-link to="/login">返回登录</router-link>
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

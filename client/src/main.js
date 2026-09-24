import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import './style.css';
import { initTheme } from './utils/theme.js';
import { setUnauthorizedHandler } from './utils/api.js';
import { useAuthStore } from './stores/auth.js';

initTheme();

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
const authStore = useAuthStore();

async function bootstrap() {
  setUnauthorizedHandler(() => authStore.expireSession());

  // 先验证本地会话，避免用失效 token 渲染受保护页面。
  await authStore.init();
  app.use(router);
  await router.isReady();
  authStore.onSessionExpired(() => {
    if (router.currentRoute.value.path !== '/login') {
      router.replace({ path: '/login', query: { reason: 'session-expired' } });
    }
  });
  app.mount('#app');
}

bootstrap();

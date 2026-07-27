import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import './style.css';
import { initTheme } from './utils/theme.js';

initTheme();

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// 初始化认证状态（从 localStorage 恢复）
import { useAuthStore } from './stores/auth.js';
const authStore = useAuthStore();
authStore.init();

app.mount('#app');

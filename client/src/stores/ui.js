import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const toasts = ref([]);
  let nextId = 1;

  function notify(message, tone = 'info') {
    const id = nextId++;
    toasts.value.push({ id, message, tone });
    window.setTimeout(() => dismiss(id), 3600);
    return id;
  }

  function dismiss(id) {
    toasts.value = toasts.value.filter(toast => toast.id !== id);
  }

  return { toasts, notify, dismiss };
});

<template>
  <div class="image-upload">
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp,image/bmp"
      @change="handleFileChange"
      class="file-input"
      hidden
    />
    <button
      type="button"
      class="btn-upload"
      @click="openFilePicker"
      :disabled="uploading"
      :title="uploading ? '上传中...' : '发送图片'"
      :aria-label="uploading ? '图片上传中' : '发送图片'"
    >
      <span v-if="uploading" class="upload-spinner"></span>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <circle cx="9" cy="10" r="1.5" />
        <path d="m4 17 4.5-4.5 3.5 3 2.5-2.5 5.5 5" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { api } from '../utils/api.js';
import { useUiStore } from '../stores/ui.js';

const emit = defineEmits(['uploaded']);
const fileInput = ref(null);
const uploading = ref(false);
const uiStore = useUiStore();

function openFilePicker() {
  fileInput.value?.click();
}

async function handleFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  // 客户端验证
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  if (!allowedTypes.includes(file.type)) {
    uiStore.notify('仅支持 JPEG、PNG、GIF、WebP、BMP 格式的图片', 'error');
    e.target.value = '';
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    uiStore.notify('图片大小不能超过 10MB', 'error');
    e.target.value = '';
    return;
  }

  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('image', file);
    const data = await api.upload('/api/upload', formData);
    emit('uploaded', data.fileUrl);
  } catch (err) {
    uiStore.notify(err.message || '图片上传失败', 'error');
  } finally {
    uploading.value = false;
    // 重置 input，以便可以重复选择同一个文件
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  }
}
</script>

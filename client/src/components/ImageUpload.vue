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
      class="btn-upload"
      @click="openFilePicker"
      :disabled="uploading"
      :title="uploading ? '上传中...' : '发送图片'"
    >
      <span v-if="uploading" class="upload-spinner">⏳</span>
      <span v-else>🖼️</span>
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { api } from '../utils/api.js';

const emit = defineEmits(['uploaded']);
const fileInput = ref(null);
const uploading = ref(false);

function openFilePicker() {
  fileInput.value?.click();
}

async function handleFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  // 客户端验证
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  if (!allowedTypes.includes(file.type)) {
    alert('仅支持 JPEG、PNG、GIF、WebP、BMP 格式的图片');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert('图片大小不能超过 10MB');
    return;
  }

  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('image', file);
    const data = await api.upload('/api/upload', formData);
    emit('uploaded', data.fileUrl);
  } catch (err) {
    alert(err.message || '图片上传失败');
  } finally {
    uploading.value = false;
    // 重置 input，以便可以重复选择同一个文件
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  }
}
</script>

<style scoped>
.image-upload {
  display: flex;
  align-items: center;
}

.btn-upload {
  width: 40px;
  height: 40px;
  border: none;
  background: #f0f0f0;
  border-radius: 50%;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.btn-upload:hover:not(:disabled) {
  background: #e0e0e0;
}

.btn-upload:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

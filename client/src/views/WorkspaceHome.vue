<template>
  <section class="workspace-home">
    <div class="workspace-orbit" aria-hidden="true">
      <span></span>
      <span></span>
    </div>
    <BrandLogo />
    <h1>选择一位朋友，开始对话</h1>
    <p>让沟通停留在两点之间，清晰、自然、不被打扰。</p>
    <div class="workspace-shortcut">
      <kbd>Enter</kbd>
      <span>发送消息</span>
      <kbd>Shift</kbd><span>+</span><kbd>Enter</kbd>
      <span>换行</span>
    </div>
  </section>
</template>

<script setup>
import BrandLogo from '../components/BrandLogo.vue';
</script>

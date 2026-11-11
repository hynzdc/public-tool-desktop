<script setup>
defineProps({
  scrolled: { type: Boolean, default: false }
})
</script>

<template>
  <header class="site-header" :class="{ scrolled }" id="site-header">
    <a class="brand" href="#top">
      <img src="/assets/gongyi-tools-icon.png" width="32" height="32" alt="" />
      <span>公益工具站</span>
    </a>
    <nav class="top-nav" aria-label="主要导航">
      <a href="#tools">工具</a>
      <a href="#how">流程</a>
      <a href="#studio">界面</a>
      <a href="#download" class="nav-cta">下载</a>
    </nav>
  </header>
</template>

<script setup>
import DownloadButtons from './DownloadButtons.vue'
</script>

<template>
  <section class="cta" aria-labelledby="cta-title">
    <div class="cta-glow" aria-hidden="true" />
    <div class="cta-inner reveal">
      <p class="eyebrow">Get started</p>
      <h2 id="cta-title">现在就用起来。</h2>
      <p class="cta-desc">免费、本地、无账号。下载安装，打开就能干活。</p>
      <DownloadButtons />
    </div>
  </section>
</template>

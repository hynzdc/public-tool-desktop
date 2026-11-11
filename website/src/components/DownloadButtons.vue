<script setup>
const macHref = './downloads/公益工具站-macOS.dmg'
const winHref = './downloads/公益工具站-Windows-x64.exe'
</script>

<template>
  <div class="hero-actions" aria-label="下载公益工具站">
    <a class="btn btn-primary" :href="macHref" download>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path
          d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
        />
      </svg>
      下载 macOS
      <span class="btn-sub">DMG 安装包</span>
    </a>
    <a class="btn btn-secondary" :href="winHref" download>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path
          d="M3 5.5L10.5 4.4v7.1H3V5.5zm0 13L10.5 19.6v-7.1H3v6zm8.2 1.2L21 21V12.5h-9.8v7.2zm0-15.4V11.5H21V3l-9.8 1.3z"
        />
      </svg>
      下载 Windows
      <span class="btn-sub">x64 安装包</span>
    </a>
  </div>
</template>

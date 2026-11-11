<script setup>
import DownloadButtons from './DownloadButtons.vue'

defineProps({
  productFrameStyle: { type: Object, default: () => ({}) }
})
</script>

<template>
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-glow" aria-hidden="true" />
    <div class="hero-grid" aria-hidden="true" />
    <div class="hero-inner">
      <p class="pill reveal">
        <span class="pill-dot" />
        本地运行 · 无需账号 · 完全免费
      </p>
      <h1 id="hero-title" class="reveal reveal-delay-1">
        文件处理，<br />
        <em>就该这么简单。</em>
      </h1>
      <p class="lede reveal reveal-delay-2">
        把 Excel、PDF、发票和图片，收进一个安静好看的桌面工作台。<br class="hide-mobile" />
        打开即用，没有后台，没有账号，只专注把事情做完。
      </p>
      <DownloadButtons id="download" class="reveal reveal-delay-3" />
    </div>

    <div class="hero-product reveal reveal-delay-5" id="hero-product" aria-hidden="true">
      <div class="product-frame" id="product-frame" :style="productFrameStyle">
        <div class="product-chrome">
          <span class="dot red" />
          <span class="dot yellow" />
          <span class="dot green" />
          <span class="chrome-title">公益工具站</span>
        </div>
        <div class="product-body">
          <aside class="product-side">
            <div class="side-brand">
              <img src="/assets/gongyi-tools-icon.png" width="28" height="28" alt="" />
              <div>
                <b>公益工具站</b>
                <small>Public Tools</small>
              </div>
            </div>
            <div class="side-nav">
              <span class="active">工作台</span>
              <span>Excel 链接下载</span>
              <span>发票识别导出</span>
              <span>PDF 关键字筛选</span>
              <span>图片压缩</span>
            </div>
          </aside>
          <div class="product-main">
            <p class="pm-label">公益工具站 / 工作台</p>
            <h2 class="pm-title">今天要处理什么？</h2>
            <div class="pm-grid">
              <div class="pm-card" data-c="blue">
                <i />
                <strong>Excel</strong>
                <em>链接批量下载</em>
              </div>
              <div class="pm-card" data-c="orange">
                <i />
                <strong>发票</strong>
                <em>识别并导出</em>
              </div>
              <div class="pm-card" data-c="green">
                <i />
                <strong>PDF</strong>
                <em>筛选与提取</em>
              </div>
              <div class="pm-card" data-c="purple">
                <i />
                <strong>图片</strong>
                <em>压缩归档</em>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="product-reflection" aria-hidden="true" />
    </div>
  </section>
</template>

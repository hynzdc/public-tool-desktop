<template>
  <section class="tools" id="tools" aria-labelledby="tools-title">
    <div class="section-head reveal">
      <p class="eyebrow">Tools</p>
      <h2 id="tools-title">五个工具，覆盖日常文件琐事</h2>
      <p class="section-desc">不堆功能，只做真正会用到的事。每一步都清晰可预期。</p>
    </div>

    <div class="bento">
      <article class="bento-card bento-lg reveal" data-accent="blue">
        <div class="bento-visual">
          <div class="mini-sheet">
            <div class="sheet-row head"><span /><span /><span /></div>
            <div class="sheet-row"><span class="linkish" /><span /><span class="ok" /></div>
            <div class="sheet-row"><span class="linkish" /><span /><span class="ok" /></div>
            <div class="sheet-row"><span class="linkish" /><span /><span class="ok" /></div>
            <div class="sheet-row"><span class="linkish" /><span /><span class="ok" /></div>
          </div>
          <div class="mini-badge">→ ZIP</div>
        </div>
        <div class="bento-copy">
          <span class="tool-num">01</span>
          <h3>Excel 链接下载</h3>
          <p>读取指定表头下的链接，批量下载并自动打包为 ZIP。表格里的资源，一键落地。</p>
        </div>
      </article>

      <article class="bento-card reveal reveal-delay-1" data-accent="orange">
        <div class="bento-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <path d="M8 8h8M8 12h8M8 16h4" />
          </svg>
        </div>
        <span class="tool-num">02</span>
        <h3>发票识别导出</h3>
        <p>批量读取 PDF 发票，按文件夹整理并导出 Excel。报销归档，少踩坑。</p>
      </article>

      <article class="bento-card reveal reveal-delay-2" data-accent="green">
        <div class="bento-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <path d="M14 3v6h6" />
            <circle cx="11" cy="14" r="3" />
            <path d="m16 18-1.5-1.5" />
          </svg>
        </div>
        <span class="tool-num">03</span>
        <h3>PDF 处理</h3>
        <p>按关键字筛选 PDF，也能批量提取文本字段。从一堆文件里精准捞出你要的。</p>
      </article>

      <article class="bento-card bento-wide reveal reveal-delay-1" data-accent="purple">
        <div class="bento-visual wide">
          <div class="img-stack">
            <span /><span /><span />
          </div>
          <div class="compress-bar">
            <div class="bar-track"><i style="width: 32%" /></div>
            <em>体积 ↓ 68%</em>
          </div>
        </div>
        <div class="bento-copy">
          <span class="tool-num">04</span>
          <h3>图片压缩</h3>
          <p>单张输出 JPG，多张自动打包 ZIP。体积更小，上传和归档都更轻松。</p>
        </div>
      </article>
    </div>
  </section>
</template>

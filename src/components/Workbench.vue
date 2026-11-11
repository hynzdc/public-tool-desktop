<script setup>
defineEmits(['open'])

const cards = [
  {
    id: 'excel',
    title: 'Excel 链接下载',
    desc: '读取表头里的链接，批量下载并打包。',
    color: '#2383e2'
  },
  {
    id: 'invoice',
    title: '发票识别导出',
    desc: '批量识别 PDF 发票内容，按文件夹导出表格。',
    color: '#d7813a'
  },
  {
    id: 'pdf-filter',
    title: 'PDF 关键字筛选',
    desc: '按包含或不包含关键字筛选 PDF。',
    color: '#3d9a5f'
  },
  {
    id: 'pdf-extract',
    title: 'PDF 内容提取',
    desc: '从 PDF 中按字段提取内容并导出 Excel。',
    color: '#2a9d8f'
  },
  {
    id: 'image',
    title: '图片压缩',
    desc: '单张输出 JPG，多张图片自动打包。',
    color: '#aa65b3',
    wide: true
  }
]
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <div class="crumb">工作台</div>
      <h1>今天要处理什么？</h1>
      <p>选择一个工具开始。本地处理，无需账号，文件始终留在你的电脑上。</p>
    </header>

    <div class="tool-grid">
      <article
        v-for="card in cards"
        :key="card.id"
        class="overview-card"
        :class="{ wide: card.wide }"
        @click="$emit('open', card.id)"
      >
        <div>
          <span class="dot" :style="{ background: card.color }" />
          <h3>{{ card.title }}</h3>
          <p>{{ card.desc }}</p>
        </div>
        <div class="action" :style="{ color: card.color }">开始使用 →</div>
      </article>
    </div>
  </section>
</template>

<script setup>
defineProps({
  current: { type: String, required: true }
})
defineEmits(['navigate'])

const items = [
  { id: 'home', title: '工作台', desc: '工具总览', color: '#2383e2', section: null },
  { id: 'excel', title: 'Excel', desc: '链接下载', color: '#2383e2', section: '常用工具' },
  { id: 'invoice', title: '发票', desc: '识别导出', color: '#d7813a', section: null },
  { id: 'pdf-filter', title: 'PDF', desc: '关键字筛选', color: '#3d9a5f', section: 'PDF 工具' },
  { id: 'pdf-extract', title: 'PDF', desc: '内容提取', color: '#2a9d8f', section: null },
  { id: 'image', title: '图片', desc: '压缩', color: '#aa65b3', section: '媒体工具' }
]
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <img src="/icon.png" alt="logo" />
      <div>
        <div class="brand-title">公益工具站</div>
        <div class="brand-sub">本地 · 免费 · 无账号</div>
      </div>
    </div>

    <nav class="nav-list">
      <template v-for="item in items" :key="item.id">
        <div v-if="item.section" class="section-label">{{ item.section }}</div>
        <button
          class="nav-btn"
          :class="{ active: current === item.id }"
          @click="$emit('navigate', item.id)"
        >
          <span class="nav-title">
            <span class="dot" :style="{ background: item.color }" />
            {{ item.title }}
          </span>
          <span class="nav-desc">{{ item.desc }}</span>
        </button>
      </template>
    </nav>

    <div class="sidebar-footer">文件始终留在本地</div>
  </aside>
</template>

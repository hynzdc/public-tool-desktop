<script setup>
import { ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import Workbench from './components/Workbench.vue'
import ExcelTool from './components/tools/ExcelTool.vue'
import InvoiceTool from './components/tools/InvoiceTool.vue'
import PdfFilterTool from './components/tools/PdfFilterTool.vue'
import PdfExtractTool from './components/tools/PdfExtractTool.vue'
import ImageCompressTool from './components/tools/ImageCompressTool.vue'

const current = ref('home')

function openTool(id) {
  current.value = id
}
</script>

<template>
  <div class="app-shell">
    <Sidebar :current="current" @navigate="openTool" />
    <main class="main">
      <Workbench v-if="current === 'home'" @open="openTool" />
      <ExcelTool v-else-if="current === 'excel'" />
      <InvoiceTool v-else-if="current === 'invoice'" />
      <PdfFilterTool v-else-if="current === 'pdf-filter'" />
      <PdfExtractTool v-else-if="current === 'pdf-extract'" />
      <ImageCompressTool v-else-if="current === 'image'" />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ToolLayout from '../ToolLayout.vue'
import { useToolRunner, dirname, joinPath, ensureExt } from '../../composables/useToolRunner'

const folderPath = ref('')
const outputPath = ref('')

const {
  busy,
  percent,
  progressText,
  logs,
  errorMessage,
  canOpenFolder,
  confirmOverwrite,
  openOutputFolder,
  runTask
} = useToolRunner()

async function chooseFolder() {
  const selected = await window.api.openDirectory()
  if (!selected) return
  folderPath.value = selected
  if (!outputPath.value) {
    const name = selected.split(/[/\\]/).filter(Boolean).pop()
    outputPath.value = joinPath(dirname(selected), `${name}-invoice-results.zip`)
  }
}

async function chooseOutput() {
  const selected = await window.api.saveFile({
    defaultPath: outputPath.value || 'invoice-results.zip',
    filters: [{ name: 'ZIP', extensions: ['zip'] }]
  })
  if (!selected) return
  outputPath.value = ensureExt(selected, '.zip')
}

function clearForm() {
  folderPath.value = ''
  outputPath.value = ''
  errorMessage.value = ''
  canOpenFolder.value = false
  percent.value = 0
  progressText.value = ''
  logs.value = ''
}

async function start() {
  if (!folderPath.value) {
    errorMessage.value = '请先选择发票文件夹。'
    return
  }
  if (!outputPath.value) {
    errorMessage.value = '请选择输出 zip 文件。'
    return
  }
  if (!(await confirmOverwrite(outputPath.value))) return

  const result = await runTask(() =>
    window.api.invoice({
      folderPath: folderPath.value,
      outputPath: outputPath.value
    })
  )
  if (result) {
    logs.value += `完成：共处理 ${result.pdfCount} 个 PDF，生成 ${result.excelCount} 个 Excel。\n`
  }
}
</script>

<template>
  <ToolLayout
    crumb="常用工具"
    title="发票识别导出"
    description="批量读取 PDF 发票内容，按文件夹导出 Excel 并打包。"
  >
    <div class="form">
      <div class="field">
        <label>发票文件夹</label>
        <div class="field-control">
          <input v-model="folderPath" type="text" readonly placeholder="请选择包含 PDF 发票的文件夹" />
          <button class="btn" :disabled="busy" @click="chooseFolder">选择文件夹</button>
        </div>
      </div>

      <div class="field">
        <label>输出文件</label>
        <div class="field-control">
          <input v-model="outputPath" type="text" readonly placeholder="选择输出 ZIP 路径" />
          <button class="btn" :disabled="busy" @click="chooseOutput">保存为</button>
        </div>
      </div>

      <div class="field">
        <label>进度</label>
        <div class="progress-wrap">
          <div class="progress-bar"><span :style="{ width: `${percent}%` }" /></div>
          <div class="progress-text">{{ progressText || `${percent}%` }}</div>
        </div>
      </div>

      <div class="field">
        <label>日志</label>
        <textarea class="log-area" :value="logs" readonly />
      </div>
    </div>

    <div class="actions">
      <button class="btn" :disabled="busy" @click="clearForm">清空</button>
      <button class="btn" :disabled="!canOpenFolder || busy" @click="openOutputFolder(outputPath)">
        打开目录
      </button>
      <button class="btn btn-primary" :disabled="busy" @click="start">
        {{ busy ? '处理中...' : '开始处理' }}
      </button>
    </div>

    <div v-if="errorMessage" class="error-toast">{{ errorMessage }}</div>
  </ToolLayout>
</template>

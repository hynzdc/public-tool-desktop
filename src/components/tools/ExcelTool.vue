<script setup>
import { ref } from 'vue'
import ToolLayout from '../ToolLayout.vue'
import {
  useToolRunner,
  dirname,
  joinPath,
  stripExtension,
  ensureExt
} from '../../composables/useToolRunner'

const excelPath = ref('')
const outputPath = ref('')
const headersText = ref('')
const filenameHeader = ref('')
const splitHeader = ref('')

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

async function chooseExcel() {
  const selected = await window.api.openFile({
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }]
  })
  if (!selected) return
  excelPath.value = selected
  if (!outputPath.value) {
    const base = stripExtension(selected.split(/[/\\]/).pop())
    outputPath.value = joinPath(dirname(selected), `${base}-links.zip`)
  }
}

async function chooseOutput() {
  const selected = await window.api.saveFile({
    defaultPath: outputPath.value || 'excel-links.zip',
    filters: [{ name: 'ZIP', extensions: ['zip'] }]
  })
  if (!selected) return
  outputPath.value = ensureExt(selected, '.zip')
}

function clearForm() {
  excelPath.value = ''
  outputPath.value = ''
  headersText.value = ''
  filenameHeader.value = ''
  splitHeader.value = ''
  errorMessage.value = ''
  canOpenFolder.value = false
  percent.value = 0
  progressText.value = ''
  logs.value = ''
}

async function start() {
  if (!excelPath.value) {
    errorMessage.value = '请先选择 Excel 文件。'
    return
  }
  if (!outputPath.value) {
    errorMessage.value = '请选择输出 zip 文件。'
    return
  }
  if (!headersText.value.trim()) {
    errorMessage.value = '请填写至少一个表头名称。'
    return
  }
  if (!(await confirmOverwrite(outputPath.value))) return

  const result = await runTask(() =>
    window.api.excelDownload({
      excelPath: excelPath.value,
      outputPath: outputPath.value,
      headersText: headersText.value,
      filenameHeader: filenameHeader.value,
      splitHeader: splitHeader.value
    })
  )
  if (result) {
    logs.value += `完成：共处理 ${result.totalLinks} 个链接，失败 ${result.errorCount} 个。\n`
  }
}
</script>

<template>
  <ToolLayout
    crumb="常用工具"
    title="Excel 链接下载"
    description="读取指定表头下的链接，批量下载并打包为 ZIP。"
  >
    <div class="form">
      <div class="field">
        <label>Excel 文件</label>
        <div class="field-control">
          <input v-model="excelPath" type="text" readonly placeholder="请选择 Excel 文件" />
          <button class="btn" :disabled="busy" @click="chooseExcel">选择 Excel</button>
        </div>
      </div>

      <div class="field">
        <label>表头名称</label>
        <div class="field-control stack">
          <textarea
            v-model="headersText"
            placeholder="填写包含链接的表头，多个可用逗号或换行分隔"
          />
        </div>
      </div>

      <div class="field">
        <label>文件名表头</label>
        <div class="field-control">
          <input v-model="filenameHeader" type="text" placeholder="可选，用于自定义下载文件名" />
        </div>
      </div>

      <div class="field">
        <label>拆分表头</label>
        <div class="field-control stack">
          <input v-model="splitHeader" type="text" placeholder="可选，按该列值拆分结果" />
          <div class="hint">填写后按该表头列的值拆分；不填则不拆分。</div>
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
        {{ busy ? '打包中...' : '开始打包' }}
      </button>
    </div>

    <div v-if="errorMessage" class="error-toast">{{ errorMessage }}</div>
  </ToolLayout>
</template>

<script setup>
import { ref } from 'vue'
import ToolLayout from '../ToolLayout.vue'
import {
  useToolRunner,
  dirname,
  joinPath,
  stripExtension,
  ensureExt,
  formatSize
} from '../../composables/useToolRunner'

const imagePaths = ref([])
const imageText = ref('')
const outputPath = ref('')
const targetKb = ref('200')

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

function defaultOutput(paths) {
  if (!paths.length) return ''
  const first = paths[0]
  const parent = dirname(first)
  if (paths.length === 1) {
    const base = stripExtension(first.split(/[/\\]/).pop())
    return joinPath(parent, `${base}-compressed.jpg`)
  }
  return joinPath(parent, 'compressed-images.zip')
}

async function chooseImages() {
  const selected = await window.api.openFile({
    multiple: true,
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'webp'] }]
  })
  if (!selected) return
  const list = Array.isArray(selected) ? selected : [selected]
  imagePaths.value = list
  imageText.value = list.length === 1 ? list[0] : `${list.length} 张图片`
  outputPath.value = defaultOutput(list)
  canOpenFolder.value = false
}

async function chooseOutput() {
  const multi = imagePaths.value.length > 1
  const selected = await window.api.saveFile({
    defaultPath: outputPath.value || (multi ? 'compressed-images.zip' : 'compressed.jpg'),
    filters: multi
      ? [{ name: 'ZIP', extensions: ['zip'] }]
      : [{ name: 'JPG', extensions: ['jpg', 'jpeg'] }]
  })
  if (!selected) return
  outputPath.value = multi ? ensureExt(selected, '.zip') : ensureExt(selected, '.jpg')
}

function clearForm() {
  imagePaths.value = []
  imageText.value = ''
  outputPath.value = ''
  targetKb.value = '200'
  errorMessage.value = ''
  canOpenFolder.value = false
  percent.value = 0
  progressText.value = ''
  logs.value = ''
}

async function start() {
  if (!imagePaths.value.length) {
    errorMessage.value = '请先选择要压缩的图片。'
    return
  }
  if (!outputPath.value) {
    errorMessage.value = '请选择输出文件。'
    return
  }
  if (!(await confirmOverwrite(outputPath.value))) return

  const result = await runTask(() =>
    window.api.imageCompress({
      imagePaths: imagePaths.value,
      outputPath: outputPath.value,
      targetKb: targetKb.value
    })
  )
  if (result) {
    logs.value += `完成：共压缩 ${result.count} 张图片，原始 ${formatSize(result.originalBytes)}，压缩后 ${formatSize(result.compressedBytes)}。\n`
  }
}
</script>

<template>
  <ToolLayout
    crumb="媒体工具"
    title="图片压缩"
    description="单张输出 JPG，多张自动打包为 ZIP。"
  >
    <div class="form">
      <div class="field">
        <label>图片文件</label>
        <div class="field-control">
          <input v-model="imageText" type="text" readonly placeholder="请选择一张或多张图片" />
          <button class="btn" :disabled="busy" @click="chooseImages">选择图片</button>
        </div>
      </div>

      <div class="field">
        <label>目标大小 KB</label>
        <div class="field-control">
          <input v-model="targetKb" type="text" placeholder="默认 200" />
        </div>
      </div>

      <div class="field">
        <label>输出文件</label>
        <div class="field-control">
          <input v-model="outputPath" type="text" readonly placeholder="选择输出路径" />
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
        {{ busy ? '压缩中...' : '开始压缩' }}
      </button>
    </div>

    <div v-if="errorMessage" class="error-toast">{{ errorMessage }}</div>
  </ToolLayout>
</template>

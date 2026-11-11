import { onBeforeUnmount, ref } from 'vue'

export function useToolRunner() {
  const busy = ref(false)
  const percent = ref(0)
  const progressText = ref('')
  const logs = ref('')
  const errorMessage = ref('')
  const canOpenFolder = ref(false)
  let unsubscribe = null

  function appendLog(message) {
    if (!message || !String(message).trim()) return
    logs.value += `${message}\n`
  }

  function resetProgress() {
    percent.value = 0
    progressText.value = '准备处理'
    logs.value = ''
    errorMessage.value = ''
    canOpenFolder.value = false
  }

  function bindProgress() {
    if (unsubscribe) unsubscribe()
    unsubscribe = window.api?.onProgress?.((payload) => {
      if (!payload) return
      if (typeof payload.percent === 'number') percent.value = payload.percent
      if (payload.message) {
        progressText.value = payload.message
        appendLog(payload.message)
      }
    })
  }

  async function confirmOverwrite(filePath) {
    if (!filePath) return true
    const exists = await window.api.exists(filePath)
    if (!exists) return true
    return window.confirm(`输出文件已存在，是否覆盖？\n${filePath}`)
  }

  async function openOutputFolder(filePath) {
    if (!filePath) return
    await window.api.openPath(filePath)
  }

  async function runTask(task) {
    if (!window.api) {
      errorMessage.value = '当前不在桌面环境中运行，请使用 npm run dev 启动 Electron。'
      return null
    }
    busy.value = true
    resetProgress()
    bindProgress()
    try {
      const result = await task()
      percent.value = 100
      progressText.value = '完成'
      canOpenFolder.value = true
      return result
    } catch (error) {
      progressText.value = '失败'
      const message = error?.message || String(error)
      appendLog(message)
      errorMessage.value = message
      return null
    } finally {
      busy.value = false
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
    }
  }

  onBeforeUnmount(() => {
    if (unsubscribe) unsubscribe()
  })

  return {
    busy,
    percent,
    progressText,
    logs,
    errorMessage,
    canOpenFolder,
    appendLog,
    resetProgress,
    confirmOverwrite,
    openOutputFolder,
    runTask
  }
}

export function dirname(filePath) {
  if (!filePath) return ''
  const normalized = filePath.replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  return index >= 0 ? filePath.slice(0, index) : ''
}

export function joinPath(dir, name) {
  if (!dir) return name
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir.endsWith('\\') || dir.endsWith('/') ? `${dir}${name}` : `${dir}${sep}${name}`
}

export function stripExtension(filename) {
  const name = filename || ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

export function ensureExt(filePath, ext) {
  if (!filePath) return filePath
  return filePath.toLowerCase().endsWith(ext.toLowerCase()) ? filePath : `${filePath}${ext}`
}

export function formatSize(size) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

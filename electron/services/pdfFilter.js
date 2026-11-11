const fs = require('fs')
const path = require('path')
const archiver = require('archiver')
const {
  listPdfFiles,
  normalizePath,
  parseDelimitedList,
  progressFor,
  ensureParentDir
} = require('./utils')
const { extractTextFromPdfFile } = require('./pdfText')

async function run(payload, onProgress = () => {}) {
  const { folderPath, outputPath, keywordsText, includeMode = true } = payload || {}
  if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    throw new Error('请先选择 PDF 文件夹。')
  }
  if (!outputPath) throw new Error('请选择输出 zip 文件。')

  const keywords = parseDelimitedList(keywordsText)
  if (!keywords.length) throw new Error('请填写至少一个关键字。')

  const pdfFiles = await listPdfFiles(folderPath)
  if (!pdfFiles.length) throw new Error('文件夹中未找到 PDF 文件。')

  ensureParentDir(outputPath)
  const output = fs.createWriteStream(outputPath)
  const archive = archiver('zip', { zlib: { level: 9 } })
  const done = new Promise((resolve, reject) => {
    output.on('close', resolve)
    archive.on('error', reject)
    output.on('error', reject)
  })
  archive.pipe(output)

  let keptCount = 0
  let errorCount = 0
  const summary = [
    `筛选方式：${includeMode ? '包含任意关键字则保留' : '不包含所有关键字则保留'}`,
    `关键字：${keywords.join('，')}`,
    ''
  ]

  for (let i = 0; i < pdfFiles.length; i++) {
    const pdfFile = pdfFiles[i]
    const relativePath = normalizePath(path.relative(folderPath, pdfFile))
    onProgress({
      message: `检查 PDF：${relativePath}`,
      percent: progressFor(i, pdfFiles.length)
    })

    let matched = false
    let readFailed = false
    try {
      const text = await extractTextFromPdfFile(pdfFile)
      const normalizedText = String(text || '').toLowerCase()
      matched = keywords.some((kw) => normalizedText.includes(String(kw).toLowerCase()))
    } catch (error) {
      readFailed = true
      errorCount += 1
      summary.push(`读取失败：${relativePath}，${error.message || error}`)
    }

    const keep = !readFailed && (includeMode ? matched : !matched)
    if (keep) {
      const entryName = relativePath.replace(/^\//, '').replace(/\.\.\//g, '_/').replace(/\.\./g, '_') || 'pdf.pdf'
      archive.file(pdfFile, { name: entryName })
      keptCount += 1
      summary.push(`保留：${relativePath}`)
    } else if (!readFailed) {
      summary.push(`排除：${relativePath}`)
    }
  }

  summary.push('')
  summary.push(`总数：${pdfFiles.length}`)
  summary.push(`保留：${keptCount}`)
  summary.push(`排除：${pdfFiles.length - keptCount - errorCount}`)
  summary.push(`读取失败：${errorCount}`)
  archive.append(Buffer.from(`${summary.join('\n')}\n`, 'utf8'), { name: '_pdf-filter-summary.txt' })

  await archive.finalize()
  await done
  onProgress({ message: `写入输出文件：${path.basename(outputPath)}`, percent: 100 })

  return {
    totalCount: pdfFiles.length,
    keptCount,
    removedCount: pdfFiles.length - keptCount - errorCount,
    errorCount,
    outputPath
  }
}

module.exports = { run }

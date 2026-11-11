const fs = require('fs')
const path = require('path')
const os = require('os')
const ExcelJS = require('exceljs')
const archiver = require('archiver')
const { listPdfFiles, normalizePath, sanitizeFilename, ensureParentDir } = require('./utils')
const { ROOT_FOLDER_KEY, extractInvoiceSourceFromPdfFile, groupPdfTextsByLeafFolder } = require('./pdfText')
const { parseInvoiceInfo } = require('./invoiceParser')

const HEADER_ORDER = [
  '发票号码',
  '开票日期',
  '购买方名称',
  '销售方名称',
  '项目名称',
  '金额',
  '税率',
  '税额',
  '价税合计'
]

function uniqueName(baseName, nameCounts) {
  const count = (nameCounts.get(baseName) || 0) + 1
  nameCounts.set(baseName, count)
  return count === 1 ? baseName : `${baseName}-${count}`
}

function resolveFolderDisplayName(folderName) {
  if (folderName === ROOT_FOLDER_KEY || folderName == null) return 'root'
  let normalized = String(folderName).replace(/\\/g, '/')
  while (normalized.endsWith('/') && normalized.length > 1) {
    normalized = normalized.slice(0, -1)
  }
  const slash = normalized.lastIndexOf('/')
  const leaf = slash >= 0 ? normalized.slice(slash + 1) : normalized
  return !leaf || !leaf.trim() ? 'root' : leaf
}

async function generateExcel(rows, outputDir, fileName) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('发票信息')
  sheet.addRow(HEADER_ORDER)
  for (const data of rows) {
    sheet.addRow(HEADER_ORDER.map((key) => data[key] || ''))
  }
  HEADER_ORDER.forEach((_, i) => {
    sheet.getColumn(i + 1).width = 18
  })
  const excelPath = path.join(outputDir, `${fileName}.xlsx`)
  await workbook.xlsx.writeFile(excelPath)
  return excelPath
}

async function zipDirectory(sourceDir, targetZip) {
  ensureParentDir(targetZip)
  const output = fs.createWriteStream(targetZip)
  const archive = archiver('zip', { zlib: { level: 9 } })
  const done = new Promise((resolve, reject) => {
    output.on('close', resolve)
    archive.on('error', reject)
    output.on('error', reject)
  })
  archive.pipe(output)
  const files = fs.readdirSync(sourceDir)
  for (const name of files) {
    const full = path.join(sourceDir, name)
    if (fs.statSync(full).isFile()) {
      archive.file(full, { name })
    }
  }
  await archive.finalize()
  await done
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
}

async function run(payload, onProgress = () => {}) {
  const { folderPath, outputPath } = payload || {}
  if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    throw new Error('请先选择发票文件夹。')
  }
  if (!outputPath) throw new Error('请选择输出 zip 文件。')

  const pdfFiles = await listPdfFiles(folderPath)
  if (!pdfFiles.length) throw new Error('文件夹中未找到 PDF 文件。')

  const pdfTextsFlat = {}
  for (let i = 0; i < pdfFiles.length; i++) {
    const pdfFile = pdfFiles[i]
    const relativePath = normalizePath(path.relative(folderPath, pdfFile))
    const percent = 5 + Math.round(((i + 1) * 75) / pdfFiles.length)
    onProgress({ message: `识别 PDF：${relativePath}`, percent })
    try {
      const source = await extractInvoiceSourceFromPdfFile(pdfFile)
      pdfTextsFlat[relativePath] = {
        text: source.text,
        layoutParties: source.layoutParties
      }
    } catch (error) {
      pdfTextsFlat[relativePath] = {
        text: `提取失败: ${error.message || error}`,
        layoutParties: null
      }
    }
  }

  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoice-output-'))
  try {
    onProgress({ message: '生成 Excel 文件', percent: 82 })
    const grouped = groupPdfTextsByLeafFolder(pdfTextsFlat)
    const onlyRoot = grouped.size === 1 && grouped.has(ROOT_FOLDER_KEY)
    const nameCounts = new Map()
    const excelPaths = []

    for (const [folderName, pdfMap] of grouped.entries()) {
      const invoices = []
      for (const [fileName, entry] of pdfMap.entries()) {
        const text = entry && typeof entry === 'object' ? entry.text : entry
        const layoutParties = entry && typeof entry === 'object' ? entry.layoutParties : null
        const invoiceInfo = parseInvoiceInfo(text, { layoutParties })
        invoiceInfo['源文件名'] = fileName
        if (!String(text || '').startsWith('提取失败:')) {
          invoices.push(invoiceInfo)
        }
      }
      const baseExcelName = onlyRoot ? 'root' : resolveFolderDisplayName(folderName)
      const finalName = uniqueName(sanitizeFilename(baseExcelName) || 'invoice', nameCounts)
      excelPaths.push(await generateExcel(invoices, outputDir, finalName))
    }

    if (!excelPaths.length) throw new Error('未生成 Excel 文件，请检查 PDF 内容。')

    onProgress({ message: `打包 ZIP：${path.basename(outputPath)}`, percent: 94 })
    await zipDirectory(outputDir, outputPath)
    onProgress({ message: '处理完成', percent: 100 })
    return { pdfCount: pdfFiles.length, excelCount: excelPaths.length, outputPath }
  } finally {
    removeDir(outputDir)
  }
}

module.exports = { run }

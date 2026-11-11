const fs = require('fs')
const path = require('path')
const ExcelJS = require('exceljs')
const {
  listPdfFiles,
  normalizePath,
  parseDelimitedList,
  progressFor,
  ensureParentDir
} = require('./utils')
const { extractTextFromPdfFile } = require('./pdfText')

const AMOUNT_PATTERN = /(?<![A-Za-z0-9_])[-+]?\d{1,8}(?:\.\d{1,2})?(?![A-Za-z0-9_])/g
const DATE_PATTERN = /\d{4}[-/]\d{1,2}[-/]\d{1,2}/g
const FIELD_HELP_TEXT = '每行填写一个要提取的字段，例如：乙方、运费'

function normalizeSpace(value) {
  return value == null ? '' : String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function isAmountField(field) {
  const normalized = normalizeSpace(field)
  return (
    normalized.includes('运费') ||
    normalized.includes('金额') ||
    normalized.includes('费用') ||
    normalized.includes('价格') ||
    normalized.includes('单价') ||
    normalized.includes('总价') ||
    normalized.includes('元')
  )
}

function amountScore(value) {
  const clean = value == null ? '' : String(value).trim()
  if (!clean || clean.length > 10 || clean.length < 2) return -1
  const amount = Number(clean)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) return -1
  let score = amount
  if (clean.includes('.')) score += 100000
  if (amount >= 100) score += 10000
  if (amount < 24) score -= 50000
  return score
}

function pickBestAmount(text) {
  const normalized = normalizeSpace(String(text || '').replace(DATE_PATTERN, ' '))
  let best = ''
  let bestScore = -1
  let matcher
  AMOUNT_PATTERN.lastIndex = 0
  while ((matcher = AMOUNT_PATTERN.exec(normalized))) {
    const candidate = matcher[0]
    const score = amountScore(candidate)
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}

function stripLeadingSeparators(value) {
  let result = normalizeSpace(value)
  while (result && ':：=-—_、，,；;'.includes(result[0])) {
    result = result.slice(1).trim()
  }
  return result
}

function cutBeforeNextField(value, currentField, fields) {
  let result = normalizeSpace(value)
  let cutIndex = -1
  for (const field of fields) {
    if (field === currentField) continue
    const index = result.indexOf(field)
    if (index > 0 && (cutIndex < 0 || index < cutIndex)) cutIndex = index
  }
  return cutIndex > 0 ? result.slice(0, cutIndex).trim() : result
}

function extractAmountAround(lines, fieldLineIndex, afterFieldIndex) {
  let scope = ''
  const fieldLine = normalizeSpace(lines[fieldLineIndex])
  if (afterFieldIndex >= 0 && afterFieldIndex < fieldLine.length) {
    scope += `${fieldLine.slice(afterFieldIndex)} `
  }
  for (let i = fieldLineIndex + 1; i < Math.min(lines.length, fieldLineIndex + 18); i++) {
    scope += `${normalizeSpace(lines[i])} `
  }
  let best = pickBestAmount(scope)
  if (best) return best

  const tableText = lines.map(normalizeSpace).join(' ')
  let feeHeaderIndex = tableText.indexOf('运费')
  if (feeHeaderIndex < 0) feeHeaderIndex = tableText.indexOf('费用')
  if (feeHeaderIndex < 0) return ''
  return pickBestAmount(tableText.slice(feeHeaderIndex))
}

function extractFieldValue(lines, field, allFields) {
  const amountField = isAmountField(field)
  for (let i = 0; i < lines.length; i++) {
    const line = normalizeSpace(lines[i])
    const index = line.indexOf(field)
    if (index < 0) continue

    if (amountField) {
      const amount = extractAmountAround(lines, i, index + field.length)
      if (amount) return amount
    }

    let candidate = line.slice(index + field.length)
    candidate = stripLeadingSeparators(candidate)
    candidate = cutBeforeNextField(candidate, field, allFields)
    if (amountField) {
      const amount = pickBestAmount(candidate)
      if (amount) return amount
    }
    if (candidate) return candidate

    for (let next = i + 1; next < Math.min(lines.length, i + 4); next++) {
      const nextLine = normalizeSpace(lines[next])
      if (nextLine) return cutBeforeNextField(nextLine, field, allFields)
    }
  }
  return ''
}

function extractFieldValues(text, fields) {
  const lines = String(text || '').replace(/\r/g, '\n').split(/\n+/)
  const values = {}
  for (const field of fields) {
    values[field] = extractFieldValue(lines, field, fields)
  }
  return values
}

async function run(payload, onProgress = () => {}) {
  const { folderPath, outputPath, fieldsText } = payload || {}
  if (!folderPath || !fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    throw new Error('请先选择 PDF 文件夹。')
  }
  if (!outputPath) throw new Error('请选择输出 Excel 文件。')

  const fields = parseDelimitedList(fieldsText).filter((f) => f !== FIELD_HELP_TEXT)
  if (!fields.length) throw new Error('请填写至少一个提取字段。')

  const pdfFiles = await listPdfFiles(folderPath)
  if (!pdfFiles.length) throw new Error('文件夹中未找到 PDF 文件。')

  ensureParentDir(outputPath)
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('PDF内容提取')
  sheet.addRow(['PDF文件名', ...fields, '处理备注'])

  let errorCount = 0
  for (let i = 0; i < pdfFiles.length; i++) {
    const pdfFile = pdfFiles[i]
    const relativePath = normalizePath(path.relative(folderPath, pdfFile))
    onProgress({
      message: `提取 PDF：${relativePath}`,
      percent: progressFor(i, pdfFiles.length)
    })

    const row = [relativePath]
    let note = ''
    try {
      const text = await extractTextFromPdfFile(pdfFile)
      const values = extractFieldValues(text, fields)
      for (const field of fields) row.push(values[field] || '')
    } catch (error) {
      errorCount += 1
      for (let j = 0; j < fields.length; j++) row.push('')
      note = `读取失败：${error.message || error}`
    }
    row.push(note)
    sheet.addRow(row)
  }

  onProgress({ message: `写入 Excel：${path.basename(outputPath)}`, percent: 95 })
  await workbook.xlsx.writeFile(outputPath)
  onProgress({ message: '处理完成', percent: 100 })
  return { totalCount: pdfFiles.length, errorCount, outputPath }
}

module.exports = { run, FIELD_HELP_TEXT }

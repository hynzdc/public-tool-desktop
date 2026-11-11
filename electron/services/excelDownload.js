const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const { URL } = require('url')
const ExcelJS = require('exceljs')
const XLSX = require('xlsx')
const archiver = require('archiver')
const {
  hasText,
  sanitizeFilename,
  parseDelimitedList,
  buildUniqueName,
  ensureParentDir
} = require('./utils')

const MAX_EXCEL_SIZE = 20 * 1024 * 1024
const MAX_HEADER_SCAN_ROWS = 20
const MAX_SPLIT_GROUPS = 200
const CONNECT_TIMEOUT_MS = 15000
const READ_TIMEOUT_MS = 30000

function validateFile(filename, fileSize) {
  if (!hasText(filename)) throw new Error('请选择要上传的 Excel 文件。')
  if (fileSize > MAX_EXCEL_SIZE) throw new Error('Excel 文件不能超过 20MB。')
  const lower = filename.toLowerCase()
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
    throw new Error('只支持 .xlsx 或 .xls 文件。')
  }
}

function isHttpUrl(value) {
  if (!hasText(value)) return false
  const lower = String(value).trim().toLowerCase()
  return lower.startsWith('http://') || lower.startsWith('https://')
}

function cellText(cell) {
  if (!cell) return ''
  if (cell.hyperlink) {
    if (typeof cell.hyperlink === 'string') return cell.hyperlink.trim()
    if (cell.hyperlink.target) return String(cell.hyperlink.target).trim()
  }
  if (cell.text != null) return String(cell.text).trim()
  if (cell.value == null) return ''
  if (typeof cell.value === 'object') {
    if (cell.value.text) return String(cell.value.text).trim()
    if (cell.value.hyperlink) return String(cell.value.hyperlink).trim()
    if (cell.value.richText) {
      return cell.value.richText.map((p) => p.text || '').join('').trim()
    }
    if (cell.value.result != null) return String(cell.value.result).trim()
  }
  return String(cell.value).trim()
}

async function readSheetRows(filePath) {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.xls') && !lower.endsWith('.xlsx')) {
    const workbook = XLSX.readFile(filePath, { cellDates: true })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) throw new Error('Excel 中没有可读取的工作表。')
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
    return rows.map((row) => (row || []).map((v) => String(v == null ? '' : v).trim()))
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('Excel 中没有可读取的工作表。')

  const rows = []
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values = []
    const maxCol = Math.max(row.cellCount || 0, worksheet.columnCount || 0)
    for (let col = 1; col <= maxCol; col++) {
      values.push(cellText(row.getCell(col)))
    }
    rows[rowNumber - 1] = values
  })
  return rows
}

function findHeaderRow(rows, requestedHeaders) {
  const lastScan = Math.min(rows.length, MAX_HEADER_SCAN_ROWS)
  for (let rowIndex = 0; rowIndex < lastScan; rowIndex++) {
    const row = rows[rowIndex] || []
    const headerColumns = new Map()
    row.forEach((value, colIndex) => {
      const normalized = String(value || '').trim()
      if (normalized && !headerColumns.has(normalized)) {
        headerColumns.set(normalized, colIndex)
      }
    })
    const matched = new Map()
    for (const header of requestedHeaders) {
      if (headerColumns.has(header)) matched.set(header, headerColumns.get(header))
    }
    if (matched.size === requestedHeaders.size) {
      return { rowIndex, columnIndexes: matched }
    }
  }
  return null
}

function extractLinks(rows, requestedHeaders, filenameHeader, splitHeader) {
  const headersToFind = [...requestedHeaders]
  if (hasText(filenameHeader)) headersToFind.push(filenameHeader.trim())
  if (hasText(splitHeader)) headersToFind.push(splitHeader.trim())

  const headerMatch = findHeaderRow(rows, headersToFind)
  if (!headerMatch) {
    throw new Error('没有找到填写的表头名称，请检查第一张表。')
  }

  const filenameColumnIndex = hasText(filenameHeader)
    ? headerMatch.columnIndexes.get(filenameHeader.trim())
    : null
  const splitColumnIndex = hasText(splitHeader)
    ? headerMatch.columnIndexes.get(splitHeader.trim())
    : null

  const linksByHeader = new Map()
  for (const header of requestedHeaders) linksByHeader.set(header, [])
  const splitGroups = new Map()

  for (let rowIndex = headerMatch.rowIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] || []
    const rowLinksByHeader = new Map()
    if (splitColumnIndex != null) {
      for (const header of requestedHeaders) rowLinksByHeader.set(header, [])
    }

    for (const header of requestedHeaders) {
      const columnIndex = headerMatch.columnIndexes.get(header)
      const link = String(row[columnIndex] || '').trim()
      if (isHttpUrl(link)) {
        const customFilename =
          filenameColumnIndex == null ? '' : String(row[filenameColumnIndex] || '').trim()
        const item = { rowNumber: rowIndex + 1, url: link, customFilename }
        if (splitColumnIndex == null) linksByHeader.get(header).push(item)
        else rowLinksByHeader.get(header).push(item)
      }
    }

    if (splitColumnIndex != null) {
      let hasLinks = false
      for (const list of rowLinksByHeader.values()) {
        if (list.length) {
          hasLinks = true
          break
        }
      }
      if (hasLinks) {
        const splitValue = String(row[splitColumnIndex] || '').trim()
        const groupName = hasText(splitValue) ? splitValue : '未填写'
        let group = splitGroups.get(groupName)
        if (!group) {
          if (splitGroups.size >= MAX_SPLIT_GROUPS) {
            throw new Error(`拆分结果不能超过 ${MAX_SPLIT_GROUPS} 组。`)
          }
          group = {
            name: groupName,
            rowIndexes: [],
            linksByHeader: new Map(requestedHeaders.map((h) => [h, []]))
          }
          splitGroups.set(groupName, group)
        }
        group.rowIndexes.push(rowIndex)
        for (const header of requestedHeaders) {
          group.linksByHeader.get(header).push(...rowLinksByHeader.get(header))
        }
      }
    }
  }

  return { linksByHeader, splitGroups, headerMatch, rows }
}

function countLinks(extractResult) {
  if (extractResult.splitGroups.size) {
    let total = 0
    for (const group of extractResult.splitGroups.values()) {
      for (const list of group.linksByHeader.values()) total += list.length
    }
    return total
  }
  let total = 0
  for (const list of extractResult.linksByHeader.values()) total += list.length
  return total
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (err, value) => {
      if (settled) return
      settled = true
      if (err) reject(err)
      else resolve(value)
    }

    const doRequest = (targetUrl, redirectsLeft) => {
      let parsed
      try {
        parsed = new URL(targetUrl)
      } catch (e) {
        finish(new Error('无效链接'))
        return
      }
      const lib = parsed.protocol === 'http:' ? http : https
      const req = lib.get(
        targetUrl,
        {
          timeout: CONNECT_TIMEOUT_MS,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        },
        (res) => {
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location &&
            redirectsLeft > 0
          ) {
            const next = new URL(res.headers.location, targetUrl).toString()
            res.resume()
            doRequest(next, redirectsLeft - 1)
            return
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            res.resume()
            finish(new Error(`HTTP ${res.statusCode}`))
            return
          }
          const chunks = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () => {
            finish(null, {
              buffer: Buffer.concat(chunks),
              contentType: res.headers['content-type'] || '',
              contentDisposition: res.headers['content-disposition'] || ''
            })
          })
          res.on('error', finish)
        }
      )
      req.setTimeout(READ_TIMEOUT_MS, () => {
        req.destroy(new Error('下载超时'))
      })
      req.on('error', finish)
    }

    doRequest(url, 5)
  })
}

function parseContentDispositionFilename(contentDisposition) {
  if (!hasText(contentDisposition)) return ''
  const parts = contentDisposition.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.toLowerCase().startsWith('filename*=')) {
      const sep = trimmed.indexOf("''")
      const encoded = sep >= 0 ? trimmed.slice(sep + 2) : trimmed.slice('filename*='.length)
      try {
        return decodeURIComponent(encoded.replace(/^"|"$/g, ''))
      } catch {
        return encoded.replace(/^"|"$/g, '')
      }
    }
  }
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.toLowerCase().startsWith('filename=')) {
      return trimmed.slice('filename='.length).replace(/^"|"$/g, '')
    }
  }
  return ''
}

function extensionFromContentType(contentType) {
  if (!hasText(contentType)) return ''
  const mediaType = contentType.split(';', 2)[0].trim().toLowerCase()
  const map = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'application/json': '.json',
    'application/zip': '.zip',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx'
  }
  return map[mediaType] || ''
}

function extensionFromMagic(buffer) {
  if (!buffer || buffer.length < 4) return ''
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return '.pdf'
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return '.png'
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg'
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return '.gif'
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return '.webp'
  }
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) return '.zip'
  return ''
}

function hasFileExtension(filename) {
  const dot = filename.lastIndexOf('.')
  return dot > 0 && dot < filename.length - 1
}

function getFileExtension(filename) {
  const dot = filename.lastIndexOf('.')
  return hasFileExtension(filename) ? filename.slice(dot) : ''
}

function resolveDownloadFilename(url, contentDisposition, rowNumber) {
  const fromDisposition = parseContentDispositionFilename(contentDisposition)
  if (hasText(fromDisposition)) return sanitizeFilename(fromDisposition)
  try {
    const pathname = new URL(url).pathname
    const slash = pathname.lastIndexOf('/')
    let candidate = slash >= 0 ? pathname.slice(slash + 1) : pathname
    candidate = decodeURIComponent(candidate)
    if (hasText(candidate)) return sanitizeFilename(candidate)
  } catch {
    // fallback
  }
  return `row-${rowNumber}.bin`
}

function resolveOutputFilename(customFilename, originalFilename) {
  if (!hasText(customFilename)) return originalFilename
  const sanitized = sanitizeFilename(customFilename)
  if (hasFileExtension(sanitized)) return sanitized
  return sanitized + getFileExtension(originalFilename)
}

async function buildSplitWorkbookBuffer(rows, headerRowIndex, rowIndexes) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('拆分数据')
  const header = rows[headerRowIndex] || []
  const maxCols = Math.max(
    header.length,
    ...rowIndexes.map((i) => (rows[i] || []).length),
    1
  )
  const headerRow = []
  for (let c = 0; c < maxCols; c++) headerRow.push(header[c] || '')
  sheet.addRow(headerRow)
  for (const rowIndex of rowIndexes) {
    const source = rows[rowIndex] || []
    const values = []
    for (let c = 0; c < maxCols; c++) values.push(source[c] || '')
    sheet.addRow(values)
  }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

function createZipWriter(outputPath) {
  ensureParentDir(outputPath)
  const output = fs.createWriteStream(outputPath)
  const archive = archiver('zip', { zlib: { level: 9 } })
  const done = new Promise((resolve, reject) => {
    output.on('close', resolve)
    output.on('error', reject)
    archive.on('error', reject)
  })
  archive.pipe(output)
  return {
    appendBuffer(name, buffer) {
      archive.append(buffer, { name })
    },
    appendText(name, text) {
      archive.append(Buffer.from(text, 'utf8'), { name })
    },
    async finalize() {
      await archive.finalize()
      await done
    }
  }
}

async function writeHeaderFolder(zip, parentFolder, header, links, counter, onProgress) {
  const folderName = parentFolder
    ? `${parentFolder}${sanitizeFilename(header)}/`
    : `${sanitizeFilename(header)}/`
  const errors = []
  const usedNames = new Set()

  for (const link of links) {
    onProgress({
      message: `正在下载：${header} 第 ${link.rowNumber} 行`,
      percent: Math.min(99, Math.round((counter.completed * 100) / counter.total))
    })
    try {
      const { buffer, contentType, contentDisposition } = await downloadBuffer(link.url)
      let originalFilename = resolveDownloadFilename(link.url, contentDisposition, link.rowNumber)
      if (!hasFileExtension(originalFilename)) {
        let ext = extensionFromContentType(contentType)
        if (!ext || ext === '.bin') ext = extensionFromMagic(buffer)
        if (ext) originalFilename += ext
      }
      let filename = resolveOutputFilename(link.customFilename, originalFilename)
      filename = buildUniqueName(filename, usedNames)
      zip.appendBuffer(`${folderName}${filename}`, buffer)
      counter.completed += 1
      onProgress({
        message: `已下载 ${counter.completed} / ${counter.total}`,
        percent: Math.min(99, Math.round((counter.completed * 100) / counter.total))
      })
    } catch (error) {
      counter.completed += 1
      const message = `第 ${link.rowNumber} 行：${link.url} 下载失败，${error.message || error}`
      errors.push(message)
      onProgress({
        message,
        percent: Math.min(99, Math.round((counter.completed * 100) / counter.total))
      })
    }
  }

  if (errors.length) {
    zip.appendText(`${folderName}_download-errors.txt`, `${errors.join('\n')}\n`)
  }
  return errors.length
}

async function run(payload, onProgress = () => {}) {
  const { excelPath, outputPath, headersText, filenameHeader = '', splitHeader = '' } = payload || {}
  if (!excelPath || !fs.existsSync(excelPath)) throw new Error('请先选择 Excel 文件。')
  if (!outputPath) throw new Error('请选择输出 zip 文件。')

  const stat = fs.statSync(excelPath)
  validateFile(path.basename(excelPath), stat.size)

  const headers = parseDelimitedList(headersText)
  if (!headers.length) throw new Error('请填写至少一个表头名称。')

  onProgress({ message: '读取 Excel...', percent: 1 })
  const rows = await readSheetRows(excelPath)
  const extractResult = extractLinks(rows, headers, filenameHeader, splitHeader)
  const totalLinks = countLinks(extractResult)
  if (!totalLinks) throw new Error('指定表头下未找到可下载链接。')

  onProgress({ message: '开始打包下载链接...', percent: 2 })
  const counter = { completed: 0, total: totalLinks }
  let errorCount = 0
  const zip = createZipWriter(outputPath)

  if (extractResult.splitGroups.size) {
    for (const group of extractResult.splitGroups.values()) {
      const groupFolder = `${sanitizeFilename(group.name)}/`
      const workbookBytes = await buildSplitWorkbookBuffer(
        extractResult.rows,
        extractResult.headerMatch.rowIndex,
        group.rowIndexes
      )
      zip.appendBuffer(`${groupFolder}${sanitizeFilename(group.name)}.xlsx`, workbookBytes)
      for (const [header, links] of group.linksByHeader.entries()) {
        errorCount += await writeHeaderFolder(zip, groupFolder, header, links, counter, onProgress)
      }
    }
  } else {
    for (const [header, links] of extractResult.linksByHeader.entries()) {
      errorCount += await writeHeaderFolder(zip, '', header, links, counter, onProgress)
    }
  }

  await zip.finalize()
  onProgress({ message: '处理完成', percent: 100 })
  return { totalLinks, errorCount, outputPath }
}

module.exports = { run }

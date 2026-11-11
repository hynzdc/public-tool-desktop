const fs = require('fs')
const pdfParse = require('pdf-parse')
const { normalizePath } = require('./utils')

const ROOT_FOLDER_KEY = '__ROOT__'

async function extractTextFromPdfFile(filePath) {
  const buffer = fs.readFileSync(filePath)
  return extractTextFromPdfBuffer(buffer)
}

async function extractTextFromPdfBuffer(buffer) {
  try {
    const data = await pdfParse(buffer)
    return data.text || ''
  } catch (error) {
    return pdfExtractErrorText(error)
  }
}

function pdfExtractErrorText(error) {
  if (String(error.message || '').toLowerCase().includes('encrypt')) {
    return 'PDF文件已加密，无法提取文字'
  }
  throw new Error(`PDF文字提取失败: ${error.message || error}`)
}

/**
 * 发票识别专用：保留与 pdf-parse 默认一致的文本顺序，同时按坐标找出左右两栏的购销方。
 * 电子普通发票的销售方经常不是「有限公司」，只靠全文正则会漏掉或误取备注里的开户行。
 */
function renderInvoicePage(pageData, pages) {
  return pageData.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false
  }).then((textContent) => {
    let lastY
    let text = ''
    const items = []
    for (const item of textContent.items) {
      const str = item.str || ''
      const x = item.transform ? item.transform[4] : 0
      const y = item.transform ? item.transform[5] : 0
      if (str.trim()) items.push({ str, x, y })
      if (lastY == y || !lastY) text += str
      else text += `\n${str}`
      lastY = y
    }
    pages.push(items)
    return text
  })
}

function isPlausibleLayoutName(value) {
  const name = String(value || '').replace(/\s+/g, '').trim()
  if (name.length < 2 || name.length > 60) return false
  if (!/[\u4e00-\u9fff]{2,}/.test(name)) return false
  if (/项目名称|规格型号|统一社会|纳税人|开户银行|银行账号|地址|电话|价税合计|税率/.test(name)) return false
  if (/[0-9]{6,}/.test(name)) return false
  return true
}

function parseNameLabel(str) {
  const text = String(str || '').trim()
  if (!text || /项目名称|规格型号|单位|单价|金额|税额|税率/.test(text)) return null
  const matched = /^(?:购买方|销售方|购方|销方|买方|售方)?名称[:：]?(.*)$/.exec(text)
  if (!matched) return null
  if (text.length > 48 && !matched[1]) return null
  return { inline: (matched[1] || '').trim() }
}

function findNameLabels(items) {
  const labels = []
  for (const item of items) {
    const parsed = parseNameLabel(item.str)
    if (parsed) labels.push({ x: item.x, y: item.y, inline: parsed.inline })
  }
  if (labels.length >= 2) return labels

  for (const item of items) {
    if (item.str.trim() !== '名') continue
    const suffix = items.find((other) =>
      other.str.trim() === '称' &&
      Math.abs(other.y - item.y) <= 2.5 &&
      other.x > item.x &&
      other.x - item.x < 36
    )
    if (suffix) labels.push({ x: item.x, y: item.y, inline: '' })
  }
  return labels
}

function collectNameValue(label, items, rightBound) {
  if (isPlausibleLayoutName(label.inline)) return label.inline.replace(/\s+/g, '')
  const parts = items
    .filter((item) =>
      Math.abs(item.y - label.y) <= 2.5 &&
      item.x > label.x + 0.5 &&
      item.x < rightBound &&
      item.str.trim() !== '名称' &&
      item.str.trim() !== '名称：' &&
      item.str.trim() !== '名称:'
    )
    .sort((a, b) => a.x - b.x)
  if (!parts.length || parts[0].x - label.x > 180) return null

  let text = ''
  let previousX = label.x
  for (const part of parts) {
    if (text && part.x - previousX > 80) break
    text += part.str
    previousX = part.x
  }
  const name = text.replace(/\s+/g, '').trim()
  return isPlausibleLayoutName(name) ? name : null
}

function inferInvoicePartiesFromItems(items) {
  const labels = findNameLabels(items)
  if (labels.length < 2) return null

  const sorted = [...labels].sort((a, b) => b.y - a.y || a.x - b.x)
  let pair = null
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted.filter((label) => Math.abs(label.y - sorted[i].y) <= 2.5)
    if (row.length >= 2) {
      row.sort((a, b) => a.x - b.x)
      pair = [row[0], row[row.length - 1]]
      break
    }
  }
  if (!pair) return null

  const [buyerLabel, sellerLabel] = pair
  const buyerName = collectNameValue(buyerLabel, items, sellerLabel.x - 1)
  const sellerName = collectNameValue(sellerLabel, items, Number.POSITIVE_INFINITY)
  if (!buyerName && !sellerName) return null
  if (buyerName && sellerName && buyerName === sellerName) return null
  return { buyerName, sellerName }
}

function inferInvoiceParties(pages) {
  for (const items of pages) {
    const parties = inferInvoicePartiesFromItems(items)
    if (parties && (parties.buyerName || parties.sellerName)) return parties
  }
  return null
}

async function extractInvoiceSourceFromPdfFile(filePath) {
  const buffer = fs.readFileSync(filePath)
  return extractInvoiceSourceFromPdfBuffer(buffer)
}

async function extractInvoiceSourceFromPdfBuffer(buffer) {
  const pages = []
  try {
    const data = await pdfParse(buffer, {
      pagerender: (pageData) => renderInvoicePage(pageData, pages)
    })
    return {
      text: data.text || '',
      layoutParties: inferInvoiceParties(pages)
    }
  } catch (error) {
    const text = pdfExtractErrorText(error)
    return { text, layoutParties: null }
  }
}

function determineCommonRoot(paths) {
  if (!paths || !paths.length) return null
  let candidate = null
  let hasSecondLevel = false
  for (const p of paths) {
    if (!p) continue
    const slashIndex = p.indexOf('/')
    if (slashIndex >= 0 && p.indexOf('/', slashIndex + 1) >= 0) {
      hasSecondLevel = true
    }
    const firstSegment = slashIndex >= 0 ? p.slice(0, slashIndex) : p
    if (candidate == null) candidate = firstSegment
    else if (candidate !== firstSegment) return null
  }
  return hasSecondLevel ? candidate : null
}

function groupPdfTextsByLeafFolder(pdfTextsByPath) {
  const result = new Map()
  if (!pdfTextsByPath || !Object.keys(pdfTextsByPath).length) return result

  const normalizedPaths = Object.keys(pdfTextsByPath)
    .filter(Boolean)
    .map((p) => normalizePath(p))
  const commonRoot = determineCommonRoot(normalizedPaths)

  for (const [originalPath, text] of Object.entries(pdfTextsByPath)) {
    if (!originalPath) continue
    let relative = normalizePath(originalPath)
    if (commonRoot && relative.startsWith(`${commonRoot}/`)) {
      relative = relative.slice(commonRoot.length + 1)
    }

    const lastSlash = relative.lastIndexOf('/')
    let folderName = ROOT_FOLDER_KEY
    let fileName = relative
    if (lastSlash >= 0) {
      const parentPath = relative.slice(0, lastSlash)
      const parentSlash = parentPath.lastIndexOf('/')
      folderName = parentSlash >= 0 ? parentPath.slice(parentSlash + 1) : parentPath
      fileName = relative
    }
    if (!folderName || !String(folderName).trim()) folderName = ROOT_FOLDER_KEY
    if (!fileName || !String(fileName).trim()) {
      fileName = relative.split('/').pop() || 'file.pdf'
    }

    if (!result.has(folderName)) result.set(folderName, new Map())
    result.get(folderName).set(fileName, text)
  }
  return result
}

module.exports = {
  ROOT_FOLDER_KEY,
  extractTextFromPdfFile,
  extractTextFromPdfBuffer,
  extractInvoiceSourceFromPdfFile,
  extractInvoiceSourceFromPdfBuffer,
  groupPdfTextsByLeafFolder
}

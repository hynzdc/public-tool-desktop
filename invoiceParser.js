const MONEY_PATTERN = '-?[0-9]+\\.[0-9]{2}'
const COMPANY_NAME_PATTERN =
  '([^\\s]{2,80}?(?:有限责任公司|有限公司)(?:[^\\s]{1,30}?分公司)?)'
const TAX_ID_PATTERN = '[0-9A-Za-z]{15,20}'
// 普通发票销售方经常是个体户、工作室、服务部，不能只认「有限公司」。
const PARTY_ORG_SUFFIX =
  '有限责任公司|股份有限公司|集团有限公司|有限公司|股份公司|' +
  '合伙企业(?:\\(有限合伙\\)|（有限合伙）)?|个体工商户|个人独资企业|' +
  '工作室|经营部|服务部|劳务部|合作社|事务所|商行|中心|公司|厂|店'
const PARTY_NAME_PATTERN =
  `[\\u4e00-\\u9fff·（）()]{2,40}?(?:${PARTY_ORG_SUFFIX})(?:[\\u4e00-\\u9fff·（）()]{1,12}?分公司)?[）)]?`
const UNIT_TOKENS = [
  '立方米', '千克', '公斤', '公里', '小时', '分钟', '车次',
  '趟', '吨', '辆', '台', '套', '件', '箱', '袋', '包', '卷', '票', '张',
  '个', '次', '人', '天', '米', '月'
]

function extractByPattern(text, patternStr) {
  const matcher = new RegExp(patternStr).exec(text)
  return matcher ? matcher[1] : null
}

function normalizeForNameParse(text) {
  return text.replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, '')
}

function normalizeForItemParse(text) {
  let normalized = text
  normalized = normalized.replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, '')
  normalized = normalized.replace(/(?<=\*)\s+(?=\p{Script=Han})/gu, '')
  normalized = normalized.replace(/(?<=\p{Script=Han})\s+(?=\*)/gu, '')
  normalized = normalized.replace(/\s+(?=[%％])/g, '')
  return normalized
}

function normalizeRate(rate) {
  if (rate == null) return null
  return rate.replace(/\s+/g, '').replace('％', '%')
}

function normalizeDate(dateStr) {
  const normalized = dateStr.replace(/\s+/g, '')
  const matcher = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(normalized)
  if (matcher) {
    const year = matcher[1]
    const month = String(Number(matcher[2])).padStart(2, '0')
    const day = String(Number(matcher[3])).padStart(2, '0')
    return `${year}年${month}月${day}日`
  }
  return normalized
}

function extractDate(text) {
  const patterns = [
    /开票日期[\s:：]*([0-9]{4}\s*年\s*[0-9]{1,2}\s*月\s*[0-9]{1,2}\s*日)/,
    /开票日期[^0-9]*([0-9]{4}年[0-9]{1,2}月[0-9]{1,2}日)/,
    // 电子发票常见：标签与日期分离，日期单独成行
    /([0-9]{4}\s*年\s*[0-9]{1,2}\s*月\s*[0-9]{1,2}\s*日)/
  ]
  for (const pattern of patterns) {
    const matcher = pattern.exec(text)
    if (matcher) return normalizeDate(matcher[1])
  }
  return null
}

function extractBuyerSellerPair(text, result) {
  if (!text) return
  const tailBoundary = '(?=(?:方|信|息){0,6}(?:统一社会信用代码|项目名称|$))'
  const patterns = [
    new RegExp(
      `(?:购买方名称|买方名称|购方名称|买名称|购买名称|购销买名称)[:：]*${COMPANY_NAME_PATTERN}` +
        `(?:销售方名称|售方名称|销方名称|售名称|销名称)[:：]*${COMPANY_NAME_PATTERN}${tailBoundary}`
    ),
    new RegExp(
      `购销买名称[:：]*${COMPANY_NAME_PATTERN}售名称[:：]*${COMPANY_NAME_PATTERN}${tailBoundary}`
    )
  ]
  for (const pattern of patterns) {
    const matcher = pattern.exec(text)
    if (matcher) {
      result['购买方名称'] = matcher[1].trim()
      result['销售方名称'] = matcher[2].trim()
      return
    }
  }
}

function extractBuyerName(text) {
  const normalizedText = normalizeForNameParse(text)
  const patterns = [
    new RegExp(`(?:购|买)[^名]{0,6}名称[:：]*${COMPANY_NAME_PATTERN}(?=(?:销|售)名称|销售方|售方|销方|$)`),
    new RegExp(`购[^名]*名称：${COMPANY_NAME_PATTERN}`),
    new RegExp(`买\\s*方[^天]*(天津[^\\s销]{2,50}?(?:有限责任公司|有限公司)(?:[^\\s]{1,30}?分公司)?)`),
    new RegExp(`(天津[^\\s]{2,40}?物流有限公司(?:[^\\s]{1,30}?分公司)?)`),
    new RegExp(`购方名称[:：]*${COMPANY_NAME_PATTERN}`),
    new RegExp(`买方名称[:：]*${COMPANY_NAME_PATTERN}`),
    new RegExp(`购买方名称[:：]*${COMPANY_NAME_PATTERN}`)
  ]
  for (const pattern of patterns) {
    const matcher = pattern.exec(normalizedText)
    if (matcher) return matcher[1].trim()
  }
  return null
}

function extractSellerNameWithSpaces(text) {
  const normalizedText = normalizeForNameParse(text)
  const tailBoundary =
    '(?=(?:方|信|息){0,6}(?:购|买)名称|购方|买方|项目名称|(?:方|信|息){0,6}统一社会信用代码|$)'
  const patterns = [
    // 标签和名称在同一处时，普通发票的服务部/工作室也能命中，不能把后面的字段名吃进去
    new RegExp(`(?:销|售)[^名]{0,8}名称[:：]\\s*(${PARTY_NAME_PATTERN})`),
    new RegExp(`(?:销|售)[^名]{0,6}名称[:：]*${COMPANY_NAME_PATTERN}${tailBoundary}`),
    new RegExp(`(?<!购)销[\\s\\S]{0,20}?名称\\s*[：:]\\s*${COMPANY_NAME_PATTERN}`),
    new RegExp(`销售方[\\s\\S]{0,50}?名称\\s*[：:]\\s*${COMPANY_NAME_PATTERN}`),
    new RegExp(`售\\s*方[\\s\\S]{0,30}?${COMPANY_NAME_PATTERN}`)
  ]
  for (const pattern of patterns) {
    const matcher = pattern.exec(normalizedText)
    if (matcher) return matcher[1].trim().replace(/\s+/g, ' ').trim()
  }
  return null
}

function extractAmountAndTaxFromTotalLine(text) {
  const normalizedText = text.replace(/\s+/g, ' ')
  const patterns = [
    /合\s*计[^0-9¥￥-]*[¥￥]\s*(-?[0-9]+\.[0-9]{2})\s*[¥￥]\s*(-?[0-9]+\.[0-9]{2})/,
    /合\s*计[^0-9-]*(-?[0-9]+\.[0-9]{2})\s+(-?[0-9]+\.[0-9]{2})/,
    // 电子发票常见：合计金额与税额紧挨 ¥8680699.40¥1128490.92
    /[¥￥]\s*(-?[0-9]+\.[0-9]{2})\s*[¥￥]\s*(-?[0-9]+\.[0-9]{2})/
  ]
  for (const pattern of patterns) {
    const matcher = pattern.exec(normalizedText)
    if (matcher) return [matcher[1], matcher[2]]
  }
  return null
}

function extractTotalAmount(text) {
  let normalizedText = text.replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, '')
  normalizedText = normalizedText.replace(/\s+/g, ' ')
  const patterns = [
    /小写[^¥￥]*[¥￥]\s*(-?[0-9]+\.[0-9]{2})/,
    /价税合计[^¥￥]*[¥￥]\s*(-?[0-9]+\.[0-9]{2})/
  ]
  for (const pattern of patterns) {
    const matcher = pattern.exec(normalizedText)
    if (matcher) return matcher[1]
  }
  return null
}

function buildLoosePattern(value) {
  let sb = ''
  for (const ch of value) {
    if (/\s/.test(ch)) {
      sb += '\\s*'
      continue
    }
    sb += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*'
  }
  return sb
}

function buildUnitAlternationPattern() {
  return `(?:${UNIT_TOKENS.map(buildLoosePattern).join('|')})`
}

function isUnitToken(value) {
  return UNIT_TOKENS.includes(value)
}

function hasUnitAfterItem(cleanText, itemBase, unit) {
  const pattern = new RegExp(`${buildLoosePattern(itemBase)}\\s*${buildLoosePattern(unit)}\\s*[0-9]`)
  return pattern.test(cleanText)
}

function cleanItemName(itemName, cleanText) {
  if (itemName == null) return null
  let cleaned = itemName.trim()
  if (!cleanText) return cleaned
  for (const unit of UNIT_TOKENS) {
    if (!cleaned.endsWith(unit)) continue
    const base = cleaned.slice(0, cleaned.length - unit.length)
    if (!base) continue
    if (hasUnitAfterItem(cleanText, base, unit)) return base
  }
  return cleaned
}

function cleanupItemNameText(itemText) {
  if (itemText == null) return null
  let cleaned = itemText
  cleaned = cleaned.replace(/规\s*格\s*型\s*号/g, ' ')
  cleaned = cleaned.replace(/单\s*位/g, ' ')
  cleaned = cleaned.replace(/数\s*量/g, ' ')
  cleaned = cleaned.replace(/单\s*价/g, ' ')
  cleaned = cleaned.replace(/金\s*额/g, ' ')
  cleaned = cleaned.replace(/税\s*率\s*\/\s*征\s*收\s*率/g, ' ')
  cleaned = cleaned.replace(/税\s*额/g, ' ')
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  cleaned = cleaned.replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, '')
  cleaned = cleaned.replace(/(?<=\*)\s+(?=\p{Script=Han})/gu, '')
  cleaned = cleaned.replace(/(?<=\p{Script=Han})\s+(?=\*)/gu, '')
  return cleaned.trim()
}

function extractTrailingHan(tail) {
  if (tail == null) return null
  const trimmed = tail.trim()
  if (trimmed.startsWith('*')) return null
  const matcher = /^(\p{Script=Han}{1,4})/u.exec(trimmed)
  if (matcher) {
    const fragment = matcher[1]
    if (isUnitToken(fragment)) return null
    return fragment
  }
  return null
}

function extractItemDetailsByTable(text, result) {
  if (!text) return false
  const normalized = text.replace(/\s+/g, ' ').trim()
  const start = normalized.indexOf('项目名称')
  if (start < 0) return false
  const totalMatcher = /合\s*计/.exec(normalized.slice(start))
  if (!totalMatcher) return false
  const section = normalized.slice(start, start + totalMatcher.index)

  const unitPattern = buildUnitAlternationPattern()
  const qtyPattern = '([0-9]+(?:\\.[0-9]+)?)'
  const pricePattern = '([0-9]+(?:\\.[0-9]+)?)'
  const amountPattern = `(${MONEY_PATTERN})`
  const ratePatternStr = '([0-9]+(?:\\.[0-9]+)?\\s*[%％])'
  const taxPattern = `(${MONEY_PATTERN})`

  const rowPattern = new RegExp(
    `项目名称\\s*([\\s\\S]+?)\\s+${unitPattern}\\s+${qtyPattern}\\s+` +
      `${pricePattern}\\s+${amountPattern}\\s+${ratePatternStr}\\s+${taxPattern}`
  )
  const rowMatcher = rowPattern.exec(section)
  if (!rowMatcher) return false

  let itemRaw = cleanupItemNameText(rowMatcher[1])
  const tail = section.slice(rowMatcher.index + rowMatcher[0].length)
  const tailWord = extractTrailingHan(tail)
  if (tailWord && !itemRaw.endsWith(tailWord)) itemRaw += tailWord

  result['项目名称'] = cleanItemName(itemRaw, text)
  result['金额'] = rowMatcher[4]
  result['税率'] = normalizeRate(rowMatcher[5])
  result['税额'] = rowMatcher[6]
  return true
}

function extractItemDetails(text, result) {
  const ratePatternStr = '([0-9]+(?:\\.[0-9]+)?\\s*[%％])'
  const ratePattern = new RegExp(ratePatternStr)
  const normalizedText = normalizeForItemParse(text)

  if (extractItemDetailsByTable(text, result)) return

  const pattern1 = new RegExp(
    `(\\*[^\\s]*\\*[^\\s]*)\\s+(${MONEY_PATTERN})\\s+${ratePatternStr}\\s+(${MONEY_PATTERN})`
  )
  let matcher = pattern1.exec(normalizedText)
  if (matcher) {
    result['项目名称'] = cleanItemName(matcher[1].trim(), text)
    result['金额'] = matcher[2]
    result['税率'] = normalizeRate(matcher[3])
    result['税额'] = matcher[4]
    return
  }

  const pattern2 = new RegExp(
    `项目名称[^\\*]*(\\*[^\\s]*\\*[^\\s]*)[^0-9-]*(${MONEY_PATTERN})[^0-9-]*${ratePatternStr}[^0-9-]*(${MONEY_PATTERN})`
  )
  matcher = pattern2.exec(normalizedText)
  if (matcher) {
    result['项目名称'] = cleanItemName(matcher[1].trim(), text)
    result['金额'] = matcher[2]
    result['税率'] = normalizeRate(matcher[3])
    result['税额'] = matcher[4]
    return
  }

  const itemPattern = /项目名称[^*]*(\*[^*]{1,40}\*[^\s]{1,40})/
  const itemMatcher = itemPattern.exec(normalizedText)
  if (itemMatcher) {
    result['项目名称'] = cleanItemName(itemMatcher[1].trim(), text)
    const afterItem = normalizedText.slice(itemMatcher.index + itemMatcher[0].length)
    const amountPattern = new RegExp(`(${MONEY_PATTERN})`, 'g')
    let amount = null
    let rate = null
    let tax = null

    const rateMatcher = ratePattern.exec(afterItem)
    if (rateMatcher) {
      rate = normalizeRate(rateMatcher[1])
      const beforeRate = afterItem.slice(0, rateMatcher.index)
      let m
      const re = new RegExp(`(${MONEY_PATTERN})`, 'g')
      while ((m = re.exec(beforeRate))) amount = m[1]
      const afterRate = afterItem.slice(rateMatcher.index + rateMatcher[0].length)
      const taxMatcher = new RegExp(`(${MONEY_PATTERN})`).exec(afterRate)
      if (taxMatcher) tax = taxMatcher[1]
    }

    if (amount == null) {
      const amountMatcher = amountPattern.exec(afterItem)
      if (amountMatcher) amount = amountMatcher[1]
    }
    if (amount != null) result['金额'] = amount
    if (rate != null) result['税率'] = rate
    if (tax != null) result['税额'] = tax
  }

  if (!result['金额']) {
    const totalPattern = new RegExp(
      `合\\s*计[^¥￥]*[¥￥]\\s*(${MONEY_PATTERN})[^¥￥]*[¥￥]\\s*(${MONEY_PATTERN})`
    )
    const totalMatcher = totalPattern.exec(text)
    if (totalMatcher) {
      result['金额'] = totalMatcher[1]
      result['税额'] = totalMatcher[2]
    }
  }

  if (!result['税率']) {
    const rateByLabel = new RegExp(`税率/征收率[^0-9％%]*${ratePatternStr}`)
    const rateMatcher = rateByLabel.exec(normalizedText)
    if (rateMatcher) result['税率'] = normalizeRate(rateMatcher[1])
    else {
      const anyRate = ratePattern.exec(normalizedText)
      if (anyRate) result['税率'] = normalizeRate(anyRate[1])
    }
  }
}

/**
 * 全角/半角括号统一，去掉汉字间空格，便于公司名匹配。
 */
function compactChineseText(text) {
  return String(text || '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, '')
    .replace(/(?<=\p{Script=Han})\s+(?=[(])/gu, '')
    .replace(/(?<=[)])\s+(?=\p{Script=Han})/gu, '')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 发票文本去空白（电子发票 PDF 常在汉字间插入空格） */
function stripAllSpaces(text) {
  return String(text || '').replace(/\s+/g, '')
}

/**
 * 从去空白文本中提取公司名（以有限公司结尾，向前截取合理长度）。
 */
function extractCompanyNames(text) {
  const compact = stripAllSpaces(text)
  const names = []
  const seen = new Set()
  const re = /有限责任公司|有限公司/g
  let match
  while ((match = re.exec(compact))) {
    const end = match.index + match[0].length
    // 向前取最多 40 字，遇到税号/发票号/日期等边界停下
    const windowStart = Math.max(0, match.index - 40)
    let chunk = compact.slice(windowStart, end)
    // 去掉前缀数字、税号、日期杂质
    chunk = chunk.replace(/^.*?((?:[\u4e00-\u9fff·]|[（）()]){2,}(?:有限责任公司|有限公司))$/u, '$1')
    // 更稳妥：只保留末尾连续的中文/括号公司名
    const pure = new RegExp(`(${PARTY_NAME_PATTERN})$`, 'u').exec(chunk)
    let name = pure ? pure[1] : null
    if (!name) continue
    name = name.replace(/^[（）()]+/, '')
    name = stripDatePrefix(name)
    const before = compact.slice(Math.max(0, match.index - 16), match.index)
    if (/开户银行[:：]?$|银行[:：]?$/.test(before)) continue
    if (name.length < 4 || name.length > 50) continue
    if (/项目名称|规格型号|价税合计|统一社会|纳税人/.test(name)) continue
    if (seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

/**
 * 全电发票数值块常见顺序：
 * 发票号码 → 开票日期 → 购方名称 → 购方税号 → 销方名称 → 销方税号 → 金额...
 */
function stripDatePrefix(name) {
  const stripped = String(name || '').replace(/^(?:[0-9]{2,4}年)?[0-9]{1,2}月[0-9]{1,2}日|^[日月年]+/u, '')
  return stripped.length >= 2 ? stripped : name
}

function isSuspiciousPartyName(name) {
  const value = String(name || '').replace(/\s+/g, '')
  if (value.length < 2 || value.length > 60) return true
  if (/[0-9]{8,}/.test(value)) return true
  if (/开户银行|银行账号|统一社会|纳税人|项目名称|价税合计|规格型号|地址|电话/.test(value)) return true
  if (/[0-9]{4}年|月[0-9]{1,2}日/.test(value)) return true
  return false
}

function isBankRemarkName(text, name) {
  const value = String(name || '').replace(/\s+/g, '')
  if (!value) return false
  const compact = stripAllSpaces(text)
  const index = compact.indexOf(value)
  if (index < 0) return false
  const before = compact.slice(Math.max(0, index - 16), index)
  return /开户银行[:：]?$|银行[:：]?$/.test(before)
}

/**
 * 电子发票文本常把购方名称、购方税号、销方名称、销方税号排成连续数值块。
 * 销售方不要求是公司，服务部、工作室、个体户都认。
 */
function extractBuyerSellerByTaxIds(text) {
  const compact = stripAllSpaces(text)
  const orgPattern = new RegExp(
    `(${PARTY_NAME_PATTERN})(${TAX_ID_PATTERN})(${PARTY_NAME_PATTERN})(${TAX_ID_PATTERN})`,
    'g'
  )
  let match = orgPattern.exec(compact)
  if (!match) {
    const loosePattern = new RegExp(
      `([\\u4e00-\\u9fff·（）()]{2,40})(${TAX_ID_PATTERN})([\\u4e00-\\u9fff·（）()]{2,40})(${TAX_ID_PATTERN})`,
      'g'
    )
    match = loosePattern.exec(compact)
  }
  if (!match) return null
  const buyerName = stripDatePrefix(match[1])
  const sellerName = stripDatePrefix(match[3])
  if (isSuspiciousPartyName(buyerName) || isSuspiciousPartyName(sellerName)) return null
  if (buyerName === sellerName) return null
  return { buyerName, sellerName }
}

function shouldReplacePartyName(current, candidate, rawText) {
  if (!candidate || isSuspiciousPartyName(candidate)) return false
  if (!current) return true
  if (current === candidate) return false
  if (isSuspiciousPartyName(current)) return true
  if (isBankRemarkName(rawText, current) && !isBankRemarkName(rawText, candidate)) return true
  if (current.endsWith(candidate) && current.length > candidate.length) return true
  return false
}

function reconcileBuyerSeller(rawText, result, layoutParties) {
  const byTax = extractBuyerSellerByTaxIds(rawText)
  const layout = layoutParties || {}
  const buyerCandidate = layout.buyerName || (byTax && byTax.buyerName) || null
  const sellerCandidate = layout.sellerName || (byTax && byTax.sellerName) || null

  if (shouldReplacePartyName(result['购买方名称'], buyerCandidate, rawText)) {
    result['购买方名称'] = buyerCandidate
  }
  if (shouldReplacePartyName(result['销售方名称'], sellerCandidate, rawText)) {
    result['销售方名称'] = sellerCandidate
  }
  if (isSuspiciousPartyName(result['销售方名称']) && byTax && byTax.sellerName) {
    result['销售方名称'] = byTax.sellerName
  }
  if (isSuspiciousPartyName(result['购买方名称']) && byTax && byTax.buyerName) {
    result['购买方名称'] = byTax.buyerName
  }
}

function extractBuyerSellerFromValueBlock(text) {
  const compact = stripAllSpaces(text)
  const pattern = new RegExp(
    `([0-9]{20})(\\d{4}年\\d{1,2}月\\d{1,2}日)(${PARTY_NAME_PATTERN})(${TAX_ID_PATTERN})(${PARTY_NAME_PATTERN})(${TAX_ID_PATTERN})`
  )
  const match = pattern.exec(compact)
  if (!match) return null
  return {
    invoiceNumber: match[1],
    invoiceDate: normalizeDate(match[2]),
    buyerName: match[3],
    buyerTaxId: match[4],
    sellerName: match[5],
    sellerTaxId: match[6]
  }
}

function extractYenAmounts(text) {
  const amounts = []
  const re = /[¥￥]\s*(-?[0-9]+(?:\.[0-9]{2})?)/g
  let match
  while ((match = re.exec(text || ''))) {
    amounts.push(match[1])
  }
  return amounts
}

function extractItemNameLoose(text) {
  const compact = compactChineseText(text)
  // *类别*商品名，商品名可能被换行拆开
  const starPattern = /\*([^*]{1,40})\*([^*\n¥￥]{1,60}?)(?=\d|吨|千克|公斤|个|次|%|％|税率|合计|$)/
  const m = starPattern.exec(compact)
  if (m) {
    let name = `*${m[1].trim()}*${m[2].trim()}`
    name = name.replace(/\s+/g, '')
    // 去掉尾部单位
    for (const unit of UNIT_TOKENS) {
      if (name.endsWith(unit)) {
        name = name.slice(0, -unit.length)
        break
      }
    }
    return name
  }
  const loose = /\*([^*]+)\*([^\d¥￥*]{1,40})/.exec(compact)
  if (loose) {
    return `*${loose[1].replace(/\s+/g, '')}*${loose[2].replace(/\s+/g, '').replace(/(吨|千克|公斤)$/, '')}`
  }
  return null
}

/**
 * 电子发票 PDF 文本常被抽取成「先标签、后数值」乱序。
 * 当常规规则缺字段时，用数值块启发式补全。
 */
function fillElectronicInvoiceFallback(rawText, result, options = {}) {
  const text = String(rawText || '')
  const compact = compactChineseText(text)
  const noSpace = stripAllSpaces(text)

  const valueBlock = extractBuyerSellerFromValueBlock(text)
  if (valueBlock) {
    if (!result['发票号码']) result['发票号码'] = valueBlock.invoiceNumber
    if (!result['开票日期']) result['开票日期'] = valueBlock.invoiceDate
    // 数值块顺序比标签旁正则更可靠，缺字段或明显异常时覆盖
    if (!result['购买方名称'] || result['购买方名称'].length < 4) {
      result['购买方名称'] = valueBlock.buyerName
    }
    if (
      !result['销售方名称'] ||
      result['销售方名称'].length < 4 ||
      result['销售方名称'].length > 40 ||
      /[0-9]{10,}/.test(result['销售方名称']) ||
      result['销售方名称'] === result['购买方名称']
    ) {
      result['销售方名称'] = valueBlock.sellerName
    }
  }

  if (!result['发票号码']) {
    const labeled = /发票号码[：:]*([0-9]{20})/.exec(noSpace)
    const all20 = noSpace.match(/[0-9]{20}/g) || []
    const number = (labeled && labeled[1]) || all20[0] || null
    if (number) result['发票号码'] = number
  }

  if (!result['开票日期']) {
    const date = extractDate(text) || extractDate(compact)
    if (date) result['开票日期'] = date
  }

  const companies = extractCompanyNames(text)
  if (companies.length >= 2) {
    if (!result['购买方名称']) result['购买方名称'] = companies[0]
    if (!result['销售方名称']) result['销售方名称'] = companies[1]
  } else if (companies.length === 1) {
    if (!result['购买方名称']) result['购买方名称'] = companies[0]
    else if (!result['销售方名称'] && companies[0] !== result['购买方名称']) {
      result['销售方名称'] = companies[0]
    }
  }

  if (result['购买方名称'] && !result['销售方名称'] && companies.length >= 2) {
    const other = companies.find((n) => n !== result['购买方名称'])
    if (other) result['销售方名称'] = other
  }

  // 普通发票销售方可能不是公司；已识别出的开户行名称也要换成税号旁的真实销方
  reconcileBuyerSeller(text, result, options.layoutParties)

  const yenAmounts = extractYenAmounts(text)
  // 典型：合计金额、合计税额、价税合计（小写）
  if (yenAmounts.length >= 2) {
    // 优先用相邻双金额作为合计金额/税额（通常是前两个）
    if (!result['金额'] || !result['税额'] || result['金额'] === result['税额']) {
      result['金额'] = yenAmounts[0]
      result['税额'] = yenAmounts[1]
    }
  }
  if (yenAmounts.length >= 3) {
    // 价税合计一般是带 ¥ 的最后一个金额
    result['价税合计'] = yenAmounts[yenAmounts.length - 1]
  } else if (yenAmounts.length === 1 && !result['价税合计']) {
    result['价税合计'] = yenAmounts[0]
  }

  // 大写金额后的 ¥xxx 更像价税合计
  const afterCapital = /[零壹贰叁肆伍陆柒捌玖拾佰仟万亿整角分]+[¥￥]\s*(-?[0-9]+\.[0-9]{2})/.exec(
    noSpace
  )
  if (afterCapital) {
    result['价税合计'] = afterCapital[1]
  }

  // 校验：金额+税额 ≈ 价税合计 时，前两个确认为合计行
  if (yenAmounts.length >= 3) {
    const a = Number(yenAmounts[0])
    const t = Number(yenAmounts[1])
    const total = Number(yenAmounts[yenAmounts.length - 1])
    if (Number.isFinite(a) && Number.isFinite(t) && Number.isFinite(total)) {
      if (Math.abs(a + t - total) < 0.05) {
        result['金额'] = yenAmounts[0]
        result['税额'] = yenAmounts[1]
        result['价税合计'] = yenAmounts[yenAmounts.length - 1]
      }
    }
  }

  if (!result['税率']) {
    const rate = /([0-9]+(?:\.[0-9]+)?)\s*[%％]/.exec(compact)
    if (rate) result['税率'] = normalizeRate(`${rate[1]}%`)
  }

  if (!result['项目名称'] || result['项目名称'].length < 4) {
    const itemName = extractItemNameLoose(text)
    if (itemName) result['项目名称'] = itemName
  }

  return result
}

function parseInvoiceInfo(pdfText, options = {}) {
  const result = {}
  const rawText = String(pdfText || '')
  const cleanText = rawText.replace(/\s+/g, ' ').trim()
  const normalizedNameText = normalizeForNameParse(cleanText)

  const invoiceNumber = extractByPattern(cleanText.replace(/ /g, ''), '发票号码：([0-9]{20})')
  if (invoiceNumber) result['发票号码'] = invoiceNumber

  const invoiceDate = extractDate(cleanText.replace(/ /g, '')) || extractDate(rawText)
  if (invoiceDate) result['开票日期'] = invoiceDate

  extractBuyerSellerPair(normalizedNameText, result)

  const buyerName = extractBuyerName(normalizedNameText)
  if (buyerName && !result['购买方名称']) result['购买方名称'] = buyerName

  const sellerName = extractSellerNameWithSpaces(normalizedNameText)
  if (sellerName && !result['销售方名称']) result['销售方名称'] = sellerName

  extractItemDetails(cleanText, result)

  const totalAmountAndTax = extractAmountAndTaxFromTotalLine(cleanText) ||
    extractAmountAndTaxFromTotalLine(rawText)
  if (totalAmountAndTax) {
    result['金额'] = totalAmountAndTax[0]
    result['税额'] = totalAmountAndTax[1]
  }

  const totalAmount = extractTotalAmount(cleanText)
  if (totalAmount) result['价税合计'] = totalAmount

  // 电子发票乱序文本兜底补全 / 纠错
  fillElectronicInvoiceFallback(rawText, result, options)

  return result
}

module.exports = {
  parseInvoiceInfo,
  fillElectronicInvoiceFallback,
  extractBuyerSellerByTaxIds,
  isSuspiciousPartyName
}

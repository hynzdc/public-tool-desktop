const path = require('path')
const fs = require('fs')
const { readdir } = require('fs/promises')

function hasText(value) {
  return value != null && String(value).trim().length > 0
}

function sanitizeFilename(value) {
  let sanitized = value == null ? '' : String(value).trim()
  sanitized = sanitized
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\x00-\x1F]/g, '_')
  return hasText(sanitized) ? sanitized : 'download.bin'
}

function stripExtension(filename) {
  const name = filename || ''
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

function ensureExtension(filePath, ext) {
  if (!filePath) return filePath
  const lower = filePath.toLowerCase()
  if (lower.endsWith(ext.toLowerCase())) return filePath
  return filePath + ext
}

function normalizePath(p) {
  return (p || '').replace(/\\/g, '/')
}

async function listFilesRecursive(dir, predicate) {
  const results = []
  async function walk(current) {
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile() && (!predicate || predicate(full, entry.name))) {
        results.push(full)
      }
    }
  }
  await walk(dir)
  results.sort((a, b) => a.localeCompare(b))
  return results
}

function listPdfFiles(folder) {
  return listFilesRecursive(folder, (_full, name) => name.toLowerCase().endsWith('.pdf'))
}

function parseDelimitedList(text) {
  if (!hasText(text)) return []
  const seen = new Set()
  const result = []
  for (const part of String(text).split(/[,，\n\r;；]+/)) {
    const item = part.trim()
    if (item && !seen.has(item)) {
      seen.add(item)
      result.push(item)
    }
  }
  return result
}

function buildUniqueName(filename, usedNames) {
  let candidate = filename
  const dot = filename.lastIndexOf('.')
  const base = dot > 0 ? filename.slice(0, dot) : filename
  const extension = dot > 0 ? filename.slice(dot) : ''
  let index = 2
  while (usedNames.has(candidate)) {
    candidate = `${base}-${index}${extension}`
    index += 1
  }
  usedNames.add(candidate)
  return candidate
}

function progressFor(index, total, start = 10, span = 82) {
  if (total <= 0) return start
  return start + Math.round(((index + 1) * span) / total)
}

function ensureParentDir(filePath) {
  const parent = path.dirname(filePath)
  if (parent && !fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true })
  }
}

module.exports = {
  hasText,
  sanitizeFilename,
  stripExtension,
  ensureExtension,
  normalizePath,
  listFilesRecursive,
  listPdfFiles,
  parseDelimitedList,
  buildUniqueName,
  progressFor,
  ensureParentDir
}

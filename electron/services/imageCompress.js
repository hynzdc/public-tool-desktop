const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const archiver = require('archiver')
const {
  stripExtension,
  buildUniqueName,
  progressFor,
  ensureParentDir
} = require('./utils')

const MAX_IMAGE_SIZE = 20 * 1024 * 1024
const DEFAULT_TARGET_KB = 200
const MIN_TARGET_KB = 20
const MAX_TARGET_KB = 4096
const DEFAULT_MAX_WIDTH = 1600
const DEFAULT_MAX_HEIGHT = 1600
const MIN_SIDE = 240
const DEFAULT_QUALITY = 62
const MIN_QUALITY = 18

function isImage(filePath) {
  const name = path.basename(filePath).toLowerCase()
  return ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp'].some((ext) => name.endsWith(ext))
}

function normalizeTargetKb(targetKb) {
  const value = Number(targetKb)
  if (!Number.isFinite(value)) return DEFAULT_TARGET_KB
  return Math.max(MIN_TARGET_KB, Math.min(MAX_TARGET_KB, Math.round(value)))
}

function buildDownloadName(originalFilename) {
  let base = stripExtension(originalFilename || 'compressed-image')
  base = base.replace(/[\r\n\\/]+/g, '_')
  if (!base.trim()) base = 'compressed-image'
  return `${base}-compressed.jpg`
}

async function compressToJpeg(inputPath, targetBytes) {
  const meta = await sharp(inputPath, { failOn: 'none' }).metadata()
  let width = meta.width || DEFAULT_MAX_WIDTH
  let height = meta.height || DEFAULT_MAX_HEIGHT
  let maxWidth = Math.min(DEFAULT_MAX_WIDTH, width)
  let maxHeight = Math.min(DEFAULT_MAX_HEIGHT, height)
  let best = null

  for (let round = 0; round < 8; round++) {
    let quality = DEFAULT_QUALITY
    while (quality >= MIN_QUALITY) {
      const buffer = await sharp(inputPath, { failOn: 'none' })
        .rotate()
        .resize({
          width: maxWidth,
          height: maxHeight,
          fit: 'inside',
          withoutEnlargement: true
        })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer()

      if (!best || buffer.length < best.length) best = buffer
      if (buffer.length <= targetBytes) return buffer
      quality -= 8
    }

    const nextWidth = Math.max(MIN_SIDE, Math.round(maxWidth * 0.82))
    const nextHeight = Math.max(MIN_SIDE, Math.round(maxHeight * 0.82))
    if (
      (nextWidth === maxWidth && nextHeight === maxHeight) ||
      maxWidth <= MIN_SIDE ||
      maxHeight <= MIN_SIDE
    ) {
      break
    }
    maxWidth = nextWidth
    maxHeight = nextHeight
  }

  if (best) return best
  return sharp(inputPath, { failOn: 'none' })
    .rotate()
    .resize({
      width: Math.min(DEFAULT_MAX_WIDTH, width),
      height: Math.min(DEFAULT_MAX_HEIGHT, height),
      fit: 'inside',
      withoutEnlargement: true
    })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: MIN_QUALITY, mozjpeg: true })
    .toBuffer()
}

async function compressFile(filePath, targetKb) {
  const stat = fs.statSync(filePath)
  if (stat.size > MAX_IMAGE_SIZE) {
    throw new Error(`图片不能超过 20MB：${path.basename(filePath)}`)
  }
  if (!isImage(filePath)) {
    throw new Error(`只支持图片文件：${path.basename(filePath)}`)
  }
  return compressToJpeg(filePath, normalizeTargetKb(targetKb) * 1024)
}

async function run(payload, onProgress = () => {}) {
  const { imagePaths = [], outputPath, targetKb = DEFAULT_TARGET_KB } = payload || {}
  if (!imagePaths.length) throw new Error('请先选择要压缩的图片。')
  if (!outputPath) throw new Error('请选择输出文件。')

  const normalizedTarget = normalizeTargetKb(targetKb)

  if (imagePaths.length === 1) {
    const image = imagePaths[0]
    onProgress({ message: `压缩图片：${path.basename(image)}`, percent: 20 })
    const compressed = await compressFile(image, normalizedTarget)
    ensureParentDir(outputPath)
    fs.writeFileSync(outputPath, compressed)
    onProgress({ message: `写入输出文件：${path.basename(outputPath)}`, percent: 100 })
    return {
      count: 1,
      originalBytes: fs.statSync(image).size,
      compressedBytes: compressed.length,
      outputPath
    }
  }

  ensureParentDir(outputPath)
  const output = fs.createWriteStream(outputPath)
  const archive = archiver('zip', { zlib: { level: 9 } })
  const done = new Promise((resolve, reject) => {
    output.on('close', resolve)
    archive.on('error', reject)
    output.on('error', reject)
  })
  archive.pipe(output)

  let originalBytes = 0
  let compressedBytes = 0
  const usedNames = new Set()

  for (let i = 0; i < imagePaths.length; i++) {
    const image = imagePaths[i]
    originalBytes += fs.statSync(image).size
    onProgress({
      message: `压缩图片：${path.basename(image)}`,
      percent: progressFor(i, imagePaths.length, 10, 80)
    })
    const compressed = await compressFile(image, normalizedTarget)
    compressedBytes += compressed.length
    const entryName = buildUniqueName(buildDownloadName(path.basename(image)), usedNames)
    archive.append(compressed, { name: entryName })
  }

  await archive.finalize()
  await done
  onProgress({ message: `写入输出文件：${path.basename(outputPath)}`, percent: 100 })
  return {
    count: imagePaths.length,
    originalBytes,
    compressedBytes,
    outputPath
  }
}

module.exports = { run, DEFAULT_TARGET_KB, buildDownloadName }

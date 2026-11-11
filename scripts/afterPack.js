const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function run(cmd) {
  console.log('[afterPack]', cmd)
  execSync(cmd, { stdio: 'inherit' })
}

function tryRun(cmd) {
  try {
    run(cmd)
  } catch (e) {
    console.warn('[afterPack] warn:', e.message)
  }
}

function stripXattrs(targetPath) {
  tryRun(`xattr -cr "${targetPath}"`)
  tryRun(`dot_clean -m "${targetPath}"`)
  tryRun(`find "${targetPath}" \\( -name '._*' -o -name '.DS_Store' \\) -delete`)
  // macOS 26 会给打包文件打上 com.apple.provenance，xattr -c 清不掉，codesign 会报 detritus。
  tryRun(`find "${targetPath}" -print0 | xargs -0 xattr -d com.apple.provenance`)
  tryRun(`find "${targetPath}" -print0 | xargs -0 xattr -c`)
}

/**
 * macOS 未完整签名时，下载后 Gatekeeper 会提示「已损坏」。
 * 打包后清理 xattr，并对 .app 做 ad-hoc 深度签名。
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)
  if (!fs.existsSync(appPath)) {
    console.warn('[afterPack] app not found:', appPath)
    return
  }

  console.log('[afterPack] preparing codesign for', appPath)
  stripXattrs(appPath)

  const frameworks = path.join(appPath, 'Contents', 'Frameworks')
  if (fs.existsSync(frameworks)) {
    const helpers = fs
      .readdirSync(frameworks)
      .filter((name) => name.endsWith('.app') || name.endsWith('.framework'))
      .map((name) => path.join(frameworks, name))

    for (const target of helpers) {
      stripXattrs(target)
      tryRun(`codesign --force --deep --sign - --timestamp=none "${target}"`)
    }
  }

  // 主 app：多试一次清理，避免 FinderInfo 导致失败
  stripXattrs(appPath)
  try {
    run(`codesign --force --deep --sign - --timestamp=none "${appPath}"`)
  } catch {
    stripXattrs(appPath)
    run(`codesign --force --deep --sign - --timestamp=none "${appPath}"`)
  }
  tryRun(`codesign --verify --deep --verbose=2 "${appPath}"`)
  console.log('[afterPack] codesign finished')
}

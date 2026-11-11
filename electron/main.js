const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')

// 延迟加载业务模块，避免启动时因某个依赖问题直接崩溃
function loadService(name) {
  return require(`./services/${name}`)
}

const isDev = !app.isPackaged
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1120,
    minHeight: 760,
    title: '公益工具站',
    backgroundColor: '#F4F3EF',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
  if (fs.existsSync(iconPath)) {
    mainWindow.setIcon(iconPath)
  }

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function sendProgress(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function registerIpc() {
  ipcMain.handle('dialog:openFile', async (_event, options = {}) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: options.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: options.filters || []
    })
    if (result.canceled || !result.filePaths.length) return null
    return options.multiple ? result.filePaths : result.filePaths[0]
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  ipcMain.handle('dialog:saveFile', async (_event, options = {}) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: options.defaultPath,
      filters: options.filters || []
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  ipcMain.handle('fs:exists', async (_event, filePath) => {
    return Boolean(filePath && fs.existsSync(filePath))
  })

  ipcMain.handle('shell:openPath', async (_event, targetPath) => {
    if (!targetPath) return
    const stat = fs.existsSync(targetPath) ? fs.statSync(targetPath) : null
    const dir = stat && stat.isDirectory() ? targetPath : path.dirname(targetPath)
    await shell.openPath(dir)
  })

  ipcMain.handle('tool:excelDownload', async (_event, payload) => {
    return loadService('excelDownload').run(payload, (progress) =>
      sendProgress('tool:progress', progress)
    )
  })

  ipcMain.handle('tool:invoice', async (_event, payload) => {
    return loadService('invoice').run(payload, (progress) =>
      sendProgress('tool:progress', progress)
    )
  })

  ipcMain.handle('tool:pdfFilter', async (_event, payload) => {
    return loadService('pdfFilter').run(payload, (progress) =>
      sendProgress('tool:progress', progress)
    )
  })

  ipcMain.handle('tool:pdfExtract', async (_event, payload) => {
    return loadService('pdfExtract').run(payload, (progress) =>
      sendProgress('tool:progress', progress)
    )
  })

  ipcMain.handle('tool:imageCompress', async (_event, payload) => {
    return loadService('imageCompress').run(payload, (progress) =>
      sendProgress('tool:progress', progress)
    )
  })
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

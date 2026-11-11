const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  exists: (filePath) => ipcRenderer.invoke('fs:exists', filePath),
  openPath: (targetPath) => ipcRenderer.invoke('shell:openPath', targetPath),
  excelDownload: (payload) => ipcRenderer.invoke('tool:excelDownload', payload),
  invoice: (payload) => ipcRenderer.invoke('tool:invoice', payload),
  pdfFilter: (payload) => ipcRenderer.invoke('tool:pdfFilter', payload),
  pdfExtract: (payload) => ipcRenderer.invoke('tool:pdfExtract', payload),
  imageCompress: (payload) => ipcRenderer.invoke('tool:imageCompress', payload),
  onProgress: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('tool:progress', listener)
    return () => ipcRenderer.removeListener('tool:progress', listener)
  }
})

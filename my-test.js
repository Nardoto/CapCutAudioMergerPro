console.log('Starting test...')
console.log('Electron in process.versions:', process.versions.electron)

const electron = require('electron')
console.log('electron type:', typeof electron)
console.log('electron value:', electron)

if (typeof electron === 'object' && electron.app) {
  console.log('Electron loaded correctly!')
  electron.app.whenReady().then(() => {
    console.log('App ready!')
    const win = new electron.BrowserWindow({ width: 400, height: 300 })
    win.loadURL('data:text/html,<h1>Test OK!</h1>')
  })
} else {
  console.log('ERROR: Electron not loaded correctly')
  process.exit(1)
}

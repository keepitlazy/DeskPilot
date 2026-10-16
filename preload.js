const { contextBridge, ipcRenderer } = require('electron/renderer')

/** @type {import('./ipc').DeskPilotAPI} */
const deskPilotAPI = {
  send: (input) => ipcRenderer.invoke('chat:send', input),
  cancel: (requestId) => ipcRenderer.invoke('chat:cancel', requestId),
  approve: (requestId) => ipcRenderer.invoke('chat:approve', requestId),
  onTaskEvent: (callback) => {
    /** @param {unknown} _event @param {import('./ipc').TaskEvent} taskEvent */
    const listener = (_event, taskEvent) => callback(taskEvent)
    ipcRenderer.on('task:event', listener)
    return () => ipcRenderer.removeListener('task:event', listener)
  }
}

contextBridge.exposeInMainWorld('deskPilot', {
  ...deskPilotAPI
})

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { DeskPilotAPI, TaskEvent } from './shared/ipc'

const deskPilotAPI: DeskPilotAPI = {
  send: (input) => ipcRenderer.invoke('chat:send', input),
  cancel: (requestId) => ipcRenderer.invoke('chat:cancel', requestId),
  approve: (requestId) => ipcRenderer.invoke('chat:approve', requestId),
  onTaskEvent: (callback) => {
    const listener = (_event: IpcRendererEvent, taskEvent: TaskEvent): void => callback(taskEvent)
    ipcRenderer.on('task:event', listener)
    return () => ipcRenderer.removeListener('task:event', listener)
  }
}

contextBridge.exposeInMainWorld('deskPilot', deskPilotAPI)

declare module 'electron/renderer' {
  export const contextBridge: { exposeInMainWorld(key: string, api: unknown): void }
  export const ipcRenderer: {
    invoke(channel: string, ...args: unknown[]): Promise<any>
    on(channel: string, listener: (event: unknown, ...args: any[]) => void): void
    removeListener(channel: string, listener: (event: unknown, ...args: any[]) => void): void
  }
}

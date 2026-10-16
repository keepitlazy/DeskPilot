import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { SendMessageInput, TaskEvent, TaskEventType, TaskState } from './shared/ipc'

interface Task {
  requestId: string
  conversationId: string
  state: TaskState
  sequence: number
  cancelled: boolean
  window: BrowserWindow | null
  approved: boolean
  cancelWait?: () => void
}

const tasks = new Map<string, Task>()
const windows = new Set<BrowserWindow>()
const terminal = new Set<TaskState>(['completed', 'failed', 'cancelled'])

function sendEvent<K extends TaskEventType>(task: Task, eventType: K, payload: Extract<TaskEvent, { eventType: K }>['payload']): void {
  if (task.window && !task.window.isDestroyed() && !task.window.webContents.isDestroyed()) {
    const event = {
      requestId: task.requestId,
      conversationId: task.conversationId,
      eventType,
      sequence: ++task.sequence,
      timestamp: Date.now(),
      payload
    } as TaskEvent<K>
    task.window.webContents.send('task:event', event)
  }
}

function setState(task: Task, state: TaskState, detail?: string): boolean {
  if (terminal.has(task.state)) return false
  task.state = state
  sendEvent(task, 'task.state', { state, detail })
  return true
}

function assertSender(event: IpcMainInvokeEvent): void {
  if (![...windows].some((window) => !window.isDestroyed() && window.webContents === event.sender)) {
    throw new Error('无效的 IPC 调用来源')
  }
}

function delay(ms: number, task: Task): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    task.cancelWait = () => { clearTimeout(timer); resolve() }
  })
}

async function runDemo(task: Task, message: string): Promise<void> {
  const needsApproval = /\[授权\]|搜索本机|读取文件/.test(message)
  try {
    if (needsApproval) {
      setState(task, 'awaiting_approval', '此演示请求需要你先确认授权。')
      sendEvent(task, 'task.approval', { message: '演示：确认后才会继续处理本机文件相关请求。' })
      while (!task.approved && !task.cancelled) await delay(100, task)
      if (task.cancelled) return
      sendEvent(task, 'task.approval', { resolved: true })
      setState(task, 'running', '授权已确认，正在继续。')
    }
    const response = `已收到你的消息：${message}\n\n当前运行的是第 2 周界面与 IPC 演示流程。任务状态、取消和增量输出由 Electron 主进程驱动；真实模型与本机搜索将在后续迭代接入。`
    const chunks = response.match(/.{1,9}/gs) || [response]
    for (const text of chunks) {
      if (task.cancelled) return
      sendEvent(task, 'task.delta', { text })
      await delay(75, task)
    }
    if (!task.cancelled) setState(task, 'completed')
  } catch (error) {
    if (!task.cancelled) setState(task, 'failed', error instanceof Error ? error.message : '任务失败')
  } finally {
    task.cancelWait = undefined
  }
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#fbfbf9',
    title: 'DeskPilot',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })
  windows.add(window)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.on('closed', () => {
    windows.delete(window)
    for (const task of tasks.values()) {
      if (task.window === window && !terminal.has(task.state)) {
        task.cancelled = true
        task.cancelWait?.()
        task.state = 'cancelled'
        task.window = null
      }
    }
  })
  void window.loadFile(path.join(__dirname, '..', 'index.html'))
}

function isSendMessageInput(input: unknown): input is SendMessageInput {
  if (typeof input !== 'object' || input === null) return false
  const value = input as Record<string, unknown>
  return typeof value.conversationId === 'string' && typeof value.message === 'string' &&
    Boolean(value.message.trim()) && value.message.length <= 12000
}

ipcMain.handle('chat:send', (event, input: unknown) => {
  assertSender(event)
  if (!isSendMessageInput(input)) throw new Error('消息内容无效或超出长度限制')
  const window = [...windows].find((candidate) => candidate.webContents === event.sender) ?? null
  const requestId = randomUUID()
  const task: Task = {
    requestId,
    conversationId: input.conversationId,
    state: 'idle',
    sequence: 0,
    cancelled: false,
    window,
    approved: false
  }
  tasks.set(requestId, task)
  setState(task, 'running')
  void runDemo(task, input.message.trim())
  return { requestId, conversationId: task.conversationId }
})

ipcMain.handle('chat:cancel', (event, requestId: unknown) => {
  assertSender(event)
  if (typeof requestId !== 'string') return false
  const task = tasks.get(requestId)
  if (!task || task.window?.webContents !== event.sender || terminal.has(task.state)) return false
  if (task.state !== 'cancelling') setState(task, 'cancelling')
  task.cancelled = true
  task.cancelWait?.()
  setState(task, 'cancelled')
  return true
})

ipcMain.handle('chat:approve', (event, requestId: unknown) => {
  assertSender(event)
  if (typeof requestId !== 'string') return false
  const task = tasks.get(requestId)
  if (!task || task.window?.webContents !== event.sender || task.state !== 'awaiting_approval') return false
  task.approved = true
  task.cancelWait?.()
  return true
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

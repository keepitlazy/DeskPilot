export type TaskState = 'idle' | 'running' | 'awaiting_approval' | 'cancelling' | 'completed' | 'failed' | 'cancelled'

export type TaskEventPayloads = {
  'task.state': { state: TaskState; detail?: string }
  'task.delta': { text: string }
  'task.approval': { message?: string; resolved?: boolean }
}

export type TaskEventType = keyof TaskEventPayloads
export type TaskEvent<K extends TaskEventType = TaskEventType> = K extends TaskEventType ? {
  requestId: string
  conversationId: string
  eventType: K
  sequence: number
  timestamp: number
  payload: TaskEventPayloads[K]
} : never

export type SendMessageInput = { conversationId: string; message: string }
export type SendMessageResult = { requestId: string; conversationId: string }

export interface DeskPilotAPI {
  send(input: SendMessageInput): Promise<SendMessageResult>
  cancel(requestId: string): Promise<boolean>
  approve(requestId: string): Promise<boolean>
  onTaskEvent(callback: (event: TaskEvent) => void): () => void
}

declare global {
  interface Window { deskPilot: DeskPilotAPI }
}


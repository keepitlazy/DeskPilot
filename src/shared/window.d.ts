import type { DeskPilotAPI } from './ipc'

declare global {
  interface Window {
    deskPilot: DeskPilotAPI
  }
}

export {}

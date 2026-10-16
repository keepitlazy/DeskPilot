const $ = (id) => document.getElementById(id)
const messageList = $('message-list')
const input = $('message-input')
const sendButton = $('send-button')
const taskBanner = $('task-banner')
const conversations = []
const tasks = new Map()
let activeConversationId = null
let activeRequestId = null
let sending = false

function makeId() { return globalThis.crypto.randomUUID() }
function currentConversation() { return conversations.find((item) => item.id === activeConversationId) }

function createConversation() {
  const conversation = { id: makeId(), title: '新会话', messages: [], createdAt: Date.now() }
  conversations.unshift(conversation)
  activeConversationId = conversation.id
  activeRequestId = null
  renderAll()
  input.focus()
}

function renderSidebar() {
  const nav = $('conversation-list')
  nav.replaceChildren()
  for (const conversation of conversations) {
    const button = document.createElement('button')
    button.className = `conversation-item${conversation.id === activeConversationId ? ' active' : ''}`
    button.title = conversation.title
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    icon.setAttribute('viewBox', '0 0 16 16')
    icon.innerHTML = '<path d="M3 3.5h10v7H7l-3 2v-9Z"/>'
    const label = document.createElement('span')
    label.textContent = conversation.title
    button.append(icon, label)
    button.addEventListener('click', () => {
      activeConversationId = conversation.id
      const latestTask = [...tasks.values()].reverse().find((item) => item.conversationId === conversation.id)
      activeRequestId = latestTask?.requestId || null
      renderAll()
    })
    nav.append(button)
  }
}

function addMessage(role, text = '') {
  const conversation = currentConversation()
  const message = { id: makeId(), role, text }
  conversation.messages.push(message)
  return message
}

function renderMessages() {
  const conversation = currentConversation()
  $('conversation-title').textContent = conversation?.title || '新会话'
  messageList.replaceChildren()
  if (!conversation || conversation.messages.length === 0) {
    const welcome = document.createElement('div')
    welcome.className = 'welcome'
    welcome.innerHTML = '<div class="welcome-mark"><svg viewBox="0 0 24 24"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="4"/></svg></div><h1>你好，我是 DeskPilot</h1><p>你的本机 AI 助手。可以先试试下面的示例，或直接输入你想做的事。</p><div class="suggestions"><button class="suggestion"><strong>整理一个想法</strong>帮我把零散的想法整理成清晰的计划</button><button class="suggestion"><strong>搜索本机文件</strong>搜索本机文件并总结相关内容</button><button class="suggestion"><strong>解释一段代码</strong>用简单的语言解释代码是如何工作的</button><button class="suggestion"><strong>请求授权演示</strong>[授权] 读取文件前请先请求我的确认</button></div>'
    welcome.querySelectorAll('.suggestion').forEach((button) => button.addEventListener('click', () => { input.value = button.innerText.replace(/^.*\n/, ''); input.focus(); resizeInput() }))
    messageList.append(welcome)
    return
  }
  for (const message of conversation.messages) {
    const row = document.createElement('article')
    row.className = `message ${message.role}`
    const avatar = document.createElement('div')
    avatar.className = 'avatar'
    avatar.textContent = message.role === 'assistant' ? 'D' : '你'
    const contentWrap = document.createElement('div')
    contentWrap.className = 'message-content'
    const meta = document.createElement('div')
    meta.className = 'message-meta'
    meta.textContent = message.role === 'assistant' ? 'DeskPilot' : '你'
    const text = document.createElement('div')
    text.textContent = message.text
    contentWrap.append(meta, text)
    row.append(avatar, contentWrap)
    messageList.append(row)
  }
  messageList.scrollTop = messageList.scrollHeight
}

function stateLabel(state) {
  return ({ idle: '准备中', running: '正在生成回复…', awaiting_approval: '等待你的授权', cancelling: '正在停止…', completed: '已完成', failed: '任务失败', cancelled: '已停止' })[state] || state
}

function renderTaskBanner() {
  const conversation = currentConversation()
  const task = conversation && [...tasks.values()].reverse().find((item) => item.conversationId === conversation.id)
  if (!task || !['running', 'awaiting_approval', 'cancelling', 'failed', 'cancelled', 'completed'].includes(task.state)) {
    taskBanner.hidden = true
    return
  }
  taskBanner.hidden = false
  taskBanner.replaceChildren()
  const status = document.createElement('div')
  status.className = 'task-status'
  const icon = document.createElement('span')
  icon.className = task.state === 'failed' ? 'error-dot' : ['completed', 'cancelled'].includes(task.state) ? 'done-dot' : 'spinner'
  const label = document.createElement('span')
  label.textContent = task.detail || stateLabel(task.state)
  status.append(icon, label)
  taskBanner.append(status)
  if (task.state === 'awaiting_approval') {
    const approve = document.createElement('button')
    approve.textContent = '确认并继续'
    approve.addEventListener('click', () => window.deskPilot.approve(task.requestId))
    taskBanner.append(approve)
  } else if (task.state === 'running') {
    const stop = document.createElement('button')
    stop.textContent = '停止'
    stop.addEventListener('click', () => window.deskPilot.cancel(task.requestId))
    taskBanner.append(stop)
  }
}

function renderAll() { renderSidebar(); renderMessages(); renderTaskBanner() }
function resizeInput() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 160)}px` }

async function sendMessage() {
  const message = input.value.trim()
  if (!message || sending || activeRequestId && ['running', 'awaiting_approval', 'cancelling'].includes(tasks.get(activeRequestId)?.state)) return
  if (!activeConversationId) createConversation()
  const conversation = currentConversation()
  addMessage('user', message)
  if (conversation.messages.length === 1) {
    conversation.title = message.length > 24 ? `${message.slice(0, 24)}…` : message
  }
  const assistantMessage = addMessage('assistant', '')
  input.value = ''
  resizeInput()
  sending = true
  sendButton.disabled = true
  const placeholderId = `pending:${makeId()}`
  activeRequestId = placeholderId
  const pending = { requestId: placeholderId, conversationId: conversation.id, state: 'running', sequence: 0, assistantMessageId: assistantMessage.id }
  tasks.set(placeholderId, pending)
  renderAll()
  try {
    const result = await window.deskPilot.send({ conversationId: conversation.id, message })
    tasks.delete(placeholderId)
    const earlyTask = tasks.get(result.requestId)
    if (earlyTask) earlyTask.assistantMessageId = assistantMessage.id
    pending.requestId = result.requestId
    if (!earlyTask) tasks.set(result.requestId, pending)
    if (activeRequestId === placeholderId) activeRequestId = result.requestId
  } catch (error) {
    pending.state = 'failed'
    pending.detail = error.message || '无法发送消息'
  } finally {
    sending = false
    sendButton.disabled = false
    renderAll()
    input.focus()
  }
}

window.deskPilot.onTaskEvent((event) => {
  let task = tasks.get(event.requestId)
  if (!task) {
    task = { requestId: event.requestId, conversationId: event.conversationId, sequence: 0 }
    tasks.set(event.requestId, task)
  }
  if (event.sequence <= task.sequence) return
  task.sequence = event.sequence
  const conversation = conversations.find((item) => item.id === event.conversationId)
  if (!conversation) return
  if (event.eventType === 'task.state') {
    task.state = event.payload.state
    task.detail = event.payload.detail
  } else if (event.eventType === 'task.delta') {
    const assistant = conversation.messages.find((item) => item.id === task.assistantMessageId) || [...conversation.messages].reverse().find((item) => item.role === 'assistant')
    if (assistant && !['cancelled', 'failed', 'completed'].includes(task.state)) assistant.text += event.payload.text
  } else if (event.eventType === 'task.approval' && event.payload.message) {
    task.detail = event.payload.message
  }
  if (activeRequestId === event.requestId) renderAll()
  else if (conversation.id === activeConversationId) renderMessages()
})

$('new-chat').addEventListener('click', createConversation)
sendButton.addEventListener('click', sendMessage)
input.addEventListener('input', resizeInput)
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage() }
})

createConversation()

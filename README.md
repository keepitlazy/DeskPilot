# DeskPilot

DeskPilot 是一个基于 Electron 的本机 AI 助手界面原型。当前版本用于演示桌面聊天界面、会话管理，以及由主进程驱动的任务状态、增量输出、取消和授权确认流程。真实 AI 模型和本机搜索功能尚未接入。

## 功能

- 桌面聊天界面与最近会话列表
- 消息逐段输出及任务状态展示
- 支持取消正在运行的任务
- 对包含 `[授权]`、`搜索本机` 或 `读取文件` 的消息显示演示授权流程
- Electron 主进程与渲染进程通过受限 IPC 通信

> 目前任务响应为演示内容，不会真正读取文件或执行本机搜索。

## 环境要求

- Node.js（建议使用当前受支持的 LTS 版本）
- npm

## 安装与启动

```bash
npm install
npm start
```

## 开发命令

```bash
npm start       # 启动 Electron 应用
npm run typecheck  # 运行 TypeScript 类型检查
```

## 项目结构

```text
DeskPilot/
├── main.js             # Electron 主进程与任务调度
├── preload.js          # 安全暴露给渲染进程的 API
├── renderer.js         # 界面交互与 IPC 事件处理
├── index.html          # 应用页面结构
├── styles.css          # 页面样式
├── ipc.d.ts            # IPC 类型声明
├── electron-shims.d.ts # Electron 类型辅助声明
└── package.json        # 项目配置与命令
```

`node_modules/` 已加入 `.gitignore`，安装依赖后该目录不会被 Git 跟踪。

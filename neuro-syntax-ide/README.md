# Neuro Syntax IDE

AI 原生桌面端 IDE，基于 Tauri V2 构建。以 Agent 为一等公民：多协议 Agent Runtime、终端、编辑器、Git、任务编排与产品工坊集成在同一个原生壳里。

## 特性

- **多协议 Agent Runtime** — 四种运行模式统一在 `AgentRuntime` trait 之后：
  - **CLI 模式** — `claude --print --output-format stream-json` 直接子进程
  - **SDK 模式** — Node.js Sidecar（`agent-sdk-bridge.mjs`）调用 `@anthropic-ai/claude-agent-sdk`
  - **Pipe 模式** — NDJSON 管道协议，支持 Claude Code / Cursor / OpenCode
  - **ACP 模式** — JSON-RPC 2.0 双向通信，支持 Codex / Hermes / Kiro / Kimi / Pi
- **Rig 内置 Runtime** — 手写 HTTP 流式接入（Anthropic / OpenAI / Gemini / DeepSeek / Ollama），内置文件/Shell/Git 工具、上下文压缩与斜杠命令
- **24 个视图组件** — 编辑器（Monaco）、终端（xterm）、Git、任务看板、任务图、Pipeline 可视化编辑器、Runtime 监控、会话回放、产品工坊等
- **Rust 后端** — 90+ Tauri Commands：portable-pty 终端、sysinfo 系统监控、git2、文件监听（notify）
- **FS-as-Database** — YAML + Markdown 存储全部数据，不依赖 SQLite

## 技术栈

| Layer | Technology |
| ----- | ---------- |
| Frontend | React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4 |
| Desktop Shell | Tauri V2（`@tauri-apps/api` v2） |
| Backend | Rust（portable-pty, sysinfo, git2, notify, reqwest） |
| IPC | `invoke()` 调用 Command / `listen()` 接收 Event |
| State | `useState` + switch 视图切换（不使用 React Router） |
| AI SDK | `@anthropic-ai/claude-agent-sdk` via Node.js Sidecar |

## 本地运行

**前置要求：** Node.js + Rust toolchain（参见 [Tauri V2 环境准备](https://v2.tauri.app/start/)）

```bash
# 安装依赖
npm install

# 以开发模式启动桌面应用（前端 + Rust 后端）
npm run tauri dev

# 构建产物
npm run tauri build
```

仅启动前端（浏览器预览，无 Tauri 壳，IPC 不可用）：

```bash
npm run dev
```

## 项目结构

```
neuro-syntax-ide/
├── src/
│   ├── components/views/   # 24 个视图组件
│   ├── types.ts            # 全局类型定义
│   └── hooks/              # Agent 会话 / 流式 / 协议 hooks
└── src-tauri/
    ├── src/
    │   ├── lib.rs          # Rust 后端主文件（90+ Commands）
    │   ├── rig_runtime.rs  # Rig 内置 Runtime
    │   └── agent_sdk_runtime.rs
    └── sidecar/
        └── agent-sdk-bridge.mjs  # Node.js SDK bridge
```

仓库根目录另含 `feature-workflow/`（Feature 工作流引擎）与 `features/`（Feature 实体目录），用于驱动本项目的开发流程。

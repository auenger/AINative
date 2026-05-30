---
last_updated: '2026-05-28'
version: 3
status: 'phase-6-agent-provider'
---

# Project Context: Neuro Syntax IDE

> **当前阶段**: Phase 6 — Agent Provider 生态扩展（Phase 1–5 已完成，127 个 Feature 归档）

## 项目定位

Neuro Syntax IDE 是一款 **AI 原生桌面端 IDE**，基于 Tauri V2 + React 19。项目已完成核心功能开发，当前聚焦于 Agent Provider 生态扩展（OpenClaw WebSocket、Hermes 增强、Skill 市场、Agent 驱动工作流）。

**核心架构策略**:
1. 单一 Tauri V2 工程 — 前端 (React) + 后端 (Rust) 在同一个 Cargo workspace
2. 三协议 Agent Runtime — Pipe / ACP / SDK，通过 Settings 切换
3. FS-as-Database — 所有数据持久化为 YAML + Markdown，Git 天然版本管控
4. Feature Workflow — 127 个 Feature 已归档，自动化开发流程成熟

---

## 实施阶段

### Phase 1: App 外壳与原型迁移 ✅
- [x] React 原型 UI 完成
- [x] Tauri V2 工程初始化
- [x] 恢复系统默认标题栏
- [x] 全局明暗主题系统
- [x] 构建流水线: `tauri dev` / `tauri build`

### Phase 2: 系统级能力接入 ✅
- [x] 工作区目录选择 (`@tauri-apps/plugin-dialog`)
- [x] 真实文件树读取 + 拖拽调宽
- [x] `queue.yaml` / `yaml` 解析与看板数据绑定
- [x] 文件变更监听 (`notify`)
- [x] 用户资料管理（名称/邮箱/头像/Git 信息）
- [x] 中英文国际化完善

### Phase 3: 终端与编辑器 ✅
- [x] Monaco Editor 集成 + 多文件类型路由
- [x] xterm.js + `portable-pty` 真实终端
- [x] 跨平台 Shell 自动发现与切换
- [x] Windows PTY 兼容
- [x] 文件树右键菜单 / 剪贴板 / 快速导航
- [x] PDF / 图片 / 视频 / 音频预览
- [x] 编辑器 Tab 溢出 + 保存状态 + 工作空间绑定

### Phase 4: 硬件监控与仪表盘 ✅
- [x] `sysinfo` 硬件探针 (CPU/RAM)
- [x] `git2-rs` Git 集成（Status / Stage-Commit / Push-Pull）
- [x] Git 独立 Tab 页 + 信息展示强化
- [x] Branch & Feature 连线图（拓扑可视化）
- [x] Pipeline 可视化拖拽编辑器 + YAML 双模

### Phase 5: AI Agent 服务化 ✅
- [x] Agent Runtime 系统（Trait + Registry + Detector）
- [x] ClaudeCodeRuntime — `claude -p` CLI 子进程模式
- [x] AgentSdkRuntime — `@anthropic-ai/claude-agent-sdk` Sidecar 模式
- [x] StdioSessionManager — 统一 stdio 子进程管理
- [x] Pipe Adapter — NDJSON: Claude Code / Cursor / OpenCode
- [x] ACP Adapter — JSON-RPC 2.0: Codex / Hermes / Kiro / Kimi / Pi
- [x] Runtime 状态监听 + Session 输出持久化 + 进程 Stop
- [x] PM Agent 职责分离 + Prompt 拆分 + Provider 切换
- [x] REQ Agent 聊天 UI + 多轮对话 + 工具执行循环
- [x] Agent 多模态消息（文件上传 / 分析 / 聊天）
- [x] Claude Code 会话历史回看
- [x] Pixel Agent 可观测 Tab
- [x] Feature Detail Agent 对话区（Review/Modify/Develop）
- [x] IDE Skill 初始化能力
- [x] Task 定时调度服务

### Phase 6: Agent Provider 生态扩展 (当前)
- [ ] OpenClaw WebSocket Provider 接入
- [ ] Hermes Agent 增强（Skill / Memory / MCP）
- [ ] Agent Skill 生态管理（ClawHub + Skills Hub）
- [ ] Agent-Driven Feature Workflow（Agent 自动执行开发任务）

---

## Technology Stack

### Frontend

| Category | Technology | Version |
|----------|-----------|---------|
| UI Framework | React | 19.x |
| Build Tool | Vite | 6.x |
| Language | TypeScript | 5.8 |
| CSS | Tailwind CSS | 4.x |
| Animation | Motion | 12.x |
| Icons | lucide-react | 0.546+ |
| i18n | i18next + react-i18next | 25.x / 16.x |
| Markdown | react-markdown | 10.x |
| Terminal | xterm.js | - |
| Editor | Monaco Editor | - |
| Class Util | clsx + tailwind-merge | - |

### Backend (Rust)

| Category | Crate | Role |
|----------|-------|------|
| Framework | tauri v2 | 窗口管理、IPC、插件 |
| PTY | portable-pty | 真实终端 |
| System | sysinfo | 硬件监控 |
| Git | git2 | Git 操作 |
| FS Watch | notify | 文件变更监听 |
| HTTP | reqwest + futures | LLM API 调用 |
| YAML | serde_yaml | 数据解析 |
| Async | tokio | 异步运行时 |

### Agent Runtime

| Protocol | Technology | Supported Agents |
|----------|-----------|-----------------|
| CLI (Pipe) | `claude -p` subprocess | Claude Code |
| SDK (Sidecar) | `agent-sdk-bridge.mjs` + `@anthropic-ai/claude-agent-sdk` | Claude API (Anthropic-compatible) |
| Pipe (NDJSON) | StdioSessionManager | Claude Code, Cursor, OpenCode |
| ACP (JSON-RPC 2.0) | StdioSessionManager | Codex, Hermes, Kiro, Kimi, Pi |

---

## Directory Structure

```
AmaxAINative/                              # Git 仓库根目录
├── CLAUDE.md                              # Agent 指令文件
├── project-context.md                     # [本文件] AI 共享知识库
├── README.md                              # 项目总览
│
├── neuro-syntax-ide/                      # Tauri V2 应用
│   ├── src/                               # React 前端
│   │   ├── App.tsx                        # 主入口 - 视图路由 + 全局状态
│   │   ├── types.ts                       # 全局类型定义 (979 行, 80+ 类型)
│   │   ├── i18n.ts                        # 中英文国际化
│   │   ├── index.css                      # 设计系统
│   │   ├── lib/utils.ts                   # cn() 工具
│   │   └── components/
│   │       ├── TopNav.tsx                  # 顶栏
│   │       ├── SideNav.tsx                 # 侧栏 (10 个视图入口)
│   │       ├── StatusBar.tsx              # 状态栏 + Skill 状态
│   │       ├── BottomPanel.tsx             # 日志面板
│   │       ├── XTerminal.tsx              # xterm.js 终端组件
│   │       ├── RuntimeOutputModal.tsx      # Runtime 输出弹窗
│   │       ├── SkillInitPrompt.tsx         # Skill 安装提示
│   │       ├── common/                    # 通用组件
│   │       │   ├── MarkdownRenderer.tsx    # Markdown 渲染
│   │       │   ├── ContextMenu.tsx        # 右键菜单
│   │       │   ├── PipelinePanel.tsx      # Pipeline 面板
│   │       │   ├── SkillPanel.tsx         # Skill 面板
│   │       │   └── ...                    # 其他通用组件
│   │       └── views/                     # 视图组件 (24 个)
│   │           ├── ProjectView.tsx        # 项目管理 + PM Agent
│   │           ├── EditorView.tsx         # 文件树 + Monaco + 终端
│   │           ├── TaskBoard.tsx          # 看板 + 搜索 + 调度
│   │           ├── SettingsView.tsx       # 设置 (LLM/Runtime/Workflow)
│   │           ├── GitView.tsx            # Git Tab 页
│   │           ├── MissionControl.tsx     # 仪表盘 + 监控
│   │           ├── AgentControlPanel.tsx  # Agent 控制面板
│   │           ├── PixelAgentView.tsx     # Pixel Agent 可观测
│   │           ├── NewTaskModal.tsx       # 新建任务弹窗
│   │           ├── PipelineVisualEditor.tsx # Pipeline 可视化
│   │           ├── TaskGraphView.tsx      # Task Graph 时间轴
│   │           └── ...                    # 其他视图
│   │
│   └── src-tauri/                         # Rust 后端
│       ├── Cargo.toml                     # 依赖声明
│       ├── tauri.conf.json                # Tauri 配置
│       ├── src/
│       │   ├── lib.rs                     # 主文件 (11.7k 行, 90+ Commands)
│       │   ├── main.rs                    # Tauri 入口
│       │   ├── agent_sdk_runtime.rs       # SDK Runtime 独立模块
│       │   └── skill_init.rs              # Skill 初始化
│       └── sidecar/
│           ├── agent-sdk-bridge.mjs       # Node.js Sidecar (Claude Agent SDK)
│           └── package.json               # Sidecar 依赖
│
├── feature-workflow/                      # Feature 工作流引擎
│   ├── config.yaml                        # 工作流配置
│   ├── queue.yaml                         # Feature 队列状态机
│   └── templates/                         # 文档模板
│
├── features/                              # Feature 实体目录
│   ├── archive/                           # 已完成归档 (127 features)
│   │   └── archive-log.yaml               # 归档索引
│   └── pending-*                          # 待开发 Feature (5 个 blocked)
│
└── .claude/                               # Claude Code 配置
    ├── skills/                            # 工作流 Skills
    ├── settings.json                      # 权限与配置
    └── scheduled_tasks.json               # 定时任务
```

---

## View & Component Map

| View | Component | 功能 | 状态 |
|------|-----------|------|------|
| Project | ProjectView | PM Agent 对话 + 文档渲染 + 多模态 | ✅ |
| Tasks | TaskBoard | 看板 + 搜索 + 排序 + 调度 + Agent Tab | ✅ |
| Editor | EditorView | 文件树 + Monaco + 多终端 + 预览 | ✅ |
| Settings | SettingsView | LLM/Runtime/Workflow/Shell 配置 | ✅ |
| Git | GitView | 状态/暂存/提交/推送/拉取/图谱 | ✅ |
| Mission | MissionControl | 硬件监控 + Git 统计 + Agent 日志 | ✅ |
| Agents | AgentControlPanel | Runtime 管理 + 路由 + Pipeline | ✅ |
| Pixel | PixelAgentView | Agent 像素小人实时可视化 | ✅ |
| Workflow | WorkflowEditor | 节点拖拽画布 | ✅ |
| Person | ProfilePanel | 用户资料 | ✅ |

**布局框架**:
```
┌──────────── TopNav ────────────────┐
│  NEURO SYNTAX  [文件标签]  [AI][部署] │
├──────┬─────────────────────────────┤
│SideNav│     Active View Content     │
│(w-16)│  (10 个视图, useState switch) │
│      │                             │
│      ├─────────────────────────────┤
│      │     BottomPanel (日志)       │
├──────┴─────────────────────────────┤
│    StatusBar + SkillStatusBar      │
└────────────────────────────────────┘
```

---

## Agent Runtime 架构

### 架构图

```
React Frontend
├── useReqAgentChat()       — PM Agent 多轮对话 (routing by settings.runtime_type)
├── useAgentStream()        — Agent 事件流 (agent://chunk)
├── useStdioAgent()         — Stdio 事件流 (agent://message)
├── useAgentRuntimes()      — Runtime 发现 + 状态查询
└── SessionStoreAPI         — 会话持久化
        │
        │ IPC (invoke / listen)
        ▼
Rust Backend
├── AgentRuntime trait
│   ├── id() / name() / runtime_type() / capabilities()
│   ├── execute(params) -> mpsc::Receiver<StreamEvent>
│   ├── health_check() / is_ready()
│   └── session management (resume / fork)
│
├── ClaudeCodeRuntime       — claude -p CLI 直接子进程
├── AgentSdkRuntime         — Node.js Sidecar (agent-sdk-bridge.mjs)
├── StdioSessionManager     — 统一 stdio 子进程管理
│   ├── PipeAdapter          — NDJSON 单向管道
│   └── AcpAdapter           — JSON-RPC 2.0 双向通信
│
├── RuntimeRegistry         — 持有所有 runtime 实例
├── RuntimeDetector          — 扫描 PATH 发现 CLI 工具
└── RoutingEngine            — 智能路由分发 + Pipeline 编排
```

### IPC 事件流

| Event | Source | Payload |
|-------|--------|---------|
| `agent://chunk` | CLI/SDK Runtime | `StreamEvent { text, is_done, error, msg_type, session_id }` |
| `agent://message` | Stdio Pipe/ACP | `PipeMessage { role, content, session_id }` |
| `agent://raw-stdout` | StdioSessionManager | Raw stdout line |
| `agent://session-status` | StdioSessionManager | Session state change |
| `agent://process-exit` | StdioSessionManager | Process exit notification |
| `pty-out` | PTY Terminal | `{ pty_id, data }` |
| `sys-hardware-tick` | sysinfo | `HardwareStats` |
| `fs://workspace-changed` | notify | `FsChangeEvent` |

### SDK Sidecar 协议

```
Rust ←── NDJSON stdin/stdout ──→ Node.js Sidecar ──SDK──→ Claude API

Input:  { type: "query", prompt, model, session_id?, system_prompt? }
        { type: "interrupt" }
        { type: "close" }

Output: { type: "assistant", text, session_id }
        { type: "result", session_id, cost_usd? }
        { type: "error", message, subtype? }
        { type: "rate_limit", retry_after? }
```

---

## IPC Commands (90+)

### 文件系统
`pick_workspace`, `read_file_tree`, `read_file`, `write_file`, `reveal_in_file_manager`

### 终端 (PTY)
`detect_shells`, `create_pty`, `write_to_pty`, `resize_pty`, `kill_pty`

### Git
`git_status`, `git_diff`, `git_stage`, `git_unstage`, `git_commit`, `git_push`, `git_pull`, `git_log`, `git_tags`, `git_branches`, `git_commit_detail`, `git_tag_detail`, `git_commit_graph`

### 硬件监控
`get_hardware_stats`

### Agent Runtime
`list_agent_runtimes`, `scan_agent_runtimes`, `get_runtime_status`, `runtime_execute`, `runtime_stop`, `get_active_sessions`, `get_session_output`, `save_session_output`

### Stdio Agent
`stdio_create_session`, `stdio_send_raw`, `stdio_destroy_session`, `stdio_health_check`, `pipe_execute`

### Feature Workflow
`fetch_queue_state`, `update_task_status`, `read_project_context`, `analyze_project`

### Settings
`read_settings`, `write_settings`, `read_user_profile`, `write_user_profile`

### Scheduler
`schedule_one_shot_task`, `cancel_scheduled_task`, `list_scheduled_tasks`

---

## Feature Workflow System

项目使用自建的 Feature Workflow 系统管理开发：

### 队列状态机
```
new-feature → pending → active → completed → archived
                ↓
             blocked (可恢复)
```

### 核心 Skills
| Skill | 功能 |
|-------|------|
| `/new-feature` | 创建新 Feature（从需求对话到 spec/task/checklist） |
| `/start-feature` | 启动 Feature（创建 worktree + 分支 + active 状态） |
| `/implement-feature` | 实现 Feature（读取 spec，分析 task，写代码） |
| `/verify-feature` | 验证 Feature（检查任务、运行测试、Gherkin 验收） |
| `/complete-feature` | 完成 Feature（commit + merge + archive + cleanup） |
| `/dev-agent` | Feature 开发入口（完整流程编排） |
| `/run-feature` | 执行单个 Feature（全自动） |

### 数据模型
- **queue.yaml** — 队列状态（parents / active / pending / blocked / completed）
- **features/active-{id}/** — 活跃 Feature（spec.md + task.md + checklist.md）
- **features/archive/done-{id}-*/** — 归档 Feature（含 archive-log.yaml 索引）
- **features/pending-{id}/** — 待开发 Feature

---

## Design System

### 颜色主题 (深色科幻风)
- 背景: `#020617` (深海军蓝) → `#10141a` → `#1e2330`
- 主色: `#a2c9ff` (科技蓝) / `#58a6ff`
- 成功: `#67df70` / `#bdf4ff`
- 警告: `#ffb4ab`
- 面板: glass-panel 效果 (半透明 + 模糊)

### 字体
- **Inter** — 正文
- **Space Grotesk** — 标题/强调
- **JetBrains Mono** — 代码/终端

### 关键 CSS 效果
- `shimmer` 动画 (加载骨架)
- `glass-panel` 玻璃态效果
- 网格背景 (Workflow Editor)

---

## Code Patterns

### 样式合并
```typescript
import { cn } from './lib/utils';
<div className={cn("base-class", condition && "conditional-class")} />
```

### 视图路由
```typescript
const [activeView, setActiveView] = useState<ViewType>('project');
// ViewType = 'project' | 'editor' | 'tasks' | 'workflow' | 'mission-control'
//          | 'settings' | 'person' | 'agents' | 'agent-pixel' | 'git'
```

### 类型定义集中 (types.ts)
```typescript
// 80+ 接口/类型，覆盖:
// - FileNode, Task, LogEntry, ViewType
// - GitStatus, GitDiff, GitTag, CommitGraph
// - AgentRuntimeInfo, StreamEventChunk, AgentChatMessage
// - ProviderConfig, LlmConfig, AppSettings, SdkRuntimeConfig
// - PipelineConfig, RoutingConfig, AgentConfig
// - SessionStoreAPI, RuntimeProcessInfo, ClaudeSessionDetail
```

### Rust IPC
```rust
#[tauri::command]
async fn runtime_execute(
    state: tauri::State<'_, AppState>,
    app: AppHandle,
    params: ExecuteParams,
) -> Result<String, String> {
    // StreamEvent via mpsc::channel -> app.emit("agent://chunk", &event)
}
```

### Path Alias
- `@` → 项目根 (`vite.config.ts`)

---

## Critical Rules

### Must Follow
- **Tauri V2 API**: 使用 `@tauri-apps/api` v2 语法 (非 v1)
- **IPC 通信**: `invoke()` 调用 Command，`listen()` 接收 Event
- **FS-as-Database**: 不引入 SQLite，数据全部映射为 YAML + Markdown
- **cn() 合并样式**: clsx + tailwind-merge
- **Agent 工作流**: 必须通过 Skill tool 调用，不可跳过

### Must Avoid
- 不要在前端硬编码 API Keys
- 不要引入 React Router
- 不要使用 SQLite
- 不要修改 Sidecar bridge NDJSON 协议格式（需前后端同步）
- 不要直接修改 archive 目录（通过 `/complete-feature` 归档）

---

## Update Log

- 2026-05-28: v3 — Phase 1–5 完成，127 Feature 归档，更新架构描述至 Phase 6 Agent Provider
- 2026-04-01: v2 — 明确"原型 → Tauri App"策略，梳理 5 阶段路线
- 2026-04-01: v1 — 初始创建

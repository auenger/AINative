---
last_updated: '2026-04-01'
version: 2
status: 'phase-1-shell'
---

# Project Context: Neuro Syntax IDE

> **当前阶段**: Phase 1 — 将 React 原型包裹进 Tauri V2 桌面 App 外壳，先跑起来。

## 项目定位

Neuro Syntax IDE 是一款 **AI 原生桌面端 IDE**。当前有一个完整的 React Web 原型 (`neuro-syntax-ide/`)，展示了所有 UI 交互和视觉风格。**我们的工作是把原型变成真正的桌面 App**，而不是从零开始写前端。

**核心策略**:
1. `neuro-syntax-ide/` 是 UI 参考原型（所有页面、组件、样式已就绪）
2. 在同一工程内搭建 `src-tauri/` Tauri V2 后端，将原型页面装入桌面窗口
3. Agent/AI 能力通过统一的服务接口调用，不急于集成到 Rust 侧
4. 优先跑通: App 外壳 + 原型页面渲染 + 基本系统级能力

---

## 实施阶段

### Phase 1: App 外壳与原型迁移 (当前)
- [x] React 原型 UI 完成 (neuro-syntax-ide/)
- [x] 初始化 Tauri V2 工程 (`src-tauri/`)
- [x] 无边框自定义窗口 + 拖拽栏
- [x] 将原型所有页面组件装入 Tauri WebView
- [x] 基本窗口控制 (最小化/最大化/关闭)
- [x] 构建流水线: `tauri dev` / `tauri build`

### Phase 2: 系统级能力接入
- [ ] 工作区目录选择 (`@tauri-apps/plugin-dialog`)
- [ ] 真实文件树读取 (`@tauri-apps/plugin-fs`)
- [ ] `queue.yaml` 解析与看板数据绑定 (Rust: `serde_yaml`)
- [ ] 文件变更监听 (Rust: `notify` -> 前端事件)
- [ ] 用真实数据替换所有 mock 数据

### Phase 3: 终端与编辑器
- [ ] Monaco Editor 集成 (替换当前 `pre/code` 标签)
- [ ] xterm.js + Rust `portable-pty` 真实终端
- [ ] 多终端标签 (Bash / Claude CLI / Gemini CLI)
- [ ] 文件保存 (Cmd+S -> Rust `std::fs::write`)

### Phase 4: 硬件监控与仪表盘
- [ ] Rust `sysinfo` 硬件探针 (CPU/RAM)
- [ ] 系统健康实时广播 (`sys-hardware-tick`)
- [ ] `git2-rs` Git 统计分析

### Phase 5: AI Agent 服务化
- [ ] Agent 能力通过服务接口统一调用
- [ ] 流式通信 (SSE / WebSocket)
- [ ] Keyring 安全凭证管理
- [ ] Agent 自动创建 Feature 目录与文档

---

## Technology Stack

### 当前原型 (neuro-syntax-ide/)

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
| Class Util | clsx + tailwind-merge | - |

### Tauri 目标架构

| Layer | Technology | Role |
|-------|-----------|------|
| Desktop Shell | Tauri V2 | 窗口管理、IPC、插件系统 |
| Backend | Rust | 文件系统、终端、监控、Git |
| Frontend | React (复用原型) | UI 渲染 (在 Tauri WebView 中运行) |
| IPC Bridge | tauri::command / invoke | 前后端通信 |

---

## Directory Structure

```
AmaxAINative/                          # Git 仓库根目录
├── README.md                          # 项目总览文档
├── project-context.md                 # [本文件] AI 共享知识库
│
├── neuro-syntax-ide/                  # [原型] React + Vite Web App
│   ├── src/
│   │   ├── App.tsx                    # 主入口 - 视图路由 + 全局日志
│   │   ├── main.tsx                   # React DOM 挂载
│   │   ├── types.ts                   # ViewType, Task, LogEntry 类型定义
│   │   ├── i18n.ts                    # 中英文国际化配置
│   │   ├── index.css                  # 设计系统 (颜色/字体/动画)
│   │   ├── lib/utils.ts              # cn() 工具函数
│   │   └── components/
│   │       ├── TopNav.tsx             # 顶栏: 品牌/标签/AI按钮/语言切换
│   │       ├── SideNav.tsx            # 侧栏: 5个视图导航 (固定 w-16)
│   │       ├── BottomPanel.tsx        # 底部: 系统日志终端
│   │       ├── StatusBar.tsx          # 状态栏: 版本/连接/编码
│   │       └── views/
│   │           ├── ProjectView.tsx    # 项目管理 + PM Agent 对话
│   │           ├── EditorView.tsx     # 文件树 + 代码编辑 + 终端
│   │           ├── TaskBoard.tsx      # 看板 + 甘特图 + 任务详情
│   │           ├── WorkflowEditor.tsx # 节点式工作流画布
│   │           └── MissionControl.tsx # 仪表盘 + 硬件监控 + Agent 日志
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── src-tauri/                         # [待建] Tauri V2 Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs                    # Tauri 入口
│   │   └── lib.rs                     # Commands & 事件注册
│   └── capabilities/                  # Tauri 权限配置
│
├── feature-workflow/                  # Feature 工作流引擎
│   ├── config.yaml                    # 工作流配置
│   ├── queue.yaml                     # Feature 队列状态机
│   └── templates/                     # 文档模板
│
├── features/                          # Feature 实体目录
│   └── archive/
│
└── *.md                               # 架构文档 (module_1~5, tauri_*)
```

---

## Prototype Component Map

原型中的 5 个视图及其核心功能:

| View | Component | 功能 | Tauri 化优先级 |
|------|-----------|------|---------------|
| Project | ProjectView | PM Agent 对话 + 项目文档渲染 | Phase 1 (直接复用) |
| Tasks | TaskBoard | 看板卡片 + 甘特图 + 任务依赖 | Phase 2 (接真实数据) |
| Editor | EditorView | 文件树 + 代码预览 + 多终端 | Phase 3 (Monaco+Pty) |
| Mission | MissionControl | 硬件监控 + Agent 日志 + Git 统计 | Phase 4 (sysinfo) |
| Workflow | WorkflowEditor | 节点拖拽画布 + 属性面板 | Phase 2 (接真实数据) |

**布局框架** (Phase 1 直接复用):
```
┌──────────── TopNav ────────────────┐
│  NEURO SYNTAX  [文件标签]  [AI][部署] │
├──────┬─────────────────────────────┤
│SideNav│     Active View Content     │
│(w-16)│  (Project/Tasks/Editor/...)  │
│      │                             │
│      ├─────────────────────────────┤
│      │     BottomPanel (日志)       │
├──────┴─────────────────────────────┤
│            StatusBar               │
└────────────────────────────────────┘
```

---

## Design System (from index.css)

### 颜色主题 (深色科幻风)
- 背景: `#020617` (深海军蓝) -> `#10141a` -> `#1e2330`
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

### 组件模式
```typescript
// React.FC 函数式组件，显式类型注解
const MyComponent: React.FC<{ prop: Type }> = ({ prop }) => { ... };
```

### 样式合并
```typescript
import { cn } from './lib/utils';
// clsx + tailwind-merge
<div className={cn("base-class", condition && "conditional-class")} />
```

### 视图路由 (useState + switch，不用 React Router)
```typescript
const [activeView, setActiveView] = useState<ViewType>('project');
```

### 类型定义集中 (types.ts)
```typescript
export type ViewType = 'project' | 'editor' | 'tasks' | 'workflow' | 'mission-control' | 'settings' | 'person';
export interface Task { id: string; status: 'todo' | 'in-progress' | 'in-review' | 'completed'; type: 'business' | 'development'; ... }
```

### Path Alias
- `@` -> 项目根 (`vite.config.ts`)

---

## Architecture: FS-as-Database

这是整个应用的核心数据架构:
- **queue.yaml** = 状态机 (parents/active/pending/blocked/completed 队列)
- **features/** = 每个 Feature 一个文件夹 (plan.md, evidence 等)
- **Git** = 天然版本管控，`git commit` 即快照
- **Rust `notify`** = 文件变更监听 -> 前端自动刷新

---

## Critical Rules

### Must Follow
- **Tauri V2 API**: 使用 `@tauri-apps/api` v2 语法 (非 v1)
- **无边框窗口**: `decorations: false` + `data-tauri-drag-region` 实现拖拽
- **IPC 通信**: 前端用 `invoke()` 调用 Rust Command，用 `listen()` 接收事件
- **FS-as-Database**: 不引入 SQLite，数据全部映射为 YAML + Markdown 文件
- **复用原型组件**: 不要重写 UI，而是把原型组件搬进 Tauri WebView

### Must Avoid
- 不要在前端代码中硬编码 API Keys — 后端 Rust 侧管理
- 不要引入 React Router — 保持 useState + switch 视图切换
- 不要使用 SQLite — 坚持 FS-as-Database
- 不要修改原型的设计系统 (颜色/字体/动画) — 直接复用
- 不要在前端 mock 终端 I/O — Phase 3 用真实 xterm.js + portable-pty

---

## Tauri IPC Contract (Phase 2+)

```typescript
// 前端调用的 Tauri Commands
invoke('pick_workspace') -> { path: string, valid: boolean }
invoke('read_file_tree', { path: string }) -> FileNode[]
invoke('read_file', { path: string }) -> string
invoke('write_file', { path: string, content: string }) -> void
invoke('fetch_queue_state') -> QueueState
invoke('update_task_status', { taskId: string, target: string }) -> void

// 前端监听的 Tauri Events
listen('fs://workspace-changed') -> FsChangeEvent
listen('sys-hardware-tick') -> HardwareStats
listen('pty-out') -> { data: string }
listen('pm_agent_chunk') -> { text: string, is_done: boolean }
```

---

## Update Log

- 2026-04-01: v2 重写 — 明确"原型 -> Tauri App"策略，梳理 5 阶段实施路线
- 2026-04-01: v1 初始创建

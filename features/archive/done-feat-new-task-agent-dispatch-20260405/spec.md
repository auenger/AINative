# Feature: feat-new-task-agent-dispatch New Task 弹窗 Agent 分发

## Basic Information
- **ID**: feat-new-task-agent-dispatch
- **Name**: New Task 弹窗 Agent 分发
- **Priority**: 70
- **Size**: M
- **Dependencies**: feat-agent-runtime-system (completed)
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-04

## Description

Task 模块中 New Task 按钮点击后，弹出 Agent 分发弹窗。用户可以：

1. **选择执行 Agent**：内置 PM Agent、或通过 Agent 模块连接的 Claude Code / Codex CLI
2. **输入需求描述**：通过自然语言描述新 feature 需求
3. **调用 /new-feature skill**：选定 Agent 执行需求分析 → 自动生成 feature spec/task/checklist 文档
4. **查看执行结果**：Agent 运行进度反馈 + 生成结果预览（文档驱动，Agent 写完文件即生效）

### 设计参考

- **弹窗基座**: 复用 TaskBoard 现有 `showNewTaskModal` placeholder modal（TaskBoard.tsx:765-796）
- **Agent 选择模式**: 参考 AgentControlPanel 的 runtime 列表和状态展示模式
- **Runtime 数据**: 复用 `useAgentRuntimes` hook（已检测 claude-code / codex 可用性）
- **聊天交互**: 参考 `useAgentChat` hook 的 streaming 模式
- **Modal 交互规范**: 沿用项目统一的 draggable + backdrop-blur + AnimatePresence 模式

## User Value Points

1. **Agent 选择器** — 可视化展示可用 Agent（内置 PM Agent / Claude Code / Codex），显示状态和连接信息
2. **需求输入与 Skill 调用** — 自然语言描述需求，通过选定 Agent 调用 /new-feature skill 自动生成结构化文档
3. **执行反馈与结果预览** — 实时显示 Agent 执行进度，预览生成的 feature 文档（FS-as-Database 文档驱动，文件落盘后 Task Board 自动刷新）

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx:765-796` — 现有 placeholder modal
- `neuro-syntax-ide/src/components/views/AgentControlPanel.tsx` — Agent 管理 UI 参考
- `neuro-syntax-ide/src/lib/useAgentRuntimes.ts` — Runtime 检测 hook
- `neuro-syntax-ide/src/lib/useAgentChat.ts` — Agent 聊天 streaming 参考
- `neuro-syntax-ide/src/lib/usePipelineEngine.ts` — Pipeline 执行引擎
- `neuro-syntax-ide/src/types.ts:169-185` — AgentRuntimeInfo 类型

### Related Documents
- `.claude/skills/new-feature/` — /new-feature skill 定义
- `feature-workflow/config.yaml` — Feature 工作流配置
- `feature-workflow/queue.yaml` — 任务队列管理

### Related Features
- `feat-agent-runtime-system` (completed) — Agent Runtime 核心系统
- `feat-req-agent-bridge` (completed) — Claude Code CLI 桥接
- `feat-req-agent-chat` (completed) — Agent 聊天 UI

## Technical Solution

### 弹窗组件结构

```
NewTaskModal
├── Step 1: Agent 选择器
│   ├── 内置 PM Agent 卡片（始终可用）
│   ├── Claude Code 卡片（状态来自 useAgentRuntimes）
│   ├── Codex CLI 卡片（状态来自 useAgentRuntimes）
│   └── 每个卡片显示: 名称 + 状态指示灯 + 能力标签
├── Step 2: 需求输入
│   ├── 文本输入区域（自然语言描述）
│   └── 可选: 参考文件/上下文附加
├── Step 3: 执行 & 结果预览
│   ├── 执行进度条（Agent streaming 输出）
│   ├── 生成的 spec 预览
│   └── 关闭按钮（文件已落盘，Task Board 自动刷新）
└── 导航: 步骤指示器 + 上一步/下一步
```

### IPC 调用链

1. **内置 PM Agent**: `invoke('run_agent_chat', { prompt, agentId })` → 直接调用 LLM
2. **Claude Code**: `invoke('dispatch_to_runtime', { runtimeId: 'claude-code', skill: '/new-feature', args })` → CLI 桥接
3. **Codex**: `invoke('dispatch_to_runtime', { runtimeId: 'codex', skill: '/new-feature', args })` → CLI 桥接

### 文档驱动（FS-as-Database）

Agent 执行完成后直接写入文件系统:
- `features/pending-{id}/spec.md`
- `features/pending-{id}/task.md`
- `features/pending-{id}/checklist.md`
- 更新 `feature-workflow/queue.yaml`

Task Board 通过 `useQueueData` hook 监听文件变化自动刷新，无需额外"入库"操作。

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望通过 New Task 弹窗选择 Agent 并描述需求，让 Agent 自动创建结构化 feature 文档，以便快速启动开发流程。

### Scenarios (Given/When/Then)

```gherkin
Scenario: 选择内置 PM Agent 创建 feature
  Given Task Board 页面已打开
  When 用户点击 "New Task" 按钮
  Then 弹窗显示 Agent 选择器，包含 "内置 PM Agent"、"Claude Code"、"Codex" 三个选项
  And "内置 PM Agent" 卡片始终显示为可用状态
  And Claude Code/Codex 卡片根据实际检测显示可用/未安装状态

Scenario: 选中 Claude Code 并创建 feature
  Given 弹窗中 Agent 选择器已显示
  And Claude Code runtime 状态为 "available"
  When 用户选择 "Claude Code" 并点击下一步
  Then 显示需求输入区域
  When 用户输入 "添加用户登录功能" 并点击 "创建"
  Then 系统通过 Claude Code 调用 /new-feature skill
  And 显示执行进度和 streaming 输出
  And 生成完成后显示 feature 文档预览

Scenario: Claude Code 未安装时提示
  Given Claude Code runtime 状态为 "not-installed"
  When 用户查看 Claude Code 卡片
  Then 卡片显示为禁用/灰显状态
  And 显示安装提示 "npm install -g @anthropic-ai/claude-code"

Scenario: Agent 完成生成后自动生效
  Given Agent 已生成 feature 文档并写入文件系统
  Then features/pending-{id}/ 目录下已有 spec.md / task.md / checklist.md
  And feature-workflow/queue.yaml 已更新
  And Task Board 通过 useQueueData 自动刷新显示新 feature
  When 用户关闭弹窗
  Then 新 feature 已在 Task Board pending 列中可见
```

### UI/Interaction Checkpoints
- [ ] 弹窗打开有 scale+fade 动画（AnimatePresence）
- [ ] Agent 卡片 hover 有视觉反馈
- [ ] 选中 Agent 有高亮边框
- [ ] 步骤切换有滑动过渡
- [ ] 执行进度有实时更新
- [ ] 预览支持 Markdown 渲染

### General Checklist
- [ ] 复用 `useAgentRuntimes` hook 检测 Agent 可用性
- [ ] 复用现有 Modal 样式体系
- [ ] 不引入新依赖
- [ ] 错误处理：Agent 连接失败、生成失败、文件写入失败

## Merge Record

- **Completed**: 2026-04-05
- **Merged Branch**: feature/feat-new-task-agent-dispatch
- **Merge Commit**: 263f852
- **Archive Tag**: feat-new-task-agent-dispatch-20260405
- **Conflicts**: none
- **Verification**: passed — all 4 Gherkin scenarios validated, 0 TypeScript errors in new files
- **Stats**: 2 files changed (1 new, 1 modified), 705 insertions, 29 deletions, 1 commit

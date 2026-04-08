# Feature: feat-claude-code-runtime-monitor Claude Code Runtime 状态监听

## Basic Information
- **ID**: feat-claude-code-runtime-monitor
- **Name**: Claude Code Runtime 状态监听
- **Priority**: 75
- **Size**: M
- **Dependencies**: []
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-08

## Description
在 Neuro Syntax IDE 中实时监听和展示 Claude Code runtime 的运行状态。用户可以在 IDE 界面中看到当前工作目录下是否有 Claude Code 进程在执行，以及该 runtime 是否正在活跃工作中。分为两个层级：

1. **进程级监听**：通过 Rust `sysinfo` 检测 Claude Code CLI 进程是否在当前工作空间目录下运行，提供 running/idle 状态指示。
2. **会话级监听**：读取 Claude Code 的 session 文件（`~/.claude/` 目录），获取更详细的会话状态（生成中、token 消耗、当前任务描述等）。

## User Value Points

### VP1: 实时进程状态检测
用户可以在 IDE 中一眼看到 Claude Code 是否正在当前项目中运行。无需切换到终端查看，StatusBar 的实时脉冲动画提供即时反馈。

### VP2: 会话详情与运行仪表盘
用户可以在 MissionControl 视图中查看 Claude Code runtime 的详细运行状态，包括当前会话信息、token 使用量、活跃任务等。提供了一个集中的 runtime 管理视角。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/lib/useAgentRuntimes.ts` — 现有 runtime 扫描 hook（静态检测 CLI 安装状态）
- `neuro-syntax-ide/src/components/StatusBar.tsx` — 现有 StatusBar，已有 Agent Runtime 指示器（需增强为实时）
- `neuro-syntax-ide/src/components/views/MissionControl.tsx` — 仪表盘视图（需新增 Runtime Monitor 面板）
- `neuro-syntax-ide/src/types.ts` — `AgentRuntimeInfo`, `AgentRuntimeStatusType` 类型定义
- `src-tauri/src/lib.rs` — Rust 后端入口（需添加进程检测 command + 事件广播）

### Related Documents
- `project-context.md` Phase 4 提及 Rust `sysinfo` 硬件探针 + 实时广播模式
- IPC Contract 中 `listen('sys-hardware-tick')` 是类似的实时事件广播模式，可复用

### Related Features
- `feat-hardware-monitor` (Phase 4) — 同样使用 `sysinfo` + 事件广播模式，架构可参考
- `feat-native-terminal` (Phase 3) — 终端集成，runtime 进程可能从终端启动

## Technical Solution

### Rust 后端 (src-tauri/)

#### 1. 进程检测 Command
```rust
// src-tauri/src/runtime_monitor.rs
use sysinfo::{System, ProcessesToUpdate};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct RuntimeProcessInfo {
    pub runtime_id: String,       // "claude-code"
    pub name: String,             // "Claude Code"
    pub pid: u32,
    pub status: String,           // "running" | "idle"
    pub working_dir: String,
    pub cpu_usage: f32,
    pub memory_bytes: u64,
    pub started_at: Option<u64>,  // timestamp
}

#[tauri::command]
pub fn scan_runtime_processes(workspace_path: String) -> Vec<RuntimeProcessInfo> {
    // 用 sysinfo 扫描进程列表，匹配 "claude" 关键词
    // 检查进程的 cwd 是否在 workspace_path 下
}

#[tauri::command]
pub fn start_runtime_monitor(app_handle: tauri::AppHandle, workspace_path: String) {
    // 启动定时轮询（每 2s），通过事件广播 runtime 状态变化
    // app_handle.emit("runtime://status-changed", payload)
}

#[tauri::command]
pub fn stop_runtime_monitor() {
    // 停止轮询
}
```

#### 2. 事件广播
```
listen('runtime://status-changed') -> { runtimes: RuntimeProcessInfo[], timestamp: number }
```

#### 3. 会话文件读取
```rust
#[tauri::command]
pub fn read_claude_session(session_id: String) -> Option<ClaudeSessionInfo> {
    // 读取 ~/.claude/projects/{project_hash}/sessions/{session_id}.json
    // 提取: status, token_count, model, current_task
}
```

### 前端 (neuro-syntax-ide/)

#### 1. 扩展 types.ts
```typescript
export interface RuntimeProcessInfo {
  runtime_id: string;
  name: string;
  pid: number;
  status: 'running' | 'idle';
  working_dir: string;
  cpu_usage: number;
  memory_bytes: number;
  started_at: number | null;
}

export interface ClaudeSessionDetail {
  session_id: string;
  status: 'active' | 'idle' | 'error';
  model: string;
  token_count: { input: number; output: number };
  current_task: string | null;
  started_at: string;
}
```

#### 2. 新增 useRuntimeMonitor hook
```typescript
// lib/useRuntimeMonitor.ts
// - 调用 start_runtime_monitor 启动后端轮询
// - listen('runtime://status-changed') 接收实时状态
// - 提供 runtimes, isMonitoring, start, stop
```

#### 3. StatusBar 增强
- 现有 `useAgentRuntimes` 增加实时运行状态
- 当检测到 Claude Code 进程运行时：脉冲动画 + "Running" 标签
- 下拉面板显示进程 PID、CPU、内存

#### 4. MissionControl Runtime Monitor 面板
- 新增 `RuntimeMonitorPanel` 组件
- 显示所有活跃 runtime 进程的详细信息
- Claude Code 会话状态卡片（token 消耗、当前任务）

## Acceptance Criteria (Gherkin)

### User Story
作为 Neuro Syntax IDE 用户，我希望能在 IDE 中实时看到 Claude Code runtime 的运行状态，这样我就不需要切换到终端来确认 AI agent 是否正在工作。

### Scenarios (Given/When/Then)

#### Scenario 1: 检测到 Claude Code 进程运行
```gherkin
Given Claude Code CLI 正在当前工作空间目录中运行
When 用户打开 Neuro Syntax IDE
Then StatusBar 的 Agent Runtime 指示器显示绿色脉冲动画
And 下拉面板显示 "Claude Code - Running" 及进程 PID
```

#### Scenario 2: Claude Code 进程结束
```gherkin
Given StatusBar 显示 Claude Code 正在运行
When Claude Code 进程结束
Then StatusBar 指示器在 3 秒内切换为 "Available" 静态状态
And 下拉面板不再显示进程 PID
```

#### Scenario 3: 无 Claude Code 进程
```gherkin
Given 当前工作空间没有 Claude Code 进程运行
When 用户查看 StatusBar
Then Agent Runtime 指示器显示 "1 Agent" (静态)
And 下拉面板显示 "Claude Code - Available"
```

#### Scenario 4: MissionControl Runtime 面板展示详情
```gherkin
Given Claude Code 正在运行且处于活跃会话中
When 用户切换到 MissionControl 视图
Then Runtime Monitor 面板显示 Claude Code 进程详情
And 面板显示当前会话的 token 消耗统计
And 面板显示当前执行的任务描述（如果可获取）
```

#### Scenario 5: 多 runtime 同时运行
```gherkin
Given Claude Code 和 Gemini CLI 同时在运行
When 用户查看 StatusBar 下拉面板
Then 面板列出所有运行中的 runtime 进程
And 每个进程独立显示状态和资源占用
```

#### Scenario 6: 手动重新扫描
```gherkin
Given 用户刚在终端启动了 Claude Code
When 用户点击 StatusBar 下拉面板的 "Rescan" 按钮
Then 面板立即刷新并显示新检测到的 Claude Code 进程
```

### UI/Interaction Checkpoints
- StatusBar Agent 指示器：静态（灰色/绿色圆点） vs 活跃（绿色脉冲动画）
- StatusBar 下拉面板：显示进程 PID、CPU%、内存占用、运行时长
- MissionControl Runtime Monitor 面板：
  - 进程列表卡片（runtime 名称、状态徽章、资源图表）
  - Claude Code 会话详情区（token 统计条、当前任务描述）

### General Checklist
- [ ] Rust `sysinfo` 进程检测仅扫描与 workspace 相关的进程（性能考虑）
- [ ] 轮询间隔可配置（默认 2s）
- [ ] 非Tauri环境（dev mode）使用 mock 数据保持 UI 可用
- [ ] 进程匹配规则覆盖 `claude` / `claude-code` / `node.*claude` 等变体

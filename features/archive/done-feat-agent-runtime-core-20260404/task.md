# Tasks: feat-agent-runtime-core

## Task Breakdown

### 1. Rust 后端 — Runtime Trait & Registry
- [x] 定义 `AgentRuntime` trait（id, name, status, capabilities, query, health_check）
- [x] 实现 `RuntimeRegistry`（注册、查询、健康检查）
- [x] 实现 `RuntimeDetector` 服务（扫描 PATH、检测 CLI 版本）

### 2. Rust 后端 — Claude Code Runtime
- [x] 实现 `ClaudeCodeRuntime` struct，满足 `AgentRuntime` trait
- [x] 复用 feat-req-agent-bridge 的 CLI 调用逻辑
- [x] 实现启动、查询、停止等基本操作

### 3. Rust 后端 — Codex Runtime
- [x] 实现 `CodexRuntime` struct，满足 `AgentRuntime` trait
- [x] 实现 codex CLI 的调用封装
- [x] 处理 Codex 特有的输入输出格式

### 4. Rust 后端 — Tauri IPC Commands
- [x] `list_agent_runtimes` — 返回所有已注册 runtime 列表
- [x] `scan_agent_runtimes` — 触发重新扫描
- [x] `get_runtime_status` — 查询单个 runtime 状态
- [x] 注册到 `lib.rs`

### 5. 前端 — 状态指示器
- [x] 状态栏新增 Agent 状态图标（显示可用 runtime 数）
- [x] 点击展开 runtime 列表弹窗

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Created | Feature created |
| 2026-04-04 | Implemented | All tasks implemented |

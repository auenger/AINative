# Feature: feat-agent-runtime-core Agent 发现与 Runtime 抽象

## Basic Information
- **ID**: feat-agent-runtime-core
- **Name**: Agent 发现与 Runtime 抽象层
- **Priority**: 60
- **Size**: S
- **Dependencies**: feat-req-agent-bridge (completed)
- **Parent**: feat-agent-runtime-system
- **Children**: null
- **Created**: 2026-04-03

## Description

构建 Agent Runtime 系统的基础层。Rust 后端实现 daemon 级别的 agent 检测服务，扫描系统中已安装的 AI coding CLI 工具（Claude Code CLI、OpenAI Codex CLI），将每个 CLI 抽象为统一的 `AgentRuntime` trait。前端可通过 IPC 查询可用 runtime 列表和状态。

## User Value Points

### VP1: 零配置 Agent 发现
IDE 启动时自动检测已安装的 AI coding CLI，用户无需手动配置即可使用。未安装的工具提供一键安装引导。

## Context Analysis

### Reference Code
- `src-tauri/src/lib.rs` — 现有 Tauri Commands，需新增 runtime 相关 commands
- `feat-req-agent-bridge` 实现中的 Claude Code CLI 调用逻辑 — 需重构为通用 runtime 实现
- `neuro-syntax-ide/src/components/views/EditorView.tsx` — 终端集成，runtime 可能复用 pty 通道

### Related Documents
- Tauri V2 IPC 文档
- Claude Code CLI / Codex CLI 命令行文档

### Related Features
- feat-req-agent-bridge (completed) — 现有 Claude Code 桥接，重构为 runtime 实现

## Technical Solution

### Architecture

```rust
// Core trait: AgentRuntime
pub trait AgentRuntime: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn runtime_type(&self) -> &str;
    fn capabilities(&self) -> Vec<AgentCapability>;
    fn install_hint(&self) -> String;
    fn detect(&self) -> Result<Option<(String, String)>, String>;
    fn health_check(&self) -> AgentRuntimeStatus;
    fn info(&self) -> AgentRuntimeInfo;
}

// Registry: holds all runtime implementations, provides scan/query
struct RuntimeRegistry {
    runtimes: Vec<Box<dyn AgentRuntime>>,
    detected: HashMap<String, (String, String)>,
}

// Detector: static utility for PATH scanning
struct RuntimeDetector; // find_command(), get_version()
```

### Files Modified
- `neuro-syntax-ide/src-tauri/src/lib.rs` — Added AgentRuntime trait, types, registry, detector, ClaudeCodeRuntime, CodexRuntime, and 3 IPC commands
- `neuro-syntax-ide/src/types.ts` — Added AgentRuntimeStatusType, AgentCapabilityType, AgentRuntimeInfo types
- `neuro-syntax-ide/src/components/StatusBar.tsx` — Added Agent status indicator with popover

### Files Created
- `neuro-syntax-ide/src/lib/useAgentRuntimes.ts` — React hook for runtime state management

### IPC Commands
- `list_agent_runtimes` — Returns cached runtime list
- `scan_agent_runtimes` — Triggers re-detection, returns fresh list
- `get_runtime_status` — Query single runtime by id

## Acceptance Criteria (Gherkin)

### User Story
作为开发者，我希望 IDE 能自动识别我安装的 AI 编码工具，这样我可以立即开始使用而不需要手动配置。

### Scenarios (Given/When/Then)

```gherkin
Feature: Agent 发现与 Runtime 抽象

  Scenario: 自动检测已安装的 Claude Code CLI
    Given IDE 启动或用户触发 "扫描 Agent"
    When 后端扫描系统 PATH 中的 "claude" 命令
    Then 应识别到 Claude Code CLI 并注册为 "claude-code" runtime
    And runtime 状态标记为 "available"
    And 记录版本号和安装路径

  Scenario: 自动检测已安装的 Codex CLI
    Given IDE 启动或用户触发 "扫描 Agent"
    When 后端扫描系统 PATH 中的 "codex" 命令
    Then 应识别到 Codex CLI 并注册为 "codex" runtime
    And runtime 状态标记为 "available"

  Scenario: Agent 未安装时的降级处理
    Given IDE 启动时扫描 Agent
    When 某个 agent CLI 未找到
    Then 该 runtime 状态标记为 "not-installed"
    And 前端显示安装引导提示（含安装命令）
    And 不影响其他已安装 runtime 的正常使用

  Scenario: Runtime 健康检查
    Given 至少一个 runtime 已注册
    When 后端定期执行健康检查
    Then 可用的 runtime 状态保持 "available"
    And 挂掉的 runtime 状态变为 "unhealthy"
    And 前端状态实时更新

  Scenario: 通过 IPC 查询 Runtime 列表
    Given 多个 runtime 已注册
    When 前端调用 invoke('list_agent_runtimes')
    Then 返回所有 runtime 的 id、name、type、status、version
```

### UI/Interaction Checkpoints
- 状态栏新增 Agent 状态指示器（显示可用 runtime 数量）
- 设置页面新增 "Agent Runtime" 标签页，展示已检测 runtime 列表

### General Checklist
- [ ] `AgentRuntime` trait 定义完整（id、name、status、query、health_check）
- [ ] ClaudeCodeRuntime 实现完成
- [ ] CodexRuntime 实现完成
- [ ] Runtime 注册表（Registry）实现
- [ ] Tauri IPC Commands 暴露
- [ ] 错误处理与降级逻辑

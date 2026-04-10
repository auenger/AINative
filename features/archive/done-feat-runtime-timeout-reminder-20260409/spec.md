# Feature: feat-runtime-timeout-reminder Runtime Session 超时策略优化

## Basic Information
- **ID**: feat-runtime-timeout-reminder
- **Name**: Runtime Session 超时策略优化（智能超时 + 静默提醒）
- **Priority**: 70
- **Size**: M
- **Dependencies**: None
- **Parent**: null
- **Children**: empty
- **Created**: 2026-04-09

## Description

当前 runtime session 的 idle timeout 固定为 120 秒（`src-tauri/src/lib.rs`），当 stdout/stderr 超过 120 秒无数据输出时自动终止 session 并发送 timeout error。但 Claude Code 等长时间运行的 agent 可能在执行复杂任务时超过 120 秒不产生输出，而 session 实际仍在工作中。

**核心诉求**:
- 不再因固定超时误杀还在工作的 session
- 当 session 长时间无输出时，提供视觉提醒（而非直接终止），让用户决定是否继续等待

## User Value Points

### VP1: 智能超时策略
- 移除固定 idle timeout 终止行为
- Session 不再自动被 kill，而是持续运行直到自然结束或用户手动终止
- 保留 Stop 按钮作为用户主动终止的手段

### VP2: 静默等待提醒
- 当 session 超过一定时间（如 30 秒）无输出时，在 RuntimeOutputModal 中显示等待时长提醒
- 提醒信息包含: 已等待时长、上次输出时间
- 提醒是静默的（不弹窗不打断），仅在 output 区域底部显示一个状态条
- 提醒样式使用现有设计系统（警告色 + 动画）

## Context Analysis

### Reference Code
- `src-tauri/src/lib.rs:1175-1209` — idle watchdog thread（当前超时实现）
- `src-tauri/src/lib.rs:5076` — 默认 timeout_secs: 120
- `neuro-syntax-ide/src/components/RuntimeOutputModal.tsx` — Runtime 输出弹窗
- `neuro-syntax-ide/src/lib/useAgentStream.ts:229` — 前端 timeout 事件处理
- `neuro-syntax-ide/src/lib/pipelineTemplates.ts` — pipeline 超时配置

### Related Documents
- project-context.md — Tauri IPC 架构

### Related Features
- feat-runtime-process-stop — Agent Runtime 进程 Stop 按钮（已完成，提供手动终止能力）
- feat-runtime-output-polish — Runtime Session Output 弹窗优化（已完成）

## Technical Solution

### Backend (Rust) 变更

1. **idle watchdog 改造** (`lib.rs:1175-1209`):
   - 移除自动发送 timeout error 终止 session 的逻辑
   - 改为周期性发送 `idle_warning` 事件，包含已等待时长
   - 保留 watchdog 线程，但改为发 warning 而非终止
   - 添加 `idle_warning_interval_secs` 参数（默认 30 秒首次提醒，之后每 30 秒提醒一次）

2. **新增 StreamEvent 类型**:
   - `msg_type: "idle_warning"` — 静默提醒事件
   - 携带 `idle_seconds: u64` 字段

3. **timeout_secs 参数语义变更**:
   - 不再是"超时终止"，变为"首次提醒阈值"
   - 默认值保持 120 秒（首次提醒时间）

### Frontend (React) 变更

1. **RuntimeOutputModal 新增 IdleWarning 条**:
   - 监听 `idle_warning` 类型事件
   - 在 output 底部显示等待提醒条
   - 显示: "Session 已等待 XX 秒无输出，仍在运行中..."
   - 样式: 半透明警告背景 + 微动画 pulse

2. **useAgentStream / useReqAgentChat 更新**:
   - `idle_warning` 不触发 `connectionState: 'error'`
   - 仅更新 UI 提醒状态

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望长时间运行的 runtime session 不会被自动终止，而是在无输出时收到静默提醒，这样我不会丢失正在进行中的工作。

### Scenarios

#### Scenario 1: Session 长时间无输出不自动终止
```gherkin
Given 一个 runtime session 正在运行
And session 已超过 120 秒无 stdout/stderr 输出
Then session 应继续运行（不自动终止）
And 用户可以通过 Stop 按钮手动终止
```

#### Scenario 2: 无输出时显示静默提醒
```gherkin
Given 一个 runtime session 正在运行
And session 已超过 120 秒无输出
When 后端检测到 idle 状态
Then RuntimeOutputModal 底部显示等待提醒条
And 提醒条显示 "已等待 XX 秒无输出，仍在运行中..."
And 提醒条样式为半透明警告色
And 不弹窗、不阻断用户操作
```

#### Scenario 3: Session 恢复输出后提醒消失
```gherkin
Given RuntimeOutputModal 正在显示 idle 提醒
When session 产生新的 stdout/stderr 输出
Then idle 提醒条自动消失
And output 区域正常显示新内容
```

#### Scenario 4: 手动终止 session
```gherkin
Given session 正在运行且显示 idle 提醒
When 用户点击 Stop 按钮
Then session 被终止
And idle 提醒消失
And 显示正常终止状态
```

### UI/Interaction Checkpoints
- [ ] RuntimeOutputModal 底部 idle 提醒条样式符合设计系统
- [ ] 提醒条使用警告色（#ffb4ab）+ 半透明背景
- [ ] 提醒条有微动画（pulse）表示仍在监控中
- [ ] 提醒条不遮挡正常 output 内容

### General Checklist
- [ ] 向后兼容：pipeline templates 中的 timeout_seconds 语义变更不影响现有功能
- [ ] 保留 Stop 按钮作为用户主动终止的手段
- [ ] idle watchdog 线程不泄漏

## Merge Record

- **Completed**: 2026-04-09T12:42:00Z
- **Merged Branch**: feature/feat-runtime-timeout-reminder
- **Merge Commit**: b81c23f
- **Feature Commit**: 25d63dc
- **Archive Tag**: feat-runtime-timeout-reminder-20260409
- **Conflicts**: None
- **Verification**: All 4 Gherkin scenarios passed (code analysis)
- **Stats**: 5 files changed, 131 insertions, 20 deletions

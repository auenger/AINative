# Feature: feat-rig-context-compaction-engine Rig Agent Context Compaction Engine

## Basic Information
- **ID**: feat-rig-context-compaction-engine
- **Name**: Rig Agent Context Compaction Engine
- **Priority**: 60
- **Size**: M
- **Dependencies**: feat-rig-builtin-agent-tools (completed)
- **Parent**: feat-rig-context-compaction
- **Children**: (none)
- **Created**: 2026-06-01

## Description

Rig built-in agent 在多轮 tool-use 循环中 `messages` 数组只增不减（仅 `.push()`），当累计 token 达到硬编码 60k 上限时直接报错终止整个循环。本 Feature 实现自动上下文压缩引擎，包含三个核心能力：

1. **滑动窗口淘汰** — 当 messages 接近 context limit 时，自动裁剪最早的消息对（assistant + tool_result），保留近期上下文让 agent 持续工作
2. **智能摘要压缩** — 将被淘汰的早期对话轮次摘要为一条精简摘要消息，保留关键决策和中间结果而非直接丢弃
3. **可配置上下文管理** — 接入已有的 `LlmConfig.context_window_tokens` 配置，替换硬编码 60k；支持配置压缩触发阈值和摘要策略

### 当前问题

| 问题 | 位置 |
|------|------|
| messages 只增不减 | `rig_runtime.rs:1639,1642,1853,1870,1889,1899` |
| 硬编码 60k 熔断 | `rig_runtime.rs:1655-1677` |
| `LlmConfig.context_window_tokens` 未使用 | `lib.rs:932` 定义但 Rig 未读取 |
| 硬编码 `max_tokens: 16384` | `rig_runtime.rs:487,554` |

## User Value Points

### VP1: 长对话不中断
Agent 在执行复杂任务时（多文件分析、大规模重构），tool-use 循环可能持续数十轮。当前 60k token 硬上限导致中途中断，用户需重新发起对话。自动压缩后 agent 可以持续工作直到任务完成。

### VP2: 上下文不丢失
直接丢弃旧消息会导致 agent "遗忘"早期决策，后续操作可能矛盾。摘要压缩保留关键信息（决策结论、文件路径、错误状态），维持对话连贯性。

### VP3: 用户可配置
不同 LLM 有不同的 context window（128k / 200k / 1M），用户应能根据模型调整策略，而非依赖硬编码值。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src-tauri/src/rig_runtime.rs` — Rig Runtime 主文件，包含：
  - `stream_anthropic_with_tools()` (line 687) — Anthropic 流式 + tool-use 循环
  - `stream_openai_with_tools()` (line 947) — OpenAI 兼容流式 + tool-use 循环
  - `run_rig_agent_tool_loop()` (line 1630) — 统一 tool-use 循环入口
  - 60k 硬编码预算 (line 1658)
- `neuro-syntax-ide/src-tauri/src/lib.rs` — Tauri Commands，包含 `LlmConfig` (line 932)
- `neuro-syntax-ide/src-tauri/src/rig_tools.rs` — Tool 定义，输出截断 (50k-100k chars)

### Related Documents
- `CLAUDE.md` — 项目架构说明
- `project-context.md` — Agent Runtime 架构

### Related Features
- `feat-rig-builtin-agent-core` (completed) — Rig Core 基础流式
- `feat-rig-builtin-agent-provider` (completed) — 多 Provider 支持
- `feat-rig-builtin-agent-tools` (completed) — IDE 工具集
- `feat-rig-slash-commands` (pending) — 内置快捷命令（依赖本 Feature 的 `compact_messages()`）

## Technical Solution

### 核心设计

```
┌─────────────────────────────────────────┐
│  run_rig_agent_tool_loop()              │
│                                         │
│  messages: Vec<Value>                   │
│  total_input_tokens: usize              │
│                                         │
│  ┌─ 每轮迭代结束 ─────────────────────┐ │
│  │  if total_input_tokens             │ │
│  │       >= threshold * window_size:  │ │
│  │                                    │ │
│  │    compaction_result =             │ │
│  │      compact_messages(             │ │
│  │        messages,                   │ │
│  │        summary,                    │ │
│  │        keep_recent_n,              │ │
│  │      )                             │ │
│  │                                    │ │
│  │    messages =                      │ │
│  │      [summary_msg]                 │ │
│  │      + kept_recent_messages        │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 压缩策略

**Phase 1: 滑动窗口（基础）**
- 当 `total_input_tokens >= context_window * trigger_ratio`（默认 0.75）时触发
- 保留最近 N 对消息（assistant + tool_result），默认保留最后 4 对
- 裁剪中间消息，保留第一条 user message（原始请求）

**Phase 2: 摘要压缩（增强）**
- 被裁剪的消息不直接丢弃，而是提取关键信息生成摘要
- 摘要作为一条 `role: "user"` 的 summary 消息插入，内容格式：
  ```
  [Context Summary — {n} turns compressed]
  Key decisions: ...
  Files modified: ...
  Current state: ...
  ```
- 摘要生成使用当前 LLM 做一次非流式调用（轻量 prompt）

**Phase 3: 可配置化**
- 读取 `LlmConfig.context_window_tokens` 替换硬编码 60k
- 新增配置项：
  - `compaction_trigger_ratio: f64`（默认 0.75，即 75% 时触发）
  - `compaction_keep_recent: usize`（默认 4，保留最近 4 对消息）
  - `compaction_strategy: "sliding_window" | "summarize"`（默认 sliding_window）

### compact_messages() 公开接口

`compact_messages()` 需设计为独立可调用的函数，供 tool loop 自动触发和 `/compact` 命令手动调用：

```rust
struct CompactionResult {
    messages: Vec<Value>,
    removed_count: usize,
    original_tokens: usize,
    summary: Option<String>,
}

fn compact_messages(
    messages: &mut Vec<Value>,
    context_window: usize,
    keep_recent: usize,
    strategy: CompactionStrategy,
) -> CompactionResult
```

### 实现范围

| 文件 | 修改 |
|------|------|
| `rig_runtime.rs` | 新增 `compact_messages()` 函数，修改 tool loop 加入压缩检查 |
| `rig_runtime.rs` | 60k 硬编码改为读取配置 |
| `lib.rs` | `LlmConfig` 扩展 compaction 配置字段 |
| 前端 Settings | 新增 compaction 相关配置 UI |

### Token 计算策略

使用 Anthropic/OpenAI API response 中的 `usage.input_tokens` 累计计算，不自行估算 token 数。每轮 API 返回的 input_tokens 就是发送的全部 messages 的 token 数。

## Acceptance Criteria (Gherkin)

### User Story
作为一个使用 Rig Agent 执行复杂任务的 IDE 用户，我希望 agent 在长对话中能自动管理上下文窗口，不会因超出限制而中断，同时保留足够的上下文信息保证任务连贯性。

### Scenarios (Given/When/Then)

#### Scenario 1: 滑动窗口自动触发
```gherkin
Given Rig agent 正在执行 tool-use 循环
And 已使用 token 达到 context_window 的 75%
When 下一轮 API 调用返回
Then 系统自动裁剪最早的 assistant+tool_result 消息对
And 保留最近 4 对消息和原始 user message
And agent 继续执行而非报错终止
```

#### Scenario 2: 摘要保留关键上下文
```gherkin
Given 滑动窗口触发裁剪了 5 对历史消息
When 裁剪完成
Then 系统生成一条摘要消息包含被裁剪消息的关键信息
And 摘要消息插入到 messages 数组中（第一条 user message 之后）
And 后续 API 调用能通过摘要了解早期决策
```

#### Scenario 3: 配置化 context window
```gherkin
Given 用户在 Settings 中配置了 LlmConfig.context_window_tokens = 128000
When Rig agent 启动 tool-use 循环
Then context budget 使用 128000 而非硬编码 60k
And 触发阈值按 128000 * 0.75 = 96000 计算
```

#### Scenario 4: 不影响短对话
```gherkin
Given Rig agent 执行了 3 轮 tool-use
And 累计 token 远未达到触发阈值
When tool-use 循环正常完成
Then 不触发任何压缩操作
And messages 数组保持原样
```

#### Scenario 5: 多次压缩收敛
```gherkin
Given Rig agent 执行了 30+ 轮 tool-use
And 压缩已触发过一次
When token 再次达到阈值
Then 系统再次触发压缩（包括合并旧摘要）
And agent 继续执行直到任务完成或达到 max_iterations
```

### UI/Interaction Checkpoints
- Settings LLM 配置区新增 compaction 相关选项（trigger ratio, keep recent, strategy）
- 压缩触发时在日志面板输出 `[RigRuntime] Context compaction triggered: removed {n} messages, {old_tokens} -> {new_tokens} tokens`

### General Checklist
- [ ] 滑动窗口裁剪逻辑正确（保留第一条 user + 最近 N 对）
- [ ] 摘要格式标准化（包含决策、文件、状态）
- [ ] `LlmConfig` 新字段向后兼容（提供默认值）
- [ ] 多 Provider 均能获取 `usage.input_tokens`
- [ ] 压缩日志可观测
- [ ] `compact_messages()` 独立可调用（供 `/compact` 命令使用）

## Merge Record

- **Completed**: 2026-06-02
- **Merged Branch**: feature/rig-context-compaction-engine
- **Merge Commit**: f6fff2f
- **Archive Tag**: feat-rig-context-compaction-engine-20260602
- **Conflicts**: None
- **Verification**: 5/5 Gherkin scenarios passed, cargo check clean
- **Commits**: 2 (start + implementation)
- **Files Changed**: 5 (rig_runtime.rs, lib.rs, types.ts, SettingsView.tsx, useSettings.ts)
- **Lines Added**: ~500

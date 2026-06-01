# Feature: feat-rig-slash-commands Rig Agent Built-in Slash Commands

## Basic Information
- **ID**: feat-rig-slash-commands
- **Name**: Rig Agent Built-in Slash Commands
- **Priority**: 60
- **Size**: S
- **Dependencies**: feat-rig-context-compaction-engine
- **Parent**: feat-rig-context-compaction
- **Children**: (none)
- **Created**: 2026-06-01

## Description

Rig built-in agent 当前用户输入从前端到 LLM API 全程直通，无任何命令拦截机制。本 Feature 在 Rust 后端 `execute()` 入口实现 `/` 前缀消息的拦截与路由，提供 5 个内置快捷命令用于会话管理，不经过 LLM 直接返回结果，即时响应且不消耗 token。

**命令列表**：
- `/clear` — 清空当前会话的 messages 数组和 token 计数
- `/context` — 显示当前上下文占用（token 数、消息条数、触发阈值）
- `/compact` — 手动触发上下文压缩（调用 engine Feature 的 `compact_messages()`）
- `/help` — 列出所有可用命令和工具
- `/model` — 显示当前使用的模型、Provider 和 max_tokens

## User Value Points

### VP1: 快捷命令掌控对话
用户通过内置命令主动管理对话状态——查看上下文占用（`/context`）、手动压缩（`/compact`）、清空重来（`/clear`）、查看帮助（`/help`）和当前模型（`/model`）。这些命令在 Rust 后端拦截处理，不消耗 LLM token，即时响应。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src-tauri/src/rig_runtime.rs` — `execute()` 函数入口 (line 1630)，命令拦截点
- `neuro-syntax-ide/src-tauri/src/rig_runtime.rs` — `compact_messages()` (由 engine Feature 新增，`/compact` 调用)
- `neuro-syntax-ide/src-tauri/src/rig_tools.rs` — 工具定义（`/help` 需列出）
- `neuro-syntax-ide/src/types.ts` — `StreamEvent` 类型定义
- `neuro-syntax-ide/src/lib/useReqAgentChat.ts` — 前端消息发送 (line 303-353)

### Related Features
- `feat-rig-context-compaction-engine` (pending) — 提供 `compact_messages()` 供 `/compact` 调用

## Technical Solution

### 命令路由流程

```
execute(params)
  │
  ├─ params.message.starts_with("/") ?
  │   YES → parse_command(message)
  │          ├─ /clear   → clear messages, return StreamEvent(done)
  │          ├─ /context → return token/message count as StreamEvent
  │          ├─ /compact → call compact_messages(), return result
  │          ├─ /help    → return command list + tool list
  │          ├─ /model   → return current model name + provider
  │          └─ unknown  → return "Unknown command: /xxx. Type /help"
  │
  │   NO → proceed to normal tool loop
  └─
```

### 命令详细设计

| 命令 | 参数 | 输出 | 副作用 |
|------|------|------|--------|
| `/clear` | 无 | `Session cleared. 0 messages, 0 tokens.` | `messages = []`, `total_input_tokens = 0` |
| `/context` | 无 | `Context: 45,230 / 128,000 tokens (35.3%). 12 messages, 6 tool-use turns. Auto-compact at 96,000 (75%).` | 无 |
| `/compact` | 无 | `Compacted: 12 → 5 messages, 45,230 → 18,400 tokens. Removed 7 turns (summary preserved).` | 调用 `compact_messages()` |
| `/help` | 无 | 列出所有命令 + 6 个可用工具名称和描述 | 无 |
| `/model` | 无 | `Model: claude-sonnet-4-6 | Provider: Anthropic | Max tokens: 16,384` | 无 |

### 实现要点

- 命令在 `execute()` 中处理，通过已有的 `tx.send(StreamEvent{...})` 返回结果，复用现有事件流
- 命令结果 `msg_type` 使用 `"command"` 区分普通消息，前端可据此特殊渲染
- `/compact` 调用 engine Feature 的 `compact_messages()`（函数需独立可调用）
- `/context` 和 `/model` 需要读取 runtime 状态（token 累计数、当前配置）
- 不识别的 `/xxx` 命令返回提示，不发给 LLM（避免浪费 token）
- 命令处理是同步的，不涉及异步 LLM 调用

### 实现范围

| 文件 | 修改 |
|------|------|
| `rig_runtime.rs` | 新增 `parse_command()` + 命令路由，在 `execute()` 入口拦截 `/` 消息 |
| `types.ts` | `StreamEvent` 新增 `msg_type: "command"` 支持 |
| 前端 Chat | 命令响应渲染（`msg_type === "command"` 时使用等宽字体特殊样式） |

## Acceptance Criteria (Gherkin)

### User Story
作为一个使用 Rig Agent 的 IDE 用户，我希望通过内置快捷命令主动管理对话状态，即时查看上下文占用、手动压缩、清空会话，而无需消耗 LLM token。

### Scenarios (Given/When/Then)

#### Scenario 1: /clear 清空会话
```gherkin
Given Rig agent 有 10 条历史消息
When 用户发送 "/clear"
Then 系统清空 messages 数组和 token 计数
And 返回确认消息 "Session cleared. 0 messages, 0 tokens."
And 不调用 LLM API
```

#### Scenario 2: /context 查看上下文占用
```gherkin
Given Rig agent 已使用 45,230 tokens，有 12 条消息
When 用户发送 "/context"
Then 系统返回格式化的上下文信息
And 包含 token 占用、消息条数、触发阈值
And 不调用 LLM API
```

#### Scenario 3: /compact 手动压缩
```gherkin
Given Rig agent 有 12 条消息，已使用 45,230 tokens
When 用户发送 "/compact"
Then 系统调用 compact_messages() 压缩上下文
And 返回压缩结果摘要（原始/压缩后的消息数和 token 数）
And 不调用 LLM API
```

#### Scenario 4: /help 查看命令列表
```gherkin
When 用户发送 "/help"
Then 系统返回所有可用命令及其描述
And 返回所有可用工具及其描述
And 不调用 LLM API
```

#### Scenario 5: /model 查看当前模型
```gherkin
Given 当前配置使用 claude-sonnet-4-6
When 用户发送 "/model"
Then 系统返回模型名称、Provider、max_tokens
And 不调用 LLM API
```

#### Scenario 6: 未知命令提示
```gherkin
When 用户发送 "/unknown_cmd"
Then 系统返回 "Unknown command: /unknown_cmd. Type /help for available commands."
And 不调用 LLM API
And 消息不发送给 LLM
```

### UI/Interaction Checkpoints
- 命令响应使用等宽字体 + 特殊背景色（区别于普通 LLM 回复）
- 输入框输入 `/` 时可选显示命令补全提示（可后续优化）

### General Checklist
- [ ] `/` 命令拦截不触发 LLM 调用
- [ ] 5 个命令均有正确的 StreamEvent 返回
- [ ] `msg_type: "command"` 前端正确渲染
- [ ] 未知 `/` 命令返回提示而非发给 LLM
- [x] `/compact` 正确调用 engine 的 `compact_messages()`

## Merge Record
- **Completed**: 2026-06-02
- **Merged branch**: feature/rig-slash-commands
- **Merge commit**: 08c1203
- **Archive tag**: feat-rig-slash-commands-20260602
- **Conflicts**: none
- **Verification**: PASS (6/6 Gherkin scenarios, cargo check clean, TypeScript clean)
- **Stats**: 1 commit, 5 files changed, 252 insertions, 1 deletion

# Feature: feat-rig-crate-integration Rig Crate 集成 — 替换手写 HTTP 为 rig-core 统一接口

## Basic Information
- **ID**: feat-rig-crate-integration
- **Name**: Rig Crate 集成 — 替换手写 HTTP 为 rig-core 统一接口
- **Priority**: 70
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: empty
- **Created**: 2026-06-02

## Description
当前 `rig_runtime.rs` 手动实现了 Anthropic/OpenAI/Gemini/DeepSeek/Ollama 五种 provider 的 HTTP 请求构建、SSE 流解析、tool calling 格式转换，总计约 2500 行代码。使用 `rig` crate (https://github.com/0xPlaygrounds/rig) 替换手写层，获得：
- 20+ provider 统一接口
- 内置 streaming + tool calling
- Agent abstraction（preamble、multi-turn）
- Token counting 和 usage tracking
- 减少约 1500 行手写代码

## User Value Points
1. **开发效率**：新增 provider 只需一行配置，不再手写 HTTP/SSE 适配
2. **功能增强**：免费获得 prompt caching、token counting、error retry 等能力

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src-tauri/src/rig_runtime.rs` — 当前手写实现（~2500 行）
- `neuro-syntax-ide/src-tauri/src/rig_tools.rs` — 工具定义（保持不变）
- `neuro-syntax-ide/src-tauri/Cargo.toml` — 需添加 rig-core 依赖

### Related Documents
- rig crate: https://github.com/0xPlaygrounds/rig
- rig docs: https://docs.rs/rig-core

### Related Features
- feat-rig-builtin-agent (已完成) — RigRuntime 首次实现
- feat-rig-context-compaction (已完成) — 压缩引擎和快捷命令
- 本次 Session 管理 + Token 估算补全（已在 rig_runtime.rs 中完成）

## Technical Solution
<!-- To be filled during implementation -->

## Acceptance Criteria (Gherkin)
### User Story
作为开发者，我希望 RigRuntime 使用 rig crate 处理 LLM 通信，减少手写代码并获得更好的功能支持。

### Scenarios (Given/When/Then)

#### Scenario 1: rig crate 基础集成
```gherkin
Given Cargo.toml 添加了 rig-core 依赖
When RigRuntime::execute() 使用 rig 的 CompletionClient 发送请求
Then 所有 5 种 provider (Anthropic/OpenAI/Gemini/DeepSeek/Ollama) 正常工作
And StreamEvent 格式与之前完全一致（前端零改动）
And session_id 管理和 token 估算逻辑保持正常
```

#### Scenario 2: Tool calling 兼容
```gherkin
Given rig_runtime 使用 rig 的 tool calling API
When LLM 返回 tool_use 响应
Then 工具通过 ToolRegistry 执行并返回结果
And tool-use loop 最多 10 次迭代正常工作
And compaction 自动触发正常
```

#### Scenario 3: 手写代码移除
```gherkin
Given rig crate 集成完成
When 检查 rig_runtime.rs
Then execute_anthropic / execute_openai_compatible / execute_gemini 已移除
And stream_anthropic_with_tools / stream_openai_with_tools / stream_gemini 已移除
And 文件行数减少约 1500 行
And cargo check 通过无 error
```

### General Checklist
- [ ] AgentRuntime trait 接口不变（lib.rs 零改动）
- [ ] 前端无感知（StreamEvent 格式不变）
- [ ] 所有 provider 测试通过
- [ ] /context 命令显示正确的 token 估算
- [ ] session_id 正确返回给前端

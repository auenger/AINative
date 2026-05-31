# Feature: feat-rig-builtin-agent-provider Rig Multi-Provider 配置 + 切换

## Basic Information
- **ID**: feat-rig-builtin-agent-provider
- **Name**: Rig Multi-Provider — 20+ LLM 提供商配置与切换
- **Priority**: 85
- **Size**: S
- **Dependencies**: feat-rig-builtin-agent-core
- **Parent**: feat-rig-builtin-agent
- **Children**: null
- **Created**: 2026-05-31

## Description
利用 Rig 的统一 Provider 接口，在 Settings 中新增 Rig Provider 配置区，
支持用户选择 20+ LLM 提供商（OpenAI、Anthropic、Gemini、DeepSeek、Ollama 等），
运行时根据配置动态创建对应 Provider 的 Client 和 Agent。

初始版本支持 Top 5 Provider：Anthropic、OpenAI、Google Gemini、DeepSeek、Ollama（本地）。

## User Value Points

### VP1: 一站式多 Provider 接入
用户不再绑定单一 LLM 提供商，可在 Settings 中自由切换，
使用统一的聊天界面与不同 Provider 交互。

## Context Analysis

### Reference Code
- `rig_runtime.rs` — Core 实现（依赖）
- `lib.rs` — `read_settings` / `write_settings` command
- Settings 组件 — Provider 配置 UI 参考
- `types.ts` — `AgentRuntimeInfo` / Settings 相关类型

### Related Documents
- [Rig Providers List](https://docs.rs/rig-core/0.37.0/rig_core/providers/index.html)
- [Rig Provider Configuration](https://docs.rig.rs/docs/integrations/model_providers)

### Related Features
- `feat-rig-builtin-agent-core` — 前置依赖
- `feat-sdk-runtime-config` (completed) — SDK Runtime 配置页面参考
- `feat-pm-agent-provider-switch` (completed) — Provider 切换参考

## Technical Solution

### 1. Settings Schema 扩展
```yaml
# .neuro/settings.yaml 新增
rig:
  provider: anthropic  # anthropic | openai | gemini | deepseek | ollama
  api_key: ""
  base_url: ""         # 可选，用于自定义端点
  model: ""            # 可选，覆盖默认模型
```

### 2. Provider 工厂
```rust
// rig_runtime.rs
fn create_client(provider: &str, api_key: &str, base_url: Option<&str>) -> Result<Box<dyn ...>, String> {
    match provider {
        "anthropic" => rig::providers::anthropic::ClientBuilder::new(api_key).build(),
        "openai" => rig::providers::openai::Client::new(api_key),
        "gemini" => rig::providers::gemini::Client::new(api_key),
        "deepseek" => rig::providers::deepseek::Client::new(api_key),
        "ollama" => rig::providers::ollama::Client::new(),
        _ => Err("Unsupported provider"),
    }
}
```

### 3. 前端 Settings UI
- Provider 下拉选择（5 个选项）
- API Key 输入框（Provider 变化时清空）
- Base URL 可选输入（用于自定义端点）
- Model 可选输入（覆盖默认模型）
- 连接测试按钮

### 4. 模型常量
```rust
const DEFAULT_MODELS: &[(&str, &str)] = &[
    ("anthropic", "claude-sonnet-4-6"),
    ("openai", "gpt-4o"),
    ("gemini", "gemini-2.0-flash"),
    ("deepseek", "deepseek-chat"),
    ("ollama", "llama3"),
];
```

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我想要在 Settings 中配置不同的 LLM Provider，
以便根据成本、速度和可用性选择最适合的模型。

### Scenarios

#### Scenario 1: Provider 切换
```gherkin
Given 用户已配置 Anthropic API Key
And 当前 Provider 为 Anthropic
When 用户切换 Provider 为 OpenAI 并输入 OpenAI API Key
And 用户发送消息
Then Agent 应使用 GPT 模型响应
And 响应格式应与 Anthropic 一致（流式 StreamEvent）
```

#### Scenario 2: 本地 Ollama
```gherkin
Given 用户选择 Provider 为 Ollama
And 本地运行 Ollama 服务
When 用户发送消息
Then Agent 应使用本地模型响应
And 不需要任何 API Key
```

#### Scenario 3: 无效 Provider 配置
```gherkin
Given 用户选择 Provider 为 Anthropic
And API Key 为空
When 用户发送消息
Then 应显示 "请先配置 API Key" 错误
And Runtime 状态应为 Unhealthy
```

### General Checklist
- [x] Settings 新增 Rig Provider 配置区
- [x] 支持 5 个 Provider（Anthropic/OpenAI/Gemini/DeepSeek/Ollama）
- [x] Provider 工厂动态创建 Client
- [x] API Key 配置持久化到 settings.yaml
- [x] 连接测试按钮可用
- [x] 前端 Runtime 信息展示当前 Provider

## Merge Record

- **Completed:** 2026-05-31T16:00:00Z
- **Merged Branch:** feature/feat-rig-builtin-agent-provider
- **Merge Commit:** 9e8c2ae
- **Archive Tag:** feat-rig-builtin-agent-provider-20260531
- **Conflicts:** None
- **Verification:** PASS (3/3 Gherkin scenarios, 16/17 tasks, cargo check 0 errors)
- **Started:** 2026-05-31T15:00:00Z
- **Duration:** ~1 hour
- **Commits:** 1 (implementation)
- **Files Changed:** 5 (rig_runtime.rs, lib.rs, types.ts, useSettings.ts, SettingsView.tsx)

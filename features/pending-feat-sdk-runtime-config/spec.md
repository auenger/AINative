# Feature: feat-sdk-runtime-config SDK Runtime 独立配置页面

## Basic Information
- **ID**: feat-sdk-runtime-config
- **Name**: SDK Runtime 独立配置页面（支持 Claude Config / Custom Provider 双模式）
- **Priority**: 90
- **Size**: M
- **Dependencies**: feat-agent-sdk-runtime
- **Parent**: null
- **Children**: []
- **Created**: 2026-05-07

## Description

当前 Agent SDK Runtime 强制使用 App Settings 中的 LLM Provider 配置（api_base + api_key + model）注入到 sidecar 环境变量。
但 Claude Agent SDK 内部有自己的配置体系（`~/.claude/settings.json`、项目级 `.claude/settings.json`），用户可能已经配置好了 Claude Code 的模型、工具权限等。

需要新增 SDK Runtime 独立配置区域，支持两种配置模式：
1. **Claude Config 模式** — SDK 直接使用 `.claude/settings.json` 的配置（api_key、model、permissions 等），不做任何环境变量注入
2. **Custom Provider 模式** — 使用 App Settings 中配置的 LLM Provider，注入 `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` 环境变量覆盖 SDK 默认值

## Scope

**IN**:
- Settings 页面新增 SDK Runtime 独立配置区域（配置模式切换 + 模式相关参数）
- `AgentSdkRuntime` Rust 端根据配置模式决定是否注入环境变量
- Custom Provider 模式：注入 env vars（含 model 覆盖）
- Claude Config 模式：不注入任何 env vars，SDK 使用自身配置
- 配置持久化到 `settings.yaml` 的 `sdk_runtime` 字段

**OUT**:
- 不修改 ClaudeCodeRuntime（claude -p）
- 不修改前端 Hook 签名
- 不涉及 SDK 的 tool 权限配置（由 `.claude/settings.json` 管理）
- 不新增 Provider 管理 UI（复用现有 LLM Provider）

## User Value Points

### VP1: 配置模式切换
- 用户可在 "Claude Config" 和 "Custom Provider" 之间切换
- Claude Config 模式零配置，直接复用 `.claude/settings.json`
- Custom Provider 模式完整控制 api_base / api_key / model

### VP2: Custom Provider 模式下 Model 可覆盖
- 当前 SDK 忽略 `options.model`，使用 `.claude/settings.json` 的 model
- Custom Provider 模式需通过 `ANTHROPIC_MODEL` 环境变量强制覆盖
- Settings 中显示当前生效的模型（避免 model 不匹配的困惑）

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src-tauri/src/agent_sdk_runtime.rs` — 当前 SDK Runtime，硬编码使用 LLM Provider
- `neuro-syntax-ide/src-tauri/src/lib.rs` — `AppSettings` struct（需新增 `sdk_runtime` 字段）
- `neuro-syntax-ide/src/components/views/SettingsView.tsx` — Settings 页面（LlmPanel 中 Runtime 选择器）
- `neuro-syntax-ide/src/lib/useSettings.ts` — Settings hook（需处理 `sdk_runtime` 字段）
- `neuro-syntax-ide/src-tauri/sidecar/agent-sdk-bridge.mjs` — Sidecar（需支持无 env 注入模式）

### Related Features
- feat-agent-sdk-runtime — Agent SDK Runtime 基础实现

## Technical Solution

### Settings 数据结构

```yaml
# settings.yaml 新增字段
sdk_runtime:
  config_mode: "claude-config" | "custom-provider"
  # custom-provider 模式下使用的 Provider 名称（引用 llm.providers 中的 key）
  # 留空则使用当前激活的 llm.provider
  custom_provider: ""
  # custom-provider 模式下覆盖的 model（留空则使用 llm.model）
  custom_model: ""
```

### Rust 端改动

`AgentSdkRuntime::execute()` 根据 `settings.sdk_runtime.config_mode` 决定行为：
- `claude-config`：不读取 Provider，不注入 env vars，sidecar query 的 options.env 为空
- `custom-provider`：读取指定 Provider（或当前激活 Provider），注入 env vars

### Sidecar 改动

当前 sidecar 总是使用 `options.env`。当 env 为空对象时，SDK 使用自身默认配置，无需改动。

### 前端 Settings UI

在 LlmPanel 的 Agent Runtime 区域扩展：
- Runtime 类型下拉（现有）
- **配置模式**单选：Claude Config / Custom Provider
- Custom Provider 模式下显示：
  - Provider 选择下拉（引用现有 providers 列表）
  - Model 输入框（默认读 llm.model，可覆盖）
  - Provider 协议兼容性提示
- Claude Config 模式下显示：
  - 提示信息："SDK 将使用 ~/.claude/settings.json 的配置"
  - 检测 `.claude/settings.json` 是否存在并显示状态

## Acceptance Criteria (Gherkin)

### User Story
作为 Neuro Syntax IDE 用户，我希望独立配置 SDK Runtime 的配置来源，
以便灵活切换 Claude 自身配置和自定义 Provider 配置。

### Scenarios (Given/When/Then)

#### Scenario 1: Claude Config 模式正常使用
```gherkin
Given 用户在 Settings 中选择了 "Agent SDK" runtime
And SDK 配置模式为 "Claude Config"
And ~/.claude/settings.json 已配置有效的 api_key 和 model
When 用户在 REQ Agent 中发送消息
Then SDK 使用 .claude/settings.json 的配置运行
And 不注入任何环境变量覆盖
And 响应显示 .claude/settings.json 中配置的模型名称
```

#### Scenario 2: Custom Provider 模式正常使用
```gherkin
Given 用户在 Settings 中选择了 "Agent SDK" runtime
And SDK 配置模式为 "Custom Provider"
And 选择了 protocol 为 anthropic 的 Provider
And Model 设为 "GLM-5V-Turbo"
When 用户在 REQ Agent 中发送消息
Then SDK 使用注入的 ANTHROPIC_BASE_URL / ANTHROPIC_API_KEY
And 通过 ANTHROPIC_MODEL 环境变量覆盖为 "GLM-5V-Turbo"
And 响应显示模型为 "GLM-5V-Turbo"
```

#### Scenario 3: Custom Provider 模式 — Provider 不兼容
```gherkin
Given 用户在 Settings 中选择了 SDK 配置模式为 "Custom Provider"
And 选择的 Provider protocol 为 "openai"
When 用户尝试发送消息
Then 显示错误："SDK Custom Provider 模式要求 Anthropic 兼容的 Provider"
And 不 spawn sidecar
```

#### Scenario 4: 配置模式切换
```gherkin
Given 用户当前使用 Claude Config 模式
When 用户切换到 Custom Provider 模式并选择一个 Provider
Then 后续 Agent 调用使用 Custom Provider 的配置
And 切换过程无需重启 App
```

#### Scenario 5: Claude Config 模式下 .claude/settings.json 不存在
```gherkin
Given 用户选择 Claude Config 模式
And ~/.claude/settings.json 不存在或未配置 api_key
When Settings 页面渲染 SDK 配置区域
Then 显示警告："未检测到 Claude 配置，请先运行 claude 命令完成初始化配置"
And 用户仍可切换到 Custom Provider 模式
```

### UI/Interaction Checkpoints
- Settings LLM Tab → Agent Runtime 区域 → 配置模式单选
- Custom Provider 模式下：Provider 下拉 + Model 输入 + 兼容性状态
- Claude Config 模式下：.claude 配置检测状态 + 提示信息
- 配置变更后 Save 按钮亮起

### General Checklist
- [ ] 配置模式持久化到 settings.yaml
- [ ] 两种模式正确切换，无需重启
- [ ] Custom Provider 模式 env vars 包含 ANTHROPIC_MODEL
- [ ] Claude Config 模式不注入任何 env vars

# Feature: feat-pm-agent-provider-switch PM Agent LLM 提供商切换

## Basic Information
- **ID**: feat-pm-agent-provider-switch
- **Name**: PM Agent LLM 提供商切换（Settings 默认值 + 聊天区下拉覆盖）
- **Priority**: 85
- **Size**: M
- **Dependencies**: feat-settings-llm-config (completed), feat-agent-gemini-bridge (completed)
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-06T14:00:00Z

## Description

当前 PM Agent（`runtimeId: 'gemini-http'`）和 Req Agent（`runtimeId: 'claude-code'`）的运行时 ID 均为硬编码，用户无法在运行时切换 LLM 提供商。Settings 页面已有完整的 providers 管理和 llm 配置能力，但 Agent 聊天区没有读取这些配置。

本 Feature 实现两件事：
1. **Settings 默认值关联** — Agent 的 runtimeId 从 Settings `llm.provider` 读取默认值，不再硬编码
2. **聊天区下拉覆盖** — 在 Agent 聊天输入框上方添加 provider/model 下拉选择器，允许用户临时覆盖当前会话的 LLM

## User Value Points

### VP1: Settings 默认 Provider 自动关联
用户在 Settings 页面配置的默认 provider/model 自动生效到所有 Agent 聊天会话，无需额外操作。Agent 启动时读取 `llm.provider` 作为 runtimeId 默认值。

### VP2: 聊天区 Provider/Model 下拉覆盖
用户在聊天输入区可以临时切换 provider 或 model，覆盖 Settings 中的默认值。切换仅影响当前聊天标签（PM / Req），不修改 Settings 持久配置。

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/views/ProjectView.tsx:445-466` — PM Agent (`runtimeId: 'gemini-http'`) & Req Agent (`runtimeId: 'claude-code'`) 的 `useAgentStream` 调用，runtimeId 硬编码
- `neuro-syntax-ide/src/lib/useAgentStream.ts:76` — `useAgentStream` hook，`runtimeId` 参数在 hook 内部使用（:259, :385 处有 gemini-http 判断）
- `neuro-syntax-ide/src/lib/useSettings.ts` — `useSettings()` 返回 `settings.llm.provider` 和 `settings.providers`
- `neuro-syntax-ide/src/components/views/SettingsView.tsx` — LlmPanel 组件已有完整的 provider CRUD
- `neuro-syntax-ide/src/types.ts` — `ProviderConfig`, `LlmConfig`, `AppSettings` 类型

### Related Documents
- CLAUDE.md — Tech Stack（React 19 + TypeScript 5.8 + Tailwind CSS 4）
- project-context.md — 设计系统（深色科幻风、glass-panel）

### Related Features
- `feat-settings-llm-config` (completed) — Settings 页面 & LLM Provider 配置
- `feat-agent-gemini-bridge` (completed) — GeminiHttpRuntime 实现 + PM Agent 迁移
- `feat-agent-runtime-execute` (completed) — AgentRuntime execute() 抽象层

## Technical Solution

### 方案概述

#### 1. runtimeId 动态化
- `useAgentStream` 增加 `runtimeId` 为可变参数（从 `string` 改为受控 state）
- `ProjectView` 从 `useSettings()` 读取 `settings.llm.provider` 作为默认值
- 用户通过下拉覆盖时，更新本地 state，不影响 Settings 持久化

#### 2. 聊天区下拉 UI
- 在 Agent 聊天头部栏（`ProjectView.tsx:527-563`）的状态指示器旁，增加 provider 下拉按钮
- 下拉列表从 `settings.providers` 读取可用 provider 列表
- 选择后即时切换 runtimeId，触发 session 重连
- 下拉旁显示当前 model 名称（来自 `settings.llm.model`）

#### 3. 切换行为
- 切换 provider 时，保留当前聊天消息（不清空）
- 断开当前 session，使用新 runtimeId 创建新 session
- 如果切换的 provider 未配置 API Key，提示用户前往 Settings 配置

### 涉及文件
1. `types.ts` — 无变更（已有 `ProviderConfig`, `LlmConfig`）
2. `useAgentStream.ts` — `runtimeId` 支持动态变更 + 暴露 `setRuntimeId`
3. `useSettings.ts` — 无变更（已暴露 `settings.providers` 和 `settings.llm`）
4. `ProjectView.tsx` — 引入 `useSettings`，添加 provider 下拉 UI，动态传 runtimeId
5. `SettingsView.tsx` — 无变更

## Acceptance Criteria (Gherkin)

### User Story
作为 Neuro Syntax IDE 用户，我希望在 Agent 聊天区能切换 LLM 提供商，这样我可以在不同模型之间灵活选择而不需要每次都去 Settings 页面修改。

### Scenarios

#### Scenario 1: Settings 默认 Provider 自动生效
```gherkin
Given 用户已在 Settings 页面配置了 provider "zai" 和 model "glm-4.7"
And Settings 的 llm.provider 为 "zai"
When 用户打开 Project View 的 PM Agent 聊天
Then PM Agent 使用 "zai" 作为 runtimeId
And 聊天头部显示当前 provider 为 "zai"
```

#### Scenario 2: 聊天区下拉切换 Provider
```gherkin
Given Settings 已配置多个 provider: "zai" 和 "openai"
And 当前 PM Agent 使用 "zai"
When 用户点击聊天头部的 provider 下拉
And 选择 "openai"
Then PM Agent 的 runtimeId 切换为 "openai"
And 聊天头部显示当前 provider 为 "openai"
And Settings 的持久配置不变（仍为 "zai"）
```

#### Scenario 3: 切换到未配置 API Key 的 Provider
```gherkin
Given Settings 已配置 provider "zai" 有 API Key
And provider "openai" 的 API Key 为空
When 用户在聊天区下拉选择 "openai"
Then 聊天区显示警告提示 "API Key 未配置，请前往 Settings 设置"
And Agent 不发送请求
```

#### Scenario 4: Req Agent 独立切换
```gherkin
Given PM Agent 当前使用 "zai"
And Req Agent 当前使用 "zai"
When 用户切换 Req Agent 的 provider 为 "openai"
Then PM Agent 仍使用 "zai"
And Req Agent 使用 "openai"
```

#### Scenario 5: 不同聊天标签保持独立覆盖
```gherkin
Given 用户在 PM Agent 标签切换 provider 为 "openai"
When 用户切换到 Req Agent 标签
Then Req Agent 仍使用 Settings 默认的 "zai"
And 用户回到 PM Agent 标签时，provider 仍为 "openai"
```

### UI/Interaction Checkpoints
- [ ] 聊天头部 provider 下拉按钮（位于状态指示器和 Key 按钮之间）
- [ ] 下拉列表显示所有已配置 provider 名称
- [ ] 当前选中 provider 有视觉标识
- [ ] 切换后状态指示器更新（Active / No Key）
- [ ] 警告提示样式与现有设计系统一致

### General Checklist
- [ ] 不修改 Settings 持久化逻辑
- [ ] 不引入新依赖
- [ ] 保持现有 chat 消息不清空
- [ ] 兼容 dev mode（非 Tauri 环境）

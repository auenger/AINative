# Feature: feat-remove-gemini-builtin 移除 Gemini 内置 Key 与终端

## Basic Information
- **ID**: feat-remove-gemini-builtin
- **Name**: 移除 Gemini 内置 Key、API Key Modal 与 Gemini 终端
- **Priority**: 80
- **Size**: M
- **Dependencies**: none
- **Parent**: null
- **Children**: []
- **Created**: 2026-05-07

## Description

移除所有 Gemini/Keyring 内置逻辑，统一由 Settings LLM Provider 配置驱动：

1. **移除 OS Keyring 内置 API Key 基础设施** — 删除 `get_api_key_inner()`、`store_api_key`、`has_api_key`、`delete_api_key` Tauri command 及 `keyring` crate 依赖
2. **移除 Gemini API Key Modal** — ProjectView 中整个弹窗删除
3. **所有 Key 配置提醒改为引导到 Settings** — 以下位置原来打开 API Key Modal 或显示 "No Key"，全部改为引导用户跳转 Settings 页面进行 LLM Provider 配置：
   - 顶部 banner "Configure your API Key to enable AI features"（L532-543）
   - Agent error banner "Configure API Key"（L546-556）
   - PM Agent 状态栏 "No Key" 标签 + Key 按钮（L683-713）
   - REQ Agent 状态栏 "No Key" 标签（L938-939）
   - Provider 下拉菜单中的 Key 状态检查（L655, L913）
4. **移除 Gemini 终端** — XTerminal `TerminalKind` 中的 `'gemini'`、EditorView 中的 Gemini CLI 启动按钮
5. **所有 HTTP Agent 统一从 settings.yaml 的 providers 配置获取凭证** — `HttpRuntime` 的 fallback 不再走 keyring

## User Value Points

### VP1: 统一 LLM 配置入口
所有 Agent 的 API 凭证统一从 Settings > LLM Provider 配置中获取。原 API Key Modal、Key 配置 banner、"No Key" 提示全部替换为引导用户前往 Settings 页面配置 Provider。不再有独立的 Keyring/Gemini 入口。

### VP2: 清理 Gemini 品牌绑定
移除 Gemini 终端快捷入口、API Key Modal、所有 Gemini 品牌文案。产品不再与特定 AI 供应商绑定。

## Context Analysis

### Reference Code
**后端 (Rust)**
- `neuro-syntax-ide/src-tauri/src/lib.rs`:
  - KEYRING 常量 (L1058-1059)
  - `get_api_key_inner()` (L7069-7074)
  - `store_api_key` command (L6987-6992)
  - `has_api_key` command (L6994-6999)
  - `delete_api_key` command (L7002-7009)
  - invoke_handler 注册 (L11466-11468)
  - HttpRuntime detect/health_check 中 keyring 检查 (L3480-3510)
  - execute() keyring fallback (L3535)
  - agent_chat_stream keyring fallback (L6837)
  - 文件分析命令 keyring fallback (L11101-11105)
- `neuro-syntax-ide/src-tauri/Cargo.toml` — `keyring = "3"` dependency

**前端 (React/TypeScript)**
- `ProjectView.tsx`:
  - API Key Modal 整体 (L1524-1618) — 删除
  - Banner "Configure your API Key" (L532-543) — 改为引导去 Settings
  - Error banner "Configure API Key" (L546-556) — 改为引导去 Settings
  - PM Agent 状态栏 Key 按钮 (L704-713) — 改为 Settings 链接
  - PM Agent "No Key" 标签 (L683-684) — 改为 Settings 提示
  - REQ Agent "No Key" 标签 (L938-939) — 改为 Settings 提示
  - Provider 下拉菜单 hasKey 检查 (L655, L913) — 保留但文案调整
  - `showApiKeyModal` / `apiKeyInput` / `handleStoreApiKey` state — 删除
- `useAgentStream.ts`:
  - `apiKeyConfigured` state (L134)
  - `checkApiKey` / `storeApiKey` / `removeApiKey` (L401-445)
  - mount 时 checkApiKey 调用 (L440-445)
  - export 的 apiKeyConfigured (L758)
- `useAgentChat.ts`:
  - checkApiKey (L150)
  - storeApiKey 调用 (L216)
- `XTerminal.tsx` — TerminalKind `'gemini'` (L13, L101-102)
- `EditorView.tsx` — Gemini CLI buttons (L1225, L1260, L1271, L2270, L2294-2296)
- `i18n.ts` — geminiCli translations (L74, L342)

### Related Features
- `feat-agent-tool-exec` — 工具执行循环 (已用 HttpRuntime)
- `feat-pm-agent-provider-switch` — PM Agent 提供商切换

## Technical Solution

### 后端 (Rust)
1. 删除 `KEYRING_SERVICE`、`KEYRING_ACCOUNT` 常量
2. 删除 `get_api_key_inner()` 函数
3. 删除 `store_api_key`、`has_api_key`、`delete_api_key` 三个 Tauri command
4. 从 `invoke_handler` 注销这三个 command
5. `HttpRuntime::detect/health_check/info/is_ready` 不再检查 keyring
6. `HttpRuntime::execute()` fallback 不再尝试 keyring，直接返回"请在 Settings 中配置 Provider"错误
7. `agent_chat_stream` fallback 同上
8. 文件分析命令 fallback 同上
9. `Cargo.toml` 移除 `keyring = "3"` 依赖

### 前端 (React/TypeScript)
1. `ProjectView.tsx`:
   - **删除** API Key Modal 整个区块 (L1524-1618)
   - **删除** `showApiKeyModal`、`apiKeyInput` state 和 `handleStoreApiKey` 函数
   - **替换** Banner "Configure your API Key" → "Configure LLM Provider in Settings"，按钮改为调用 `onNavigateToSettings`（已有类似 Settings 导航 props）
   - **替换** Error banner "Configure API Key" → 同上引导去 Settings
   - **替换** PM Agent Key 按钮 → "Go to Settings" 按钮/链接
   - **调整** "No Key" 标签文案 → "Not Configured"，引导去 Settings
   - REQ Agent "No Key" 同上
2. `useAgentStream.ts` — 移除 `apiKeyConfigured`/`checkApiKey`/`configureApiKey`/`removeApiKey` 及相关 export
3. `useAgentChat.ts` — 移除 keyring 相关 checkApiKey/storeApiKey
4. `XTerminal.tsx` — TerminalKind 移除 `'gemini'`，删除 gemini case
5. `EditorView.tsx` — 移除 Gemini CLI 启动按钮、terminalKind label、相关 case
6. `i18n.ts` — 移除 `geminiCli` 翻译条目

## Acceptance Criteria (Gherkin)

### VP1: 统一 LLM 配置入口

```gherkin
Scenario: Agent 使用 Settings 配置的 Provider
  Given 用户在 Settings 中配置了 LLM Provider（含 api_key、api_base）
  When 用户在 PM Agent 对话中发送消息
  Then 消息通过该 Provider 的 API 发送
  And 响应正确流式返回到对话界面
```

```gherkin
Scenario: 未配置 Provider 时引导去 Settings
  Given 用户未在 Settings 中配置任何 LLM Provider 的 api_key
  When 用户查看 PM Agent 面板
  Then 显示"Not Configured"状态提示
  And 点击提示后跳转到 Settings 页面的 LLM 配置区域
  And 不出现 keyring/API Key Modal 弹窗
```

```gherkin
Scenario: 顶部 Banner 引导去 Settings
  Given 没有任何 Provider 配置了 api_key
  When 用户打开项目页面
  Then 顶部显示"Configure LLM Provider in Settings"提示
  And 点击后导航到 Settings 页面
  And 不出现旧的"Set API Key"弹窗
```

### VP2: 清理 Gemini 品牌绑定

```gherkin
Scenario: 编辑器终端无 Gemini 入口
  Given 应用启动完成
  When 用户查看编辑器终端的"新建终端"菜单
  Then 菜单中只有 Bash 和 Claude Code 选项
  And 没有 Gemini CLI 选项
```

```gherkin
Scenario: PM Agent 面板无 API Key 弹窗
  Given 应用启动完成
  When 用户查看 PM Agent 面板
  Then 没有"Gemini API Key"按钮或弹窗
  And Provider 未配置时显示引导去 Settings 的链接
```

### General Checklist
- [ ] Cargo.toml 中 keyring 依赖已移除
- [ ] 无残留 `get_api_key_inner` 调用
- [ ] 无残留 `showApiKeyModal` / `apiKeyInput` 引用
- [ ] 所有原"API Key"入口改为 Settings 导航
- [ ] cargo check 编译无错误
- [ ] TypeScript 编译无错误

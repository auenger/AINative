# Tasks: feat-remove-gemini-builtin

## Task Breakdown

### 1. Rust 后端 — 移除 Keyring 基础设施
- [x] 删除 `KEYRING_SERVICE`、`KEYRING_ACCOUNT` 常量 (lib.rs)
- [x] 删除 `get_api_key_inner()` 函数 (lib.rs)
- [x] 删除 `store_api_key` Tauri command (lib.rs)
- [x] 删除 `has_api_key` Tauri command (lib.rs)
- [x] 删除 `delete_api_key` Tauri command (lib.rs)
- [x] 从 `invoke_handler` 注销这三个 command (lib.rs)
- [x] `Cargo.toml` 移除 `keyring = "3"` 依赖

### 2. Rust 后端 — HttpRuntime/agent_chat_stream 移除 keyring fallback
- [x] `HttpRuntime::detect()` 不再检查 keyring — 始终返回 Available
- [x] `HttpRuntime::health_check()` 改为始终 Available
- [x] `HttpRuntime::info()` 不再依赖 keyring
- [x] `HttpRuntime::execute()` 使用 `get_llm_provider_from_settings` 获取凭证
- [x] `agent_chat_stream` 使用 `state.workspace_path` 获取 settings provider
- [x] `agent_generate_feature_plan` 同上，添加 state 参数
- [x] 文件分析命令移除 keyring fallback，仅使用 settings provider

### 3. 前端 — ProjectView Key 引导改为 Settings 导航
- [x] 删除 API Key Modal 整体 JSX
- [x] 删除 `showApiKeyModal`/`apiKeyInput` state 和 `handleStoreApiKey` 函数
- [x] Banner "Configure your API Key" 改为 "Configure LLM Provider in Settings"
- [x] Error banner "Configure API Key" 改为引导去 Settings
- [x] PM Agent Key 按钮改为 Settings 图标链接
- [x] PM Agent "No Key" 标签改为 "Not Configured"
- [x] REQ Agent "No Key" 标签改为 "Not Configured"
- [x] PM Agent 状态 "No Key" 改为 "Not Configured"
- [x] 添加 `onNavigateToSettings` prop，App.tsx 传入

### 4. 前端 — 清理 useAgentStream/useAgentChat keyring 逻辑
- [x] `useAgentStream.ts` 移除 `apiKeyConfigured`/`checkApiKey`/`configureApiKey`/`removeApiKey`
- [x] `useAgentStream.ts` 清理 mount 时 checkApiKey 调用和 export
- [x] `useAgentChat.ts` 移除 keyring 相关 checkApiKey/storeApiKey/removeApiKey

### 5. 前端 — 移除 Gemini 终端
- [x] `XTerminal.tsx` TerminalKind 移除 `'gemini'`，删除 gemini case
- [x] `EditorView.tsx` 移除"新建终端"菜单 Gemini CLI 选项
- [x] `EditorView.tsx` 移除侧边 Gemini CLI 快捷按钮
- [x] `EditorView.tsx` 清理 terminalKind label map gemini
- [x] `EditorView.tsx` 清理 gemini 相关 case
- [x] `i18n.ts` 移除 `geminiCli` 翻译条目

### 6. 验证
- [x] TypeScript 编译无错误
- [ ] `cargo check` 无错误

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-07 | Created | Feature spec & tasks created |
| 2026-05-07 | Updated | 补充 Key 配置提醒 → Settings 引导的所有位置 |
| 2026-05-07 | Implemented | 全部代码实现完成，TypeScript 编译通过 |

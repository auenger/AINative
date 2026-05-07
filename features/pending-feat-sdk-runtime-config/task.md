# Tasks: feat-sdk-runtime-config

## Task Breakdown

### 1. Rust 端数据结构与配置读取
- [ ] 在 `AppSettings` 中新增 `SdkRuntimeConfig` struct（config_mode, custom_provider, custom_model）
- [ ] 更新 `Default` impl，默认 `config_mode: "claude-config"`
- [ ] `AgentSdkRuntime::execute()` 根据 `config_mode` 分支：claude-config 不注入 env，custom-provider 注入 env + ANTHROPIC_MODEL
- [ ] 新增 Tauri command `check_claude_config` — 检测 `~/.claude/settings.json` 是否存在及状态

### 2. Sidecar 环境变量处理
- [ ] 确认 sidecar 在 `options.env` 为空时不注入任何环境变量
- [ ] Custom Provider 模式注入 `ANTHROPIC_MODEL` 环境变量（解决 model 覆盖问题）

### 3. 前端 Settings SDK 配置 UI
- [ ] Settings LlmPanel 中 Agent Runtime 区域扩展：配置模式单选（Claude Config / Custom Provider）
- [ ] Custom Provider 模式下显示：Provider 下拉 + Model 输入 + 协议兼容性提示
- [ ] Claude Config 模式下显示：.claude 配置检测状态 + 提示信息
- [ ] 配置持久化（`sdk_runtime` 字段写入 settings.yaml）
- [ ] `useSettings` hook 处理 `sdk_runtime` 字段的 update 和 load

### 4. 验证与兼容性
- [ ] Claude Config 模式：不注入 env vars，SDK 使用 .claude 配置
- [ ] Custom Provider 模式：注入 env vars，model 通过 ANTHROPIC_MODEL 覆盖
- [ ] 两种模式切换无需重启 App
- [ ] 回归：ClaudeCodeRuntime（claude -p）不受影响

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-07 | Feature created | 需求分析完成 |

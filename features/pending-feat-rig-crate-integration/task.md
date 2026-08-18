# Tasks: feat-rig-crate-integration
## Task Breakdown

### 1. 添加 rig-core 依赖
- [ ] 在 Cargo.toml 添加 `rig-core` 依赖（启用所需 features: anthropic, openai, gemini, deepseek, ollama）
- [ ] cargo check 确认依赖解析无冲突

### 2. 重写 RigRuntime::execute()
- [ ] 使用 rig 的 ProviderClient 创建对应 provider 的 client
- [ ] 使用 rig 的 Agent builder 构建 agent（preamble = system_prompt）
- [ ] 将 rig_tools 注册为 rig tool definitions
- [ ] 实现 streaming：将 rig 的 streaming response 转换为 StreamEvent
- [ ] 保持 session_id 生成和返回逻辑
- [ ] 保持 token 估算和 session store 逻辑

### 3. 移除手写代码
- [ ] 移除 execute_anthropic / execute_openai_compatible / execute_gemini
- [ ] 移除 stream_anthropic_with_tools / stream_openai_with_tools / stream_gemini
- [ ] 移除 stream_anthropic / stream_openai (deprecated wrappers)
- [ ] 移除 AnthropicToolCall / StreamOutcome / StreamUsage 等手写类型
- [ ] 移除 provider-specific 的 HTTP header 构建逻辑

### 4. 测试验证
- [ ] cargo check 通过
- [ ] 所有 5 种 provider 的请求格式正确
- [ ] Streaming 响应正常显示
- [ ] Tool calling 循环正常
- [ ] /context /help /clear 等命令正常
- [ ] session_id 正确返回

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-06-02 | Feature created | 待开发 |

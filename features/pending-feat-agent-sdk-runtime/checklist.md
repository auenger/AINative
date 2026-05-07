# Checklist: feat-agent-sdk-runtime

## Completion Checklist

### Development
- [ ] All tasks completed
- [ ] Code self-tested
- [ ] Sidecar 脚本可独立运行测试
- [ ] Rust AgentSdkRuntime 通过单元测试
- [ ] 前后端联调通过

### Code Quality
- [ ] Code style follows conventions
- [ ] AgentSdkRuntime 在独立模块 `agent_sdk_runtime.rs`，不堆积到 lib.rs
- [ ] NDJSON 通信协议有容错处理（空行/BOM/非法 JSON）
- [ ] Sidecar 进程异常退出有恢复机制（2 秒检测 + error 事件）
- [ ] Provider 配置正确注入到 sidecar 环境变量（api_base → ANTHROPIC_BASE_URL, api_key → ANTHROPIC_API_KEY）
- [ ] protocol !== "anthropic" 时拒绝执行，不 spawn sidecar

### Testing
- [ ] Unit tests: Rust AgentSdkRuntime（mock sidecar stdin/stdout）
- [ ] Unit tests: Sidecar 脚本 NDJSON 输入输出往返（mock stdin）
- [ ] Integration tests: sidecar 脚本与 SDK 交互
- [ ] E2E: Settings 切换 runtime → REQ Agent 发消息 → 流式响应
- [ ] Provider 兼容性: protocol=openai 时拒绝执行并显示引导提示
- [ ] 错误场景: API Key 无效 / 网络断开
- [ ] 错误场景: Rate limit (429) 在流式中途触发 → 前端显示 rate_limit 事件
- [ ] 错误场景: Sidecar 进程崩溃 → Rust 检测 + error 事件 + 前端提示
- [ ] 多轮对话: 第二条消息保持上下文连贯
- [ ] Runtime 切换: 有活跃会话时切换 → 优雅关闭 + 状态清理
- [ ] Provider 切换: 切换到不同 api_base 后 sidecar 使用新端点
- [ ] 回归: ClaudeCodeRuntime（claude -p）在新增代码后仍可正常工作

### Documentation
- [ ] spec.md technical solution filled
- [ ] NDJSON 通信协议文档化（sidecar ↔ Rust）

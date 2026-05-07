# Tasks: feat-agent-sdk-runtime

## Task Breakdown

### 1. Sidecar 桥接脚本
- [ ] 创建 `neuro-syntax-ide/src-tauri/sidecar/agent-sdk-bridge.mjs`
- [ ] 实现 stdin NDJSON 命令解析（query/interrupt/close）
- [ ] 集成 `@anthropic-ai/claude-agent-sdk` 的 `query()` API，通过 `options.env` 注入 `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_KEY`，通过 `options.model` 指定模型
- [ ] 实现 stdout NDJSON 事件输出（assistant/result/error/rate_limit）
- [ ] 添加 package.json 和依赖声明
- [ ] 错误处理和进程信号管理

### 2. Rust AgentSdkRuntime
- [ ] 创建独立模块 `neuro-syntax-ide/src-tauri/src/agent_sdk_runtime.rs`
- [ ] 定义 `AgentSdkRuntime` struct，实现 `AgentRuntime` trait
- [ ] 实现 `execute()` — 读取当前 Provider 配置（protocol 校验），注入 env vars 到 sidecar spawn，桥接 stdout → StreamEvent channel
- [ ] 实现 Provider 兼容性检查：`protocol !== "anthropic"` 时返回错误，不 spawn sidecar
- [ ] 实现 NDJSON 解析容错（跳过空行/BOM，解析失败记入 debug 日志）
- [ ] 实现 session 管理（resume/fork）
- [ ] 实现 health_check — 检查 sidecar 二进制和 Node.js 可用性
- [ ] 实现 `info()` — 返回 sidecar 进程 PID，供运行时监控器识别
- [ ] 在 `lib.rs` 添加 `mod agent_sdk_runtime;` 和 runtime 注册（runtime_type: "agent-sdk"）

### 3. 前端 Settings 配置
- [ ] Settings Agent 配置区新增 Runtime 类型下拉（claude-cli / agent-sdk）
- [ ] 选择 agent-sdk 时显示当前 Provider 兼容性状态（protocol: anthropic ✓ / ✗）
- [ ] 不兼容时显示引导提示（切换 Provider 或新增 anthropic 协议 Provider）
- [ ] Runtime 选择持久化到 settings YAML
- [ ] useReqAgentChat 内部根据 Settings runtime 类型路由到对应 AgentRuntime

### 4. 打包与分发（仅 macOS，Windows/Linux 为后续 feature）
- [ ] 配置 Tauri sidecar 打包（`tauri.conf.json` externalBin）
- [ ] 调研并选定 Node.js runtime 打包方案（pkg / sea / 内嵌 node），记录决策理由
- [ ] macOS 本地验证 sidecar 打包和运行

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-07 | Feature created | 调研完成，spec 编写 |

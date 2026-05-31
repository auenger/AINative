# Tasks: feat-rig-builtin-agent-core

## Task Breakdown

### 1. 依赖配置
- [x] ~~升级 `reqwest` 从 0.12 到 0.13~~ 决策：不升级 reqwest，不添加 rig-core 依赖
- [x] 直接使用现有 reqwest 0.12 + futures SSE 流式（避免版本冲突）
- [x] 编译验证无版本冲突

### 2. RigRuntime 核心实现
- [x] 创建 `src-tauri/src/rig_runtime.rs` 模块文件
- [x] 实现 `RigRuntime::new()` 构造函数
- [x] 实现 `AgentRuntime::id()` → `"rig"`
- [x] 实现 `AgentRuntime::name()` → `"Rig (Built-in)"`
- [x] 实现 `AgentRuntime::runtime_type()` → `"builtin"`
- [x] 实现 `AgentRuntime::capabilities()` → `[Streaming, ToolUse, Sessions]`
- [x] 实现 `AgentRuntime::detect()` → 内置可用（检查 API Key）
- [x] 实现 `AgentRuntime::health_check()` → 验证 API Key
- [x] 实现 `AgentRuntime::install_hint()` → 提示配置 API Key
- [x] 实现 `AgentRuntime::info()` → 返回 RuntimeInfo

### 3. 流式 Execute 实现
- [x] 实现 `AgentRuntime::execute()` 核心方法
- [x] Anthropic API Key 解析（settings.yaml Anthropic provider + env fallback）
- [x] Anthropic Messages API 请求构建（system prompt, messages, stream）
- [x] SSE `bytes_stream` → `StreamEvent` 转换
- [x] `mpsc::channel` 创建与发送
- [x] 错误处理与超时控制

### 4. 注册集成
- [x] `mod rig_runtime;` 声明到 `lib.rs`
- [x] `create_default_registry()` 添加 `RigRuntime`
- [x] `runtime_execute` command 自动适配 `builtin` 类型（无需修改，已通过 trait 统一调度）

### 5. 前端适配
- [x] Settings Runtime 下拉新增 "Rig (Built-in)" 选项
- [x] `useReqAgentChat` 兼容 `rig` runtime ID（无需修改，已通过 `getConfiguredRuntimeId()` 动态读取）
- [x] Runtime 图标/标识区分（使用 Settings 下拉 label 区分）

### 6. 测试
- [x] 编译通过 + 现有功能回归
- [ ] Rig Runtime 扫描显示 Available（需配置 API Key 后测试）
- [ ] 流式聊天端到端测试（需配置 API Key 后测试）
- [ ] API Key 未配置时正确降级（需运行时测试）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-31 | Feature 创建 | 子 Feature 1/3 |
| 2026-05-31 | 实现完成 | 决策：不引入 rig-core 依赖，直接用 reqwest 0.12 HTTP SSE 流式；避免版本冲突；编译通过 |

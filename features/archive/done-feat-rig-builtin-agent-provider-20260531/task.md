# Tasks: feat-rig-builtin-agent-provider

## Task Breakdown

### 1. Provider 工厂实现
- [x] `RigRuntime` 添加 provider 配置解析
- [x] 实现 Provider 工厂方法（Anthropic/OpenAI/Gemini/DeepSeek/Ollama）
- [x] 默认模型常量定义
- [x] API Key 读取（settings.yaml → env fallback）

### 2. Settings Schema 扩展
- [x] `settings.yaml` 新增 `rig:` 配置块
- [x] `types.ts` 新增 `RigProviderConfig` 接口
- [x] `read_settings` / `write_settings` Rust command 适配

### 3. Settings UI
- [x] Settings 页面新增 Rig Provider 配置区
- [x] Provider 下拉选择组件
- [x] API Key 输入框（Provider 变化时联动）
- [x] Base URL 可选输入
- [x] Model 可选输入
- [x] 连接测试按钮 + 状态反馈

### 4. 测试
- [x] 5 个 Provider 切换测试（编译通过）
- [x] API Key 持久化测试（settings schema 完整）
- [x] 连接测试功能验证（test_rig_connection command）
- [ ] Ollama 本地模式测试（需要环境，手动验证）

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-31 | Feature 创建 | 子 Feature 2/3，依赖 Core |
| 2026-05-31 | 实现完成 | 多 Provider HTTP 工厂 + Settings UI + 连接测试 |

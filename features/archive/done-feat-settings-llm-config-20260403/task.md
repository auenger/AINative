# Tasks: feat-settings-llm-config

## Task Breakdown

### 1. Rust 后端 — 配置读写 Command
- [ ] 定义 `AppSettings` / `ProviderConfig` / `LlmConfig` / `AppConfig` Rust 结构体
- [ ] 实现 `read_settings` Command（读取 `{workspace}/.neuro/settings.yaml`）
- [ ] 实现 `write_settings` Command（序列化并写入 YAML）
- [ ] 实现 `test_llm_connection` Command（调用 `{api_base}/models` 验证）
- [ ] 在 `main.rs` / `lib.rs` 注册新 Commands

### 2. 前端 — SettingsView 组件
- [ ] 创建 `SettingsView.tsx` 组件（分区 Tab 布局：General / LLM Providers）
- [ ] 实现 General 配置区（自动刷新间隔 Slider + Toggle）
- [ ] 实现 LLM Providers 配置区（Provider 列表 + 增删 + 编辑表单）
- [ ] API Key 输入框（密码模式 + 点击显示）
- [ ] 连接测试按钮（loading 状态 + 结果反馈）
- [ ] Save 按钮 + 表单验证

### 3. 前端 — 配置 Hook
- [ ] 创建 `useSettings.ts` hook（read_settings / write_settings IPC 调用）
- [ ] dev fallback mock 配置数据

### 4. 前端 — 集成与路由
- [ ] `App.tsx` 注册 SettingsView 到 'settings' ViewType
- [ ] `SideNav.tsx` 确认 settings 入口连接到 SettingsView
- [ ] `types.ts` 新增 Settings 相关类型定义

### 5. 前端 — useQueueData 增强
- [ ] 新增可配置刷新间隔逻辑（setInterval + cleanup）
- [ ] dev fallback 支持定时刷新
- [ ] 读取 settings 中的 auto_refresh_interval 配置

### 6. 测试与验证
- [ ] Settings 页面渲染验证
- [ ] LLM Provider 配置保存/加载验证
- [ ] 自动刷新功能验证
- [ ] 深色/浅色主题适配验证

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-03 | Feature created | 等待开发启动 |

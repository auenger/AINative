# Tasks: feat-ai-agent-service

## Task Breakdown

### 1. SSE 流式通信 (子任务 A)
- [ ] Cargo.toml 添加 reqwest (stream feature), futures 依赖
- [ ] 实现 SSE HTTP/2 请求 (text/event-stream)
- [ ] 实现 token 块解析和广播 emit("pm_agent_chunk")
- [ ] 前端: listen('pm_agent_chunk') → 对话区打字效果
- [ ] 前端: Markdown 实时渲染 (react-markdown)
- [ ] 错误处理: 网络中断、API 限流、Token 超限

### 2. Keyring 凭证管理 (子任务 B)
- [ ] Cargo.toml 添加 keyring 依赖
- [ ] 实现 `store_api_key(service, key)` command
- [ ] 实现 `get_api_key(service)` command
- [ ] 实现 `delete_api_key(service)` command
- [ ] 前端: 设置页面添加 API Key 输入区
- [ ] 密码遮罩显示，不明文展示

### 3. 结构化输出与 Feature 自动创建 (子任务 C)
- [ ] 定义 Feature 规划的 JSON Schema
- [ ] 实现 Agent structured_output 解析
- [ ] 解析成功后调用 feat-fs-database-engine 的写回 API
- [ ] 自动创建 features/pending-feat-{id}/ 目录
- [ ] 自动生成 plan.md / task.md
- [ ] 自动更新 queue.yaml
- [ ] 验证: Agent 创建后看板自动刷新

### 4. 验证
- [ ] PM Agent 对话流式输出正常
- [ ] API Key 存取安全
- [ ] Agent 创建 Feature 后文件系统变更正确
- [ ] 看板自动刷新

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-01 | Created | Feature 规划完成，建议按 A→B→C 顺序开发 |

# Tasks: feat-agent-provider-core

## Task Breakdown

### 1. OpenClaw Provider — WebSocket Protocol
- [ ] 定义 OpenClaw WebSocket 消息类型（Request/Response/Event）
- [ ] 实现 `openclaw_detect` CLI 检测逻辑
- [ ] 实现 `openclaw_gateway_start` 进程管理
- [ ] 实现 WebSocket 连接管理（connect/reconnect/close）
- [ ] 实现消息收发（req/res + event stream）

### 2. Hermes Provider Enhancement
- [ ] 实现 `hermes_list_skills` Skill 目录扫描
- [ ] 实现 `hermes_read_memory` / `hermes_write_memory` Memory 读写
- [ ] 实现 `hermes_get_mcp_config` MCP 配置解析
- [ ] 实现 `hermes_search_sessions` SQLite FTS5 查询

### 3. Provider Abstraction Layer
- [ ] 扩展 `AgentRuntime` trait 支持 WebSocket 协议
- [ ] 统一 Provider 配置类型（`AgentProviderConfig`）
- [ ] Provider 工厂模式（根据类型创建对应 Provider）

### 4. Settings UI
- [ ] Provider 选择下拉组件
- [ ] OpenClaw 配置面板（Gateway URL / Auth / Status）
- [ ] Hermes 配置面板（CLI Path / Skills / Memory / MCP）
- [ ] Runtime Detection 列表展示

### 5. 前端 Hook 集成
- [ ] 扩展 `useAgentRuntimes` 支持 OpenClaw/Hermes 检测
- [ ] 新增 `useAgentProvider` 统一 Provider 管理 Hook
- [ ] 集成到现有 Agent 对话流程

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-09 | 规划完成 | 待开发 |

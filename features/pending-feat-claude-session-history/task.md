# Tasks: feat-claude-session-history

## Task Breakdown

### 1. Rust Backend — 会话列表 API
- [ ] 新增 `list_claude_sessions` Tauri Command
  - 读取 `~/.claude/projects/<encoded-path>/.session_cache.json`
  - 解析为 `SessionListItem[]` 结构（id, summary, time, message_count, model, git_branch）
  - 按最后活跃时间倒序排列
- [ ] 新增 `SessionListItem` 和 `SessionCache` 类型定义
- [ ] 注册 Command 到 Tauri builder

### 2. Rust Backend — 会话详情 API
- [ ] 新增 `get_claude_session_detail` Tauri Command
  - 接收 `session_id` + `workspace_path`
  - 读取对应 `<session_id>.jsonl` 文件
  - 解析 JSONL 为 `SessionMessage[]`（支持分页：offset + limit）
  - 提取元数据：时间范围、token 统计、模型、消息总数
- [ ] 新增 `SessionMessage`, `SessionDetail`, `SessionMetadata` 类型
- [ ] 处理大文件：支持从文件末尾读取（tail）用于分页

### 3. Rust Backend — 搜索 API
- [ ] 新增 `search_claude_sessions` Tauri Command
  - 接收 `query` + `workspace_path`
  - 遍历 session cache 中的摘要和首/末消息进行匹配
  - 返回匹配的 `SessionListItem[]`

### 4. Frontend — 类型定义
- [ ] 在 `types.ts` 中新增 `ClaudeSessionListItem`, `ClaudeSessionDetail`, `ClaudeSessionMessage`, `ClaudeSessionMetadata` 类型

### 5. Frontend — 会话列表组件
- [ ] 创建 `SessionHistoryPanel.tsx`
  - 左侧面板：会话列表（glass-panel 卡片）
  - 搜索框（实时过滤）
  - 每个会话卡片：摘要、时间、消息数、模型
  - 点击选中高亮
  - 空状态提示

### 6. Frontend — 对话回放组件
- [ ] 创建 `SessionReplayView.tsx`
  - 右侧面板：聊天记录回放
  - 用户消息气泡（右对齐）
  - AI 回复气泡（左对齐，含 thinking 折叠区）
  - 工具调用块（工具名 + 参数摘要，可展开）
  - 系统消息（灰色背景行）
  - 骨架屏加载动画
  - 向上滚动加载更多（分页）

### 7. Frontend — 集成到 MissionControl
- [ ] 在 `MissionControl.tsx` 中新增 "Session History" tab
- [ ] 接入 `list_claude_sessions` API 获取会话列表
- [ ] 接入 `get_claude_session_detail` API 获取对话详情
- [ ] 连接搜索功能

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-27 | Feature created | 调查了 Claude Code JSONL 存储机制，确认数据完整可用 |

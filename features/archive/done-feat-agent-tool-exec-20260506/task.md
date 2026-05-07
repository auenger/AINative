# Tasks: feat-agent-tool-exec

## Task Breakdown

### 1. XML 工具调用解析器
- [x] 实现 `parse_tool_calls(text: &str) -> Vec<ToolCall>` — 解析 `<write_to_file>`, `<read_file>`, `<list_files>` XML 块
- [x] 定义 `ToolCall` 结构体：`{ tool_type, path, content }`
- [x] 路径安全验证函数：`is_path_safe(path: &str, workspace: &str) -> bool`

### 2. 工具执行函数
- [x] 实现 `execute_tool_call(tool: &ToolCall, workspace: &str) -> ToolResult`
- [x] `write_to_file` — 写文件，自动创建父目录
- [x] `read_file` — 读文件内容
- [x] `list_files` — 列目录，返回格式化文本

### 3. Agentic Loop 改造
- [x] 重构 `GeminiHttpRuntime::execute()` 为循环结构
- [x] 每轮循环：API 请求 → 流式返回 → 解析工具 → 执行 → 构建工具结果消息 → 继续
- [x] 发射 `tool_use` 和 `tool_result` 类型的 StreamEvent
- [x] 最大迭代次数保护 (TOOL_LOOP_MAX_ITERATIONS = 20)

### 4. 消息历史管理
- [x] 构建工具结果回传的 messages 格式（OpenAI-compatible）
- [x] 工具结果作为 user message 回传给 API

### 5. 前端 tool 事件处理
- [x] useAgentStream.ts 处理 tool_use 和 tool_result 事件类型
- [x] 工具执行状态内联显示在 assistant 消息流中

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-06 | Feature created | 从 feat-agent-tool-loop 拆分 |
| 2026-05-06 | Implementation complete | XML parser, tool executor, agentic loop, frontend events |

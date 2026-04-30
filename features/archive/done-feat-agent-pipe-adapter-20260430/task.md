# Tasks: feat-agent-pipe-adapter

## Task Breakdown

### 1. PipeAdapter 核心实现
- [x] `parse_pipe_line()` — 按 agent 类型解析 NDJSON 行为 PipeMessage
- [x] `build_prompt_input()` — 按 agent 类型构造 stdin JSON
- [x] `parse_claude_message()` / `parse_cursor_message()` / `parse_opencode_message()` — 各格式解析器
- [x] stdin 关闭时机管理（prompt 写完后立即 close，drop BufWriter）
- [x] `poll_pipe_stdout()` — pipe 专用 stdout 轮询，解析 NDJSON 并 emit `agent://message`

### 2. Claude Code 适配
- [x] 启动参数：`claude -p --output-format stream-json --input-format stream-json --verbose`
- [x] stdin 输入格式：`{"type":"user","message":{...}}`
- [x] stdout 解析：system / assistant / user / result / control_request
- [x] control_request 自动审批（bypassPermissions 模式，build_pipe_args 添加 --permission-mode）
- [x] 支持 `--resume` 会话续接（通过 build_pipe_args）
- [x] 支持 `--model` 模型选择（通过 build_pipe_args）
- [x] 支持 `--append-system-prompt` 注入系统提示（通过 build_pipe_args）

### 3. Cursor Agent 适配
- [x] 启动参数：`agent -p --output-format stream-json`
- [x] stdout 解析：system / assistant / tool_call / result
- [x] 支持 `--force` (yolo mode) 自动审批

### 4. OpenCode 适配
- [x] 启动参数：`opencode run --format json`
- [x] stdout 解析：message / tool_use / tool_result / complete 事件

### 5. Tauri Command 注册
- [x] 注册 `pipe_execute` command
- [x] 参数：agent_type, prompt, working_dir, timeout, model, resume_session, system_prompt

### 6. 前端集成
- [x] `useStdioAgent.ts` 新增 `executePipeAgent()` 方法
- [x] 新增 PipeMessage / PipeSession / PipeExecuteOptions 类型
- [x] `agent://message` 事件监听与 pipeMessages state
- [x] isPipeExecuting / activePipeSessionId 状态管理

### 7. 共存验证（方案 B 必须）
- [x] 确认 PipeAdapter 不修改 StdioSessionManager（直接 spawn，独立路径）
- [x] 确认 pipe_execute command 与 runtime_execute 并行注册
- [x] 确认 agent://message 事件格式独立于 agent://chunk
- [ ] 回归测试：通过 runtime_execute 执行 Claude Code 任务，验证现有链路不受影响

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-29 | Feature created | 初始设计完成 |
| 2026-04-30 | Implementation complete | Rust 编译通过，前端类型+hook 完成 |

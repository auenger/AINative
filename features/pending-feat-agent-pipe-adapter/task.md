# Tasks: feat-agent-pipe-adapter

## Task Breakdown

### 1. PipeAdapter 核心实现
- [ ] `PipeAdapter::execute()` — spawn → write prompt → close stdin → read stdout loop
- [ ] `build_prompt_input()` — 按 agent 类型构造 stdin JSON
- [ ] `parse_pipe_line()` — 按 agent 类型解析 NDJSON 行为 AgentMessage
- [ ] stdin 关闭时机管理（prompt 写完后立即 close）

### 2. Claude Code 适配
- [ ] 启动参数：`claude -p --output-format stream-json --input-format stream-json --verbose`
- [ ] stdin 输入格式：`{"type":"user","message":{...}}`
- [ ] stdout 解析：system / assistant / user / result / control_request
- [ ] control_request 自动审批（bypassPermissions 模式）
- [ ] 支持 `--resume` 会话续接
- [ ] 支持 `--model` 模型选择
- [ ] 支持 `--append-system-prompt` 注入系统提示

### 3. Cursor Agent 适配
- [ ] 启动参数：`agent -p --output-format stream-json`
- [ ] stdout 解析：system / assistant / tool_call / result
- [ ] 支持 `--force` (yolo mode) 自动审批

### 4. OpenCode 适配
- [ ] 启动参数：`opencode run --format json`
- [ ] stdout 解析：message / tool_use / tool_result / complete 事件

### 5. Tauri Command 注册
- [ ] 注册 `pipe_execute` command
- [ ] 参数：agent_type, prompt, working_dir, timeout, model, resume_session

### 6. 前端集成
- [ ] `useStdioAgent.ts` 新增 `executePipeAgent()` 方法（不在 useAgentStream.ts 中修改）
- [ ] 消息渲染适配：text / tool_use / tool_result / thinking 类型

### 7. 共存验证（方案 B 必须）
- [ ] 确认 PipeAdapter 通过 StdioSessionManager 工作，不直接 spawn 进程
- [ ] 确认 pipe_execute command 与 runtime_execute 并行注册
- [ ] 确认 agent://message 事件格式独立于 agent://chunk
- [ ] 回归测试：通过 runtime_execute 执行 Claude Code 任务，验证现有链路不受影响

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-29 | Feature created | 初始设计完成 |

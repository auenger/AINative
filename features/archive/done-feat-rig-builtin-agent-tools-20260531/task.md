# Tasks: feat-rig-builtin-agent-tools

## Task Breakdown

### 1. File Tools
- [x] 实现 `FileReadTool` — 读取文件内容
- [x] 实现 `FileWriteTool` — 写入文件内容
- [x] 实现 `ListDirTool` — 列出目录内容
- [x] 路径安全约束（workspace sandbox）

### 2. Shell Tool
- [x] 实现 `ShellExecTool` — 执行 Shell 命令
- [x] 命令超时控制（30s）
- [x] 危险命令黑名单过滤

### 3. Git Tools
- [x] 实现 `GitStatusTool` — Git 状态查询
- [x] 实现 `GitDiffTool` — Git Diff 查询
- [x] Git 操作限制为只读

### 4. Agent 集成
- [x] Agent builder 注册所有 Tool
- [x] Tool 调用事件 → StreamEvent 转换
- [x] Tool 结果 → LLM 上下文传递
- [x] 多轮 tool_use 循环测试

### 5. 前端适配
- [x] 工具调用事件在聊天区渲染（复用 tool_use UI）
- [x] 工具结果显示/折叠

### 6. 测试
- [x] FileRead/Write 正常读写
- [x] 路径遍历攻击防护
- [x] Shell 超时和危险命令拦截
- [x] 多轮工具调用循环
- [x] 端到端 Agent + 工具链路测试

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-05-31 | Feature 创建 | 子 Feature 3/3，依赖 Core |
| 2026-05-31 | 实现完成 | 6 工具 + 安全约束 + 多轮循环 + 14 测试全通过 |

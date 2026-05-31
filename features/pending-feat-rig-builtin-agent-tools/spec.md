# Feature: feat-rig-builtin-agent-tools Rig IDE Tools — 文件/Shell/Git 工具集

## Basic Information
- **ID**: feat-rig-builtin-agent-tools
- **Name**: Rig IDE Tools — Rust 原生文件/Shell/Git 工具集
- **Priority**: 85
- **Size**: S
- **Dependencies**: feat-rig-builtin-agent-core
- **Parent**: feat-rig-builtin-agent
- **Children**: null
- **Created**: 2026-05-31

## Description
使用 Rig 的 `Tool` trait 实现 IDE 工具集，使 Agent 可以直接在 Rust 进程内
执行文件读写、Shell 命令、Git 操作等任务。
工具执行无需外部依赖，速度极快，结果直接返回给 LLM。

通过 `Tool` trait + `ToolSet` 注册到 Agent，LLM 在 tool_use 循环中自动调用。

## User Value Points

### VP1: Agent 直接操作本地文件
Agent 通过工具调用直接读写项目文件、执行 Shell 命令、查看 Git 状态，
无需外部 CLI，响应速度快，结果准确。

## Context Analysis

### Reference Code
- `rig_runtime.rs` — Core 实现（依赖，Agent 构建）
- `lib.rs` — 现有 `read_file` / `write_file` / `list_dir` 等 FS command
- `lib.rs` — 现有 `git_log` / `git_status` / `git_diff` 等 Git command
- `lib.rs` — 现有 `execute_command` Shell 执行 command
- `types.ts` — `AgentCapability::ToolUse`

### Related Documents
- [Rig Tool Module](https://docs.rs/rig-core/0.37.0/rig_core/tool/index.html)
- [Rig Agent with Tools Example](https://github.com/0xPlaygrounds/rig/tree/main/rig-core/examples)

### Related Features
- `feat-rig-builtin-agent-core` — 前置依赖（Agent 构建器）
- `feat-agent-tool-loop` (completed) — 工具执行循环参考

## Technical Solution

### 1. Tool 定义
```rust
// 每个 Tool 实现 rig::tool::Tool trait

struct FileReadTool { workspace: PathBuf }
struct FileWriteTool { workspace: PathBuf }
struct ShellExecTool { workspace: PathBuf }
struct ListDirTool { workspace: PathBuf }
struct GitStatusTool { workspace: PathBuf }
struct GitDiffTool { workspace: PathBuf }
```

### 2. Tool Schema 示例
```rust
// FileReadTool
impl Tool for FileReadTool {
    fn definition(&self) -> ToolDefinition {
        ToolDefinition {
            name: "file_read".into(),
            description: Some("Read file content from the workspace".into()),
            parameters: json_schema!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Relative file path" }
                },
                "required": ["path"]
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<String, ToolError> {
        let full_path = self.workspace.join(&args.path);
        // 安全检查：确保路径在 workspace 内
        tokio::fs::read_to_string(&full_path).await
            .map_err(|e| ToolError::CallError(e.to_string()))
    }
}
```

### 3. Agent 构建
```rust
let agent = client
    .agent(model)
    .preamble(system_prompt)
    .tool(FileReadTool { workspace })
    .tool(FileWriteTool { workspace })
    .tool(ShellExecTool { workspace })
    .tool(ListDirTool { workspace })
    .tool(GitStatusTool { workspace })
    .build();
```

### 4. 安全约束
- 文件操作限制在 workspace 目录内（路径遍历保护）
- Shell 命令超时 30s
- 禁止危险命令：`rm -rf /`, `sudo`, `mkfs` 等
- Git 操作只读（status/diff/log），不执行写操作

### 5. 工具事件流
```rust
// Tool call → StreamEvent
StreamEvent {
    msg_type: "tool_use",
    text: json!({ "name": "file_read", "args": { "path": "main.rs" } }).to_string(),
    is_done: false,
    ..
}
// Tool result → StreamEvent
StreamEvent {
    msg_type: "tool_result",
    text: "file content...",
    is_done: false,
    ..
}
```

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我想要内置 Agent 能够自动读取项目文件、执行命令，
以便 Agent 可以理解代码上下文并给出精准的建议。

### Scenarios

#### Scenario 1: Agent 读取文件
```gherkin
Given Agent Runtime 为 Rig (Built-in)
When 用户发送 "读取 src/main.rs 并解释"
Then Agent 应调用 file_read 工具
And 工具调用事件应在前端显示
And 文件内容应作为上下文用于回答
```

#### Scenario 2: Agent 执行 Shell 命令
```gherkin
Given Agent Runtime 为 Rig (Built-in)
When 用户发送 "运行 cargo check 检查项目"
Then Agent 应调用 shell_exec 工具
And 命令输出应返回给 Agent
And Agent 应分析输出并给出反馈
```

#### Scenario 3: 路径安全保护
```gherkin
Given Agent 请求读取 "../../etc/passwd"
When FileReadTool 执行
Then 应返回 "Access denied: path outside workspace" 错误
And 不应读取 workspace 外的文件
```

### General Checklist
- [ ] 6 个 Tool 实现（FileRead/Write/ShellExec/ListDir/GitStatus/GitDiff）
- [ ] Agent builder 注册所有 Tool
- [ ] 路径安全约束（workspace sandbox）
- [ ] Shell 命令超时 + 危险命令过滤
- [ ] 工具调用事件前端渲染
- [ ] 工具结果正确传递给 LLM

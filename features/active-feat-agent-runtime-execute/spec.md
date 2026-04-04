# Feature: feat-agent-runtime-execute AgentRuntime 执行方法 + ClaudeCodeRuntime 实现

## Basic Information
- **ID**: feat-agent-runtime-execute
- **Name**: AgentRuntime 执行方法 + ClaudeCodeRuntime 实现
- **Priority**: 80
- **Size**: M
- **Dependencies**: []
- **Parent**: feat-agent-unified-exec
- **Children**: []
- **Created**: 2026-04-04

## Description
给 `AgentRuntime` trait 添加 `execute()` 方法，实现 `ClaudeCodeRuntime` 的执行逻辑。修复当前 REQ Agent 通过 CLI 子进程调用时的 "Thinking" 卡住问题。

核心改动：
1. `AgentRuntime` trait 新增 `execute()` + `send_message()` 方法
2. `ClaudeCodeRuntime` 实现带 timeout、错误捕获、session 管理的执行逻辑
3. 新增统一的 `runtime_execute` Tauri command
4. REQ Agent 的 `req_agent_send_message` 改为调用 Runtime execute

## User Value Points
1. **REQ Agent 可靠性** — 修复 "Thinking" 卡住，加入 60s timeout 和完整错误处理
2. **执行层标准化** — 所有 CLI runtime 通过统一接口执行，为 Pipeline 打基础

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src-tauri/src/lib.rs:451-470` — `AgentRuntime` trait 定义
- `neuro-syntax-ide/src-tauri/src/lib.rs:721-780` — `ClaudeCodeRuntime` 当前实现
- `neuro-syntax-ide/src-tauri/src/lib.rs:3318-3640` — REQ Agent 当前 CLI 调用逻辑
- `neuro-syntax-ide/src-tauri/src/lib.rs:1400-1420` — AppState 中的 req_agent 字段
- `neuro-syntax-ide/src/lib/useReqAgentChat.ts` — 前端 REQ Agent hook

### Related Documents
- AgentRuntime trait 的 capabilities 已定义 streaming/sessions/tool-use

### Related Features
- feat-agent-runtime-core（已完成）— 基础 trait
- fix-reqagent-connection（已完成）— 上次的临时修复

## Technical Solution

### 1. AgentRuntime trait 扩展

```rust
// 新增到 AgentRuntime trait
pub struct ExecuteParams {
    pub message: String,
    pub session_id: Option<String>,
    pub workspace: Option<String>,
    pub system_prompt: Option<String>,
    pub timeout_secs: u64,
}

pub struct StreamEvent {
    pub text: String,
    pub is_done: bool,
    pub error: Option<String>,
    pub msg_type: String,
    pub session_id: Option<String>,
}

pub trait AgentRuntime: Send + Sync {
    // ... existing methods ...

    /// Execute a message and return a receiver for streaming events
    fn execute(&self, params: ExecuteParams) -> Result<std::sync::mpsc::Receiver<StreamEvent>, String>;

    /// Check if the runtime is ready for execution
    fn is_ready(&self) -> bool;
}
```

### 2. ClaudeCodeRuntime.execute() 实现

```rust
impl AgentRuntime for ClaudeCodeRuntime {
    fn execute(&self, params: ExecuteParams) -> Result<Receiver<StreamEvent>, String> {
        // Build CLI args with proper flags
        let mut args = vec![
            "--print", "--output-format", "stream-json",
            "--dangerously-skip-permissions",  // 替代 acceptEdits 避免挂起
        ];

        if let Some(sid) = &params.session_id {
            args.extend(["--resume", "--session-id", sid]);
        }

        if let Some(sp) = &params.system_prompt {
            args.extend(["--append-system-prompt", sp]);
        }

        if let Some(ws) = &params.workspace {
            args.extend(["--add-dir", ws]);
        }

        args.push("--");
        args.push(&params.message);

        let mut child = Command::new("claude")
            .args(&args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        // Spawn reader threads with timeout
        let (tx, rx) = std::sync::mpsc::channel();

        // stdout reader thread
        let tx_stdout = tx.clone();
        std::thread::spawn(move || {
            // ... read stdout lines, parse JSON, send via tx ...
        });

        // stderr reader thread
        let tx_stderr = tx.clone();
        std::thread::spawn(move || {
            // ... read stderr, send error events ...
        });

        // timeout watcher thread
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_secs(params.timeout_secs));
            let _ = tx.send(StreamEvent {
                text: String::new(),
                is_done: true,
                error: Some("Timeout: CLI process exceeded time limit".into()),
                msg_type: "timeout".into(),
                session_id: None,
            });
        });

        Ok(rx)
    }
}
```

### 3. 新增 Tauri Command

```rust
#[tauri::command]
async fn runtime_execute(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    runtime_id: String,
    message: String,
    session_id: Option<String>,
    system_prompt: Option<String>,
) -> Result<(), String> {
    let registry = state.agent_runtime_registry.lock()?;
    let runtime = registry.get_runtime_instance(&runtime_id)?;

    let workspace = state.workspace_path.lock()?.clone();
    let params = ExecuteParams {
        message,
        session_id,
        workspace: if workspace.is_empty() { None } else { Some(workspace) },
        system_prompt,
        timeout_secs: 120,
    };

    let receiver = runtime.execute(params)?;

    // Spawn thread to forward events to frontend
    std::thread::spawn(move || {
        while let Ok(event) = receiver.recv() {
            let _ = app.emit("agent://chunk", &event);
            if event.is_done { break; }
        }
    });

    Ok(())
}
```

### 4. REQ Agent 迁移

`useReqAgentChat.ts` 改为调用 `runtime_execute` 替代 `req_agent_send_message`，事件监听改为 `agent://chunk`。

### 关键修复点
- `--permission-mode acceptEdits` → `--dangerously-skip-permissions`（避免交互式确认挂起）
- 加入 120s 全局 timeout
- stderr 错误实时反馈到前端
- 进程异常退出时发送 `is_done: true` 事件

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望 REQ Agent 能稳定工作，不再卡在 "Thinking" 状态。

### Scenarios

```gherkin
Scenario: 正常消息发送与接收
  Given Claude Code CLI 已安装且已认证
  And 用户已连接 REQ Agent
  When 用户发送 "帮我分析一个需求"
  Then 应在 5 秒内开始收到流式响应
  And 响应完成后 streaming 状态变为 false

Scenario: CLI 进程超时
  Given Claude Code CLI 已安装
  When CLI 进程运行超过 120 秒
  Then 前端应收到超时错误事件
  And streaming 状态自动恢复
  And 用户可以再次发送消息

Scenario: CLI 未安装
  Given 系统中未安装 Claude Code CLI
  When 用户尝试连接 REQ Agent
  Then 应显示 "Claude Code CLI 未安装" 的错误提示
  And 不应出现 "Thinking" 卡住的情况

Scenario: CLI 认证过期
  Given Claude Code CLI 已安装但未认证
  When 用户发送消息
  Then 应在 stderr 中捕获认证错误
  And 前端应显示认证提示
  And 不应永久挂起
```

### General Checklist
- [ ] AgentRuntime trait 新增 execute() 方法
- [ ] ClaudeCodeRuntime 实现 execute()
- [ ] 120s 超时机制
- [ ] 错误事件正确传递到前端
- [ ] 进程异常退出时发送 is_done
- [ ] 前端 hook 改用新事件格式

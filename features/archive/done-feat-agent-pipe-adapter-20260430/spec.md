# Feature: feat-agent-pipe-adapter NDJSON Pipe Adapter

## Basic Information
- **ID**: feat-agent-pipe-adapter
- **Name**: NDJSON Pipe Adapter（Claude Code / Cursor / OpenCode）
- **Priority**: 70
- **Size**: S
- **Dependencies**: feat-agent-stdio-core
- **Parent**: feat-universal-agent-runtime
- **Children**: none
- **Created**: 2026-04-29

## Description

在 feat-agent-stdio-core 的基础上，实现 **Pipe adapter** — 通过 NDJSON（换行分隔 JSON）协议与 agent CLI 通信。覆盖使用 pipe 模式的 agent：Claude Code、Cursor Agent、OpenCode。

Pipe 模式特点：
- **单向流**：写入 prompt → 关闭 stdin → 读取 stdout 流式 NDJSON 直到进程退出
- **无会话持久**：每次执行是独立进程，不支持多轮对话（除非 agent 支持 `--resume`）
- **输出格式明确**：每行是完整 JSON 对象，按 `type` 字段分发

## User Value Points

1. **Claude Code Pipe 通信** — 通过 `claude -p --output-format stream-json` 实现结构化任务执行
2. **Cursor / OpenCode Pipe 通信** — 通过 `agent -p` / `opencode run --format json` 覆盖更多 agent

## Context Analysis

### Reference Code
- Multica `server/pkg/agent/claude.go` — `writeClaudeInput()` + stdout scanner + control request handling
- 当前项目 `neuro-syntax-ide/src/lib/useAgentStream.ts` — 现有 Claude Code 调用

### Claude Code stream-json 消息格式
```jsonc
// type: "system" — 系统初始化
{"type":"system","subtype":"init","session_id":"...","tools":[...]}

// type: "assistant" — LLM 响应（含 thinking / text / tool_use）
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."}]}}

// type: "user" — tool_result 回传（agent 自己处理，我们透传）
{"type":"user","message":{"role":"user","content":[{"type":"tool_result",...}]}}

// type: "result" — 最终结果
{"type":"result","subtype":"success","cost_usd":0.01,"duration_ms":5000,"result":"..."}

// type: "control_request" — 请求用户审批 tool use
{"type":"control_request","id":"...","tool":"Write","input":{...}}
```

### Cursor Agent stream-json 消息格式
```jsonc
{"type":"system","model":"claude-sonnet-4-6"}
{"type":"assistant","text_delta":"...","timestamp_ms":12345}
{"type":"tool_call","tool":"Read","state":"started"}
{"type":"tool_call","tool":"Read","state":"completed","result":"..."}
{"type":"result","duration_ms":5000}
```

### OpenCode JSON 事件格式
```jsonc
{"event":"message","role":"assistant","content":"..."}
{"event":"tool_use","tool":"Read","input":{...}}
{"event":"tool_result","tool":"Read","output":"..."}
{"event":"complete","status":"success"}
```

## Coexistence Strategy（方案 B — 适配层共存）

> **核心原则**: PipeAdapter 基于新增的 StdioSessionManager，不修改现有 AgentRuntime trait。Claude Code 的 Pipe 通信通过新路径 `pipe_execute` → `StdioSessionManager` 实现，与现有 `runtime_execute` → `ClaudeCodeRuntime` 完全隔离。

### 与现有 ClaudeCodeRuntime 的关系

```
现有 Claude Code 执行路径（不动）:
  useAgentStream.ts → invoke('runtime_execute') → ClaudeCodeRuntime.execute()
  → 自己 spawn "claude" 进程 → 解析 stdout → mpsc::Sender → agent://chunk

新 Pipe 执行路径（本 feature）:
  useStdioAgent.ts → invoke('pipe_execute') → PipeAdapter.execute()
  → StdioSessionManager.spawn() → 写 stdin → 读 stdout NDJSON → agent://message
```

**关键区别**:
- 现有路径: `Stdio::null()` (stdin 关闭), 单向 stdout 读取, `agent://chunk` 事件
- 新路径: `Stdio::piped()` (stdin 可写), 双向通信, `agent://message` 事件
- 两条路径独立运行，同一种 agent（如 Claude Code）可同时走两条路径

### 共存规则

1. **ClaudeCodeRuntime 不修改** — 现有的 `execute()` 方法继续用自己的 spawn 逻辑
2. **pipe_execute 是新增 command** — 不覆盖 `runtime_execute`
3. **PipeAdapter 使用 StdioSessionManager** — 不直接 spawn 进程，通过 stdio-core 的抽象层
4. **agent://message 事件与 agent://chunk 隔离** — 前端通过不同 hook 消费
5. **前端 useAgentStream.ts 不修改** — 新增 `executePipeAgent()` 在 useStdioAgent.ts 中
6. **CodexRuntime 不受影响** — 现有 CodexRuntime（非 ACP）继续通过 runtime_execute 工作

## Technical Solution

### Rust PipeAdapter 实现

```rust
/// Pipe 协议适配器
struct PipeAdapter {
    session_manager: Arc<StdioSessionManager>,
}

impl PipeAdapter {
    /// 执行 pipe 模式任务
    /// 1. spawn agent 子进程
    /// 2. 写入 prompt JSON 到 stdin
    /// 3. 关闭 stdin（pipe 模式信号）
    /// 4. 轮询 stdout NDJSON 行
    /// 5. 按行解析并 emit 到前端
    async fn execute(&self, config: AgentConfig, prompt: String) -> Result<PipeSession, String>
}

/// 构造各 agent 的 stdin 输入
fn build_prompt_input(backend: &AgentBackend, prompt: &str) -> String {
    match backend {
        AgentBackend::ClaudeCode => serde_json::json!({
            "type": "user",
            "message": {
                "role": "user",
                "content": [{"type": "text", "text": prompt}]
            }
        }).to_string(),
        AgentBackend::CursorAgent => prompt.to_string(),
        AgentBackend::OpenCode => prompt.to_string(),
    }
}

/// 解析 NDJSON 行，统一为 AgentMessage
fn parse_pipe_line(backend: &AgentBackend, line: &str) -> Option<AgentMessage> {
    let json: Value = serde_json::from_str(line).ok()?;
    match backend {
        AgentBackend::ClaudeCode => parse_claude_message(json),
        AgentBackend::CursorAgent => parse_cursor_message(json),
        AgentBackend::OpenCode => parse_opencode_message(json),
    }
}
```

### Agent 配置表（Rust 或 YAML）

```yaml
# agent-configs 内置或从配置文件加载
pipe_agents:
  claude-code:
    binary: "claude"
    args: ["-p", "--output-format", "stream-json", "--input-format", "stream-json",
           "--verbose", "--strict-mcp-config", "--permission-mode", "bypassPermissions"]
    protocol: pipe
  cursor-agent:
    binary: "agent"
    args: ["-p", "--output-format", "stream-json"]
    protocol: pipe
  opencode:
    binary: "opencode"
    args: ["run", "--format", "json"]
    protocol: pipe
```

### Tauri IPC Commands（Pipe 专用）

```rust
#[tauri::command]
async fn pipe_execute(
    agent_type: String,
    prompt: String,
    working_dir: String,
    timeout: Option<u64>,
    model: Option<String>,
    resume_session: Option<String>,  // Claude Code --resume
) -> Result<PipeSession, String>
```

### 前端调用流程

```typescript
// useAgentStream.ts 扩展
const executePipeAgent = async (agent: string, prompt: string) => {
  const session = await invoke('pipe_execute', {
    agentType: agent,
    prompt,
    workingDir: '/path/to/project',
  });

  // 监听统一消息事件
  listen('agent://message', (event) => {
    const msg = event.payload as AgentMessage;
    // 渲染到 RuntimeOutputModal
  });
};
```

## Acceptance Criteria (Gherkin)

### User Story
作为用户，我希望通过 IDE 的任务面板直接给 Claude Code / Cursor Agent 下发任务，并实时看到 agent 的流式响应和工具调用过程。

### Scenarios

#### Scenario 1: Claude Code Pipe 执行
```gherkin
Given IDE 中选择了 Claude Code agent
And 工作区目录为 /path/to/project
When 用户输入 "重构 error handler" 并执行
Then Rust 后端 spawn "claude -p --output-format stream-json --verbose ..." 子进程
And stdin 写入 {"type":"user","message":{"role":"user","content":[{"type":"text","text":"重构 error handler"}]}}
And stdin 关闭
And 前端实时收到 assistant 文本、tool_use、tool_result 消息
And 进程退出后前端收到 result 消息，显示执行结果
```

#### Scenario 2: Claude Code 工具审批自动通过
```gherkin
Given Claude Code pipe 模式正在执行
When Claude Code 发出 control_request（请求使用 Write 工具）
And 配置为 bypassPermissions 模式
Then 后端自动回复 control_response，behavior: "allow"
And agent 继续执行，无需用户手动审批
```

#### Scenario 3: Cursor Agent 执行
```gherkin
Given IDE 中选择了 Cursor Agent
When 用户输入任务并执行
Then Rust 后端 spawn "agent -p --output-format stream-json" 子进程
And 前端收到 system、assistant、tool_call、result 消息
```

#### Scenario 4: 执行超时
```gherkin
Given Claude Code 配置了 300 秒超时
When agent 执行超过 300 秒
Then 后端 kill 子进程
And 前端显示超时错误
```

#### Scenario 5: 与现有 runtime_execute 共存
```gherkin
Given 用户通过 runtime_execute 正在使用 ClaudeCodeRuntime 执行任务 A
When 用户同时通过 pipe_execute 启动 Claude Code Pipe 执行任务 B
Then 两个任务各自独立运行
And 任务 A 的事件通过 agent://chunk 到达 useAgentStream
And 任务 B 的事件通过 agent://message 到达 useStdioAgent
And 两者的进程、session、消息流完全隔离
```

### General Checklist
- [x] PipeAdapter 实现完整的 NDJSON 读写循环（基于 StdioSessionManager）
- [x] 支持 Claude Code、Cursor Agent、OpenCode 三种消息格式解析
- [x] Claude Code control_request 自动审批
- [x] 前端 RuntimeOutputModal 能渲染 pipe adapter 消息
- [x] pipe_execute command 与现有 runtime_execute 并行注册，互不影响
- [x] agent://message 事件格式独立于 agent://chunk
- [x] 现有 ClaudeCodeRuntime、CodexRuntime 执行链路零影响（回归验证）

## Merge Record

- **Completed**: 2026-04-30
- **Merged Branch**: feature/agent-pipe-adapter
- **Merge Commit**: b4b63a4
- **Archive Tag**: feat-agent-pipe-adapter-20260430
- **Conflicts**: none
- **Verification**: passed (5/5 Gherkin scenarios, 0 Rust compilation errors)
- **Stats**: 1 commit, 2 files changed, 886 insertions, 4 deletions

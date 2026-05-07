# Feature: feat-agent-tool-exec PM Agent 工具执行循环

## Basic Information
- **ID**: feat-agent-tool-exec
- **Name**: PM Agent 工具执行循环
- **Priority**: 90
- **Size**: L
- **Dependencies**: feat-agent-runtime-core
- **Parent**: feat-agent-tool-loop
- **Children**: []
- **Created**: 2026-05-06

## Description

恢复 PM Agent 的工具执行能力。在通讯改造（迁移到 `runtime_execute`）中丢失了工具执行循环。当前 LLM 响应中的 `<write_to_file>` 等 XML 工具调用无法被解析和执行。

核心实现：在 `HttpProviderRuntime::execute()` 中添加 agentic loop —— 发送 API 请求 → 流式返回 → 解析工具调用 XML → 执行文件操作 → 将结果回传 LLM → LLM 继续生成，直到没有更多工具调用。

## User Value Points

### VP1: 文件写入能力
PM Agent 可以通过 `<write_to_file>` 工具调用将生成的内容（如 project-context.md、feature spec 等）直接写入 workspace，用户无需手动复制。

### VP2: 文件读取与目录浏览
PM Agent 可以通过 `<read_file>` 和 `<list_files>` 工具了解项目现状，做出更准确的分析和建议。

### VP3: 多轮工具调用
支持 LLM 在一次对话中多次调用工具（如先 list_files → read_file → write_to_file），完成复杂的文件操作任务。

## Context Analysis

### Reference Code
- `src-tauri/src/lib.rs` — `HttpProviderRuntime::execute()` (当前实现，需改造)
- `src-tauri/src/lib.rs` — `GeminiHttpRuntime::execute()` (参考实现)
- `src-tauri/src/lib.rs` — `StreamEvent` struct (已有 tool_use/tool_result 事件类型定义)
- `src-tauri/src/lib.rs` — `runtime_execute` command (事件转发层)

### Related Documents
- Plan: `/Users/ryan/.claude/plans/joyful-doodling-puzzle.md`

### Related Features
- feat-agent-runtime-core (AgentRuntime trait 定义)
- feat-agent-gemini-bridge (通讯改造，导致能力退化的提交)

## Technical Solution

### 修改 `HttpProviderRuntime::execute()` 核心循环

```
fn execute(&self, params) -> Receiver<StreamEvent> {
    spawn thread {
        let mut messages = build_initial_messages(params);

        loop {
            // 1. 发送 API 请求，流式返回
            let response_text = stream_api_request(&client, &api_url, &messages, &tx);

            // 2. 解析工具调用 XML
            let tool_calls = parse_tool_calls(&response_text);

            // 3. 无工具调用 → 发 is_done，退出
            if tool_calls.is_empty() {
                tx.send(is_done);
                break;
            }

            // 4. 执行每个工具调用
            let mut tool_results = vec![];
            for tool in tool_calls {
                tx.send(tool_use event);
                let result = execute_tool(&tool, &workspace);
                tx.send(tool_result event);
                tool_results.push(result);
            }

            // 5. 追加 assistant message + tool results 到 messages
            messages.push(assistant_msg_with_tools(&response_text, &tool_calls));
            messages.push(tool_results_msg(&tool_results));

            // 6. 继续循环
        }
    }
}
```

### XML 工具调用格式

```xml
<write_to_file path="relative/path/to/file">
file content here
</write_to_file>

<read_file path="relative/path/to/file" />

<list_files path="relative/path" />
```

### 工具执行

- `write_to_file`: `fs::write({workspace}/{path}, content)` — 需验证路径在 workspace 内
- `read_file`: `fs::read_to_string({workspace}/{path})` — 需验证路径在 workspace 内
- `list_files`: `fs::read_dir({workspace}/{path})` — 返回文件/目录列表

### 安全约束
- 所有文件操作必须限制在 workspace 目录内（防止路径遍历攻击）
- 路径规范化后检查 `starts_with(workspace)`

## Acceptance Criteria (Gherkin)

### Scenario 1: PM Agent 写入 project-context.md
```gherkin
Given workspace 已加载且 settings 配置了 zai provider
And PM Agent 对话窗口已打开
When 用户发送 "帮我生成 project-context.md"
And PM Agent 响应中包含 <write_to_file path="project-context.md">...</write_to_file>
Then app 解析 XML 工具调用
And 在 workspace 目录下创建 project-context.md 文件
And 前端显示工具执行状态和结果
And PM Agent 继续生成后续内容
```

### Scenario 2: 多轮工具调用
```gherkin
Given PM Agent 需要先了解项目结构再生成文档
When PM Agent 首先调用 <list_files path="src" />
And 获得文件列表后调用 <read_file path="package.json" />
And 最后调用 <write_to_file path="project-context.md">...</write_to_file>
Then 每轮工具调用都被正确执行
And 工具结果被回传给 LLM
And 最终生成完整的 project-context.md
```

### Scenario 3: 路径安全检查
```gherkin
Given 恶意 LLM 试图写入 workspace 外的文件
When 工具调用路径为 "../../etc/passwd"
Then 工具执行被拒绝
And 错误信息被回传给 LLM
```

### Scenario 4: 无工具调用的正常对话
```gherkin
Given 用户发送简单的问答消息
When PM Agent 响应中不包含任何工具调用 XML
Then 响应正常流式显示
And 不触发工具执行循环
```

### General Checklist
- [x] 路径安全验证（workspace 内限制）
- [x] 错误处理（文件不存在、权限不足等）
- [x] 工具执行超时保护
- [x] OpenAI API 格式支持工具循环（Anthropic 待后续需求）

## Merge Record
- **Completed**: 2026-05-06
- **Merged Branch**: feature/feat-agent-tool-exec
- **Merge Commit**: 301f8c5
- **Feature Commit**: a47b83c
- **Archive Tag**: feat-agent-tool-exec-20260506
- **Conflicts**: none
- **Verification**: passed (14/14 tasks, 7/7 tests, 4/4 scenarios)
- **Files Changed**: 2 (lib.rs, useAgentStream.ts)

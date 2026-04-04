# Feature: feat-agent-gemini-bridge GeminiHttpRuntime 实现

## Basic Information
- **ID**: feat-agent-gemini-bridge
- **Name**: GeminiHttpRuntime 实现 + PM Agent 迁移
- **Priority**: 60
- **Size**: M
- **Dependencies**: [feat-agent-runtime-execute]
- **Parent**: feat-agent-unified-exec
- **Children**: []
- **Created**: 2026-04-04

## Description
创建 `GeminiHttpRuntime` 实现 `AgentRuntime` 的 `execute()` 方法，将 PM Agent 的 `agent_chat_stream` 从独立 HTTP 调用迁移到 Runtime 执行层。

## User Value Points
1. **PM Agent 统一** — PM Agent 也走 AgentRuntime.execute()，与 REQ Agent 共享同一通信管道
2. **认证统一** — API Key 通过 Runtime 管理，不再有独立的 keyring 逻辑

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src-tauri/src/lib.rs:2846-2980` — PM Agent 当前 HTTP SSE 实现
- `neuro-syntax-ide/src-tauri/src/lib.rs:2984-3020` — API key 管理
- `neuro-syntax-ide/src/lib/useAgentChat.ts` — PM Agent 前端 hook
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — PM Agent UI

### Related Features
- feat-agent-runtime-execute — 提供 execute() trait
- feat-settings-llm-config — API Key 配置

## Technical Solution

### GeminiHttpRuntime 实现

```rust
struct GeminiHttpRuntime {
    model: String,
}

impl AgentRuntime for GeminiHttpRuntime {
    fn execute(&self, params: ExecuteParams) -> Result<Receiver<StreamEvent>, String> {
        let api_key = get_api_key_inner()?;
        let (tx, rx) = std::sync::mpsc::channel();

        // Spawn async task for HTTP streaming
        let model = self.model.clone();
        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();

            rt.block_on(async {
                let client = reqwest::Client::new();
                let body = build_gemini_request(&model, &params);
                let response = client.post(GEMINI_URL)
                    .bearer_auth(&api_key)
                    .json(&body)
                    .send()
                    .await;

                match response {
                    Ok(resp) => {
                        let mut stream = resp.bytes_stream();
                        while let Some(chunk) = stream.next().await {
                            // Parse SSE, send StreamEvent via tx
                        }
                    }
                    Err(e) => {
                        let _ = tx.send(StreamEvent::error(e.to_string()));
                    }
                }
            });
        });

        Ok(rx)
    }
}
```

### PM Agent 前端迁移
`useAgentChat.ts` 改为调用 `runtime_execute` 替代 `agent_chat_stream`，事件监听改为 `agent://chunk`。

## Acceptance Criteria (Gherkin)

```gherkin
Scenario: PM Agent 正常流式响应
  Given 用户已配置 Gemini API Key
  When 用户发送消息给 PM Agent
  Then 应收到流式响应
  And 行为与迁移前完全一致

Scenario: API Key 未配置
  Given 用户未配置 API Key
  When 用户尝试发送消息
  Then 应显示 "API Key 未配置" 提示

Scenario: Runtime 自动选择
  Given 用户在 Agent Config 中选择 "route" 模式
  When 用户发送需求分析任务
  Then Router 应自动选择 GeminiHttpRuntime
```

### General Checklist
- [x] GeminiHttpRuntime 实现完成
- [x] PM Agent 改用 runtime_execute
- [x] API Key 管理保持兼容
- [x] 前端 hook 事件监听迁移
- [x] 功能与迁移前一致

## Merge Record
- **Completed**: 2026-04-05
- **Merged Branch**: feature/feat-agent-gemini-bridge
- **Merge Commit**: d6d9148
- **Archive Tag**: feat-agent-gemini-bridge-20260405
- **Conflicts**: None
- **Verification**: passed (code analysis, cargo check clean, tsc clean)
- **Evidence**: evidence/verification-report.md
- **Development Stats**: 1 commit, 2 files changed (+356/-46 lines)

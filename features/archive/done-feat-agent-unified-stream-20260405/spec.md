# Feature: feat-agent-unified-stream 统一事件格式

## Basic Information
- **ID**: feat-agent-unified-stream
- **Name**: 统一事件格式 + 前端 Hook 合并
- **Priority**: 50
- **Size**: S
- **Dependencies**: [feat-agent-gemini-bridge]
- **Parent**: feat-agent-unified-exec
- **Children**: []
- **Created**: 2026-04-04

## Description
统一所有 Agent 的事件格式为 `agent://chunk`，合并 `useAgentChat` 和 `useReqAgentChat` 为统一的 `useAgentStream` hook。

## User Value Points
1. **统一事件** — 所有 Agent 使用同一个事件格式，消除 `pm_agent_chunk` / `req_agent_chunk` 的分裂
2. **Hook 复用** — 前端统一 hook 减少重复代码，新增 Agent 只需配置 runtime_id

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/lib/useAgentChat.ts` — PM Agent hook
- `neuro-syntax-ide/src/lib/useReqAgentChat.ts` — REQ Agent hook
- `neuro-syntax-ide/src/components/views/ProjectView.tsx` — 两个 hook 的使用方

### Related Features
- feat-agent-runtime-execute — 统一 execute()
- feat-agent-gemini-bridge — PM Agent 迁移

## Technical Solution

### 统一 Hook: useAgentStream

```typescript
interface UseAgentStreamOptions {
  runtimeId: string;          // 'claude-code' | 'gemini-http'
  systemPrompt?: string;
  greetingMessage?: string;
}

function useAgentStream(options: UseAgentStreamOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ...

  const sendMessage = async (input: string) => {
    // 统一调用 runtime_execute
    await invoke('runtime_execute', {
      runtimeId: options.runtimeId,
      message: input,
      sessionId: sessionId,
      systemPrompt: options.systemPrompt,
    });
  };

  // 统一监听 agent://chunk
  useEffect(() => {
    const unlisten = listen<StreamEvent>('agent://chunk', (event) => {
      // 统一处理流式响应
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  return { messages, isStreaming, error, sendMessage, ... };
}
```

### ProjectView 使用
```typescript
// 替代 useAgentChat() 和 useReqAgentChat()
const pmAgent = useAgentStream({
  runtimeId: 'gemini-http',
  systemPrompt: PM_SYSTEM_PROMPT,
  greetingMessage: "Hello! I'm your PM Agent...",
});

const reqAgent = useAgentStream({
  runtimeId: 'claude-code',
  systemPrompt: REQ_AGENT_SYSTEM_PROMPT,
  greetingMessage: "你好！我是需求分析 Agent...",
});
```

## Acceptance Criteria (Gherkin)

```gherkin
Scenario: 统一 Hook 处理 PM Agent
  Given 用户在 PM Agent tab 发送消息
  When useAgentStream({ runtimeId: 'gemini-http' }) 处理响应
  Then 应正确显示流式响应

Scenario: 统一 Hook 处理 REQ Agent
  Given 用户在 REQ Agent tab 发送消息
  When useAgentStream({ runtimeId: 'claude-code' }) 处理响应
  Then 应正确显示流式响应

Scenario: 新增 Agent 只需配置 runtimeId
  Given 系统新增了 CodexRuntime
  When 开发者创建 useAgentStream({ runtimeId: 'codex' })
  Then 无需修改任何底层通信逻辑
```

### General Checklist
- [x] useAgentStream hook 实现
- [x] ProjectView 迁移到 useAgentStream
- [ ] 旧 hook (useAgentChat, useReqAgentChat) 可安全删除
- [x] agent://chunk 事件格式文档化

## Merge Record
- **Completed:** 2026-04-05T19:00:00Z
- **Merged Branch:** feature/feat-agent-unified-stream
- **Merge Commit:** 1c688f7
- **Archive Tag:** feat-agent-unified-stream-20260405
- **Conflicts:** None
- **Verification:** All 3 Gherkin scenarios passed (code analysis)
- **Files Changed:** 2 (1 new, 1 modified)
- **Duration:** ~1 hour

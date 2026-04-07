# Feature: feat-new-task-runtime-execute New Task Runtime 直接执行

## Basic Information
- **ID**: feat-new-task-runtime-execute
- **Name**: New Task Runtime 直接执行（对齐 REQ Agent 方案）
- **Priority**: 85
- **Size**: M
- **Dependencies**: feat-dispatch-runtime-graceful
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-07

## Description

New Task Modal 选择 Claude Code 作为 Agent 时，当前依赖不存在的 `dispatch_to_runtime` command，导致只能降级到 PM Agent。

**目标**：将 New Task Modal 的外部 runtime 路径从 `dispatch_to_runtime` 切换为与 REQ Agent 一致的方案：
- `runtime_session_start` 建立会话
- `runtime_execute` 发送 `/new-feature <requirement>` 消息
- `agent://chunk` 接收流式响应
- `fs://workspace-changed` 监听 feature 创建事件

这样 Claude Code runtime 会直接执行 `/new-feature` skill，在文件系统中创建 feature 文档，与 REQ Agent 的执行模型完全一致。

## User Value Points

1. **Claude Code 可用性恢复** — 选择 Claude Code 后能真正通过 runtime 执行 /new-feature，不再降级
2. **统一 Runtime 执行模型** — New Task 和 REQ Agent 使用同一套 session + execute + chunk 模式

## Context Analysis

### Reference Code

**REQ Agent 模式**（`useReqAgentChat.ts`）：
```
1. runtime_session_start({ runtimeId: 'claude-code' })
2. listen('agent://chunk', handler) — 持久化监听
3. runtime_execute({ runtimeId, message, sessionId, systemPrompt })
4. listen('fs://workspace-changed', handler) — 检测 feature 创建
```

**当前 New Task 模式**（`NewTaskModal.tsx`）：
```
1. listen('runtime_dispatch_chunk', handler)
2. invoke('dispatch_to_runtime', { runtimeId, skill: '/new-feature', args })
→ 失败后降级到 PM Agent
```

### Related Documents
- `useReqAgentChat.ts` — REQ Agent 的完整 session 管理 + streaming 实现
- `useAgentStream.ts` — 更通用的 agent stream hook（也支持 session 模式）
- `NewTaskModal.tsx` — 需要修改的组件
- `utils.ts` — `isDispatchCommandAvailable` 等需要清理的函数

### Related Features
- `feat-dispatch-runtime-graceful` — 添加了降级逻辑，本次需要替换而非降级

## Technical Solution

### 核心变更

**1. NewTaskModal.tsx — 外部 runtime 执行路径重写**

将 `handleExecute` 中外部 runtime 分支（`dispatch_to_runtime`）替换为：

```typescript
// 使用 useReqAgentChat 相同模式
const { invoke } = await import('@tauri-apps/api/core');
const { listen } = await import('@tauri-apps/api/event');

// 1. 注册 agent://chunk 监听器
const unlisten = await listen<AgentStreamEvent>('agent://chunk', (event) => {
  const chunk = event.payload;
  if (chunk.error && chunk.type !== 'stderr') {
    setExecError(chunk.error);
    return;
  }
  if (chunk.text && (chunk.type === 'assistant' || chunk.type === 'system' || chunk.type === 'raw' || !chunk.type)) {
    streamingRef.current += chunk.text;
    setStreamingOutput(streamingRef.current);
  }
  if (chunk.is_done) {
    unlisten();
    setPreviewContent(streamingRef.current);
    // 不标记 featureCreated — 等待 fs://workspace-changed 事件
  }
});

// 2. 启动 session（如需要）
await invoke('runtime_session_start', { runtimeId: 'claude-code' });

// 3. 发送 /new-feature 消息
await invoke('runtime_execute', {
  runtimeId: 'claude-code',
  message: `/new-feature ${requirementText.trim()}`,
  sessionId: null,
  systemPrompt: null,
});
```

**2. 添加 fs://workspace-changed 监听**

在组件中添加 feature 创建事件监听（同 REQ Agent 模式）：

```typescript
useEffect(() => {
  if (!isTauri) return;
  let unlisten: (() => void) | null = null;
  (async () => {
    const { listen } = await import('@tauri-apps/api/event');
    unlisten = await listen('fs://workspace-changed', (event) => {
      const change = event.payload;
      if (change.kind === 'agent-feature-created') {
        for (const p of change.paths) {
          const match = p.match(/features\/pending-([^/]+)/);
          if (match) {
            setFeatureCreated(true);
            setCreatedFeatureId(match[1]);
            break;
          }
        }
      }
    });
  })();
  return () => { unlisten?.(); };
}, []);
```

**3. 移除 dispatch_to_runtime 相关代码**

- 删除 `dispatchCommandAvailable` state 和 `isDispatchCommandAvailable()` 检查
- 删除 `isCommandNotFoundError` 降级逻辑
- 简化 `isAgentDisabled` — 仅基于 runtime status（`not-installed`）
- 清理 `utils.ts` 中的 `isDispatchCommandAvailable`、`isCommandNotFoundError`、`resetDispatchAvailabilityCache`

**4. Agent 选择 UI 更新**

- 移除 "Backend command not ready" tooltip 和警告
- Claude Code 仅在 runtime status 为 `not-installed` 时禁用

### 不修改的部分

- PM Agent 内置路径保持不变（`generateFeaturePlan` + `createFeature`）
- Modal 的 UI 布局和交互流程不变
- 拖拽/resize 功能不变

## Acceptance Criteria (Gherkin)

### User Story
As a user, I want to select Claude Code as the agent in New Task Modal so that it directly uses the runtime to execute /new-feature and create feature documents.

### Scenarios

#### Scenario 1: Claude Code 执行 /new-feature 成功
```gherkin
Given the user opens New Task Modal
And Claude Code runtime status is "available"
When the user selects "Claude Code" agent
And enters a feature requirement
And clicks "Create Feature"
Then the modal should use runtime_session_start to establish a session
And send "/new-feature <requirement>" via runtime_execute
And display streaming output from agent://chunk events
And detect feature creation via fs://workspace-changed
And show "Feature created successfully!"
```

#### Scenario 2: Claude Code runtime 未安装
```gherkin
Given the user opens New Task Modal
And Claude Code runtime status is "not-installed"
When the user sees the agent selection list
Then Claude Code option should be disabled
And show "Install" hint
```

#### Scenario 3: Claude Code 执行出错
```gherkin
Given the user selects Claude Code and submits a requirement
When runtime_execute returns an error
Then the modal should display the error message
And show a "Retry" button
And NOT fall back to PM Agent
```

#### Scenario 4: PM Agent 内置路径不受影响
```gherkin
Given the user selects "PM Agent"
When the user enters a requirement and clicks "Create Feature"
Then the existing generateFeaturePlan + createFeature flow should work unchanged
```

### UI/Interaction Checkpoints
- Agent selection: Claude Code 不再有 "Backend command not ready" 警告
- Executing step: 流式输出通过 agent://chunk 实时更新
- Result: feature 创建通过 fs://workspace-changed 检测

### General Checklist
- [ ] dispatch_to_runtime 相关代码完全移除
- [ ] utils.ts 中的 dispatch 工具函数清理
- [ ] 与 REQ Agent 执行模型一致（session + execute + chunk）
- [ ] fs://workspace-changed 事件监听正确
- [ ] PM Agent 路径不受影响

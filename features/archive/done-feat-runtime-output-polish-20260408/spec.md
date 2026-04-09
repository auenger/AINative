# Feature: feat-runtime-output-polish Runtime Session Output 弹窗与渲染优化

## Basic Information
- **ID**: feat-runtime-output-polish
- **Name**: Runtime Session Output 弹窗与渲染优化
- **Priority**: 75
- **Size**: M
- **Dependencies**: feat-runtime-session-output (completed)
- **Parent**: null
- **Children**: none
- **Created**: 2026-04-08T20:00:00Z

## Description

现有的 RuntimeOutputModal 存在四个问题需要优化：
1. 弹窗不支持拖拽位置和缩放大小，与 NewTaskModal 行为不一致
2. 内容渲染过于原始 — 直接显示 Claude Code session 的 raw JSON 输出（如 `{"TOOL_USE_ID":"CALL_EB9CCDEB...","TYPE":"TOOL_RESULT","CONTENT":"THE FILE ... HAS BEEN UPDATED"}`），可读性差
3. 关闭弹窗后所有 chunks 被清空，重新打开需要重新加载
4. 多个 runtime（如 claude-code、codex）各自有独立 session，但 "View Output" 只硬编码了 `rt.id === 'claude-code'`，无法查看其他 runtime 的输出

## User Value Points

### VP1: 弹窗拖拽与缩放（交互一致性）
- 弹窗 header 区域可拖拽移动位置
- 弹窗右下角 / 四边可拖拽缩放大小
- 行为与 NewTaskModal 保持一致（复用相同的拖拽实现模式）
- 位置和大小有合理边界限制

### VP2: Session 输出内容智能渲染（可读性）
- 解析 Claude Code session 的 JSON 格式输出，提取关键字段
- 根据 `TYPE` 字段区分渲染样式：
  - `TOOL_RESULT`: 显示操作结果（如文件创建、更新成功）
  - `assistant`: 显示 AI 回复文本，支持 markdown 渲染
  - `tool_use`: 显示工具调用名称和参数摘要
  - `system`: 显示系统消息
  - `raw` / 未知: 保留原始文本显示
- 对于 `TOOL_RESULT` 类型，提取并高亮显示 `CONTENT` 字段内容
- 时间戳格式化为可读时间
- 折叠长输出，点击展开详情

### VP3: 多 Runtime Session 分离查看
- 后端 `session_output` 已支持多 session（HashMap），但 `active_session_id` 只记录一个
- 改为 `active_sessions: HashMap<RuntimeId, SessionId>` 支持每个 runtime 独立追踪
- `get_active_session` 接受 `runtime_id` 参数，返回对应 runtime 的 session 输出
- StatusBar 每个 runtime card 都能显示 "View Output"（不再限制 `rt.id === 'claude-code'`）
- RuntimeOutputModal 接受 `runtimeId` prop，header 显示对应 runtime 名称
- `clear_session_output` 接受 `runtime_id` 参数，仅清理指定 runtime 的 buffer

### VP4: 弹窗关闭/重开内容保留
- 关闭弹窗时不清空 chunks（移除 `useEffect` 里的 `setChunks([])` 清空逻辑）
- 重新打开时直接显示已有内容 + 继续接收新 chunk
- 仅 "Clear" 按钮才真正清理 buffer 和 chunks
- 弹窗状态（位置、大小）在会话内保持

## Context Analysis

### Reference Code
- `neuro-syntax-ide/src/components/RuntimeOutputModal.tsx` — 当前弹窗实现（需修改）
- `neuro-syntax-ide/src/components/views/NewTaskModal.tsx:106-141` — 拖拽实现参考（modalPos, isDraggingModal, dragOffset 模式）
- `neuro-syntax-ide/src/components/StatusBar.tsx` — StatusBar 集成入口
- `neuro-syntax-ide/src/types.ts` — ActiveSessionInfo 类型

### Related Documents
- `features/archive/done-feat-runtime-session-output-20260408/spec.md` — 原 feature spec

### Related Features
- feat-runtime-session-output (completed) — 基础 session 输出能力
- feat-modal-drag-resize (completed) — NewTaskModal 拖拽缩放参考

## Technical Solution

### 1. 拖拽与缩放

复用 NewTaskModal 的模式：
```typescript
const [modalPos, setModalPos] = useState({ x: 0, y: 0 });
const [isDraggingModal, setIsDraggingModal] = useState(false);
const dragOffset = useRef({ x: 0, y: 0 });

// onMouseDown (header) -> start drag
// onMouseMove (window) -> update position with boundary clamp
// onMouseUp -> stop drag
// CSS: resize: 'both' on modal container
```

### 2. 内容渲染

新增 `renderSessionChunk()` 函数，尝试 JSON 解析 chunk.text：
- 如果是有效 JSON 且包含 `TYPE` 字段 -> 按类型渲染
  - `TOOL_RESULT`: 显示操作结果（绿色高亮）
  - `tool_use`: 显示工具名称 + 参数摘要
  - 其他: 按原逻辑显示
- 如果不是 JSON -> 保持原有渲染
- 时间戳从 `TIMESTAMP` 字段提取并格式化

### 3. 多 Runtime Session 分离

**后端改动 (lib.rs):**

```rust
// 改 active_session_id 为 per-runtime 追踪
// 旧: active_session_id: Mutex<Option<String>>
// 新: active_sessions: Mutex<HashMap<String, String>>  // runtime_id -> session_id
```

- `runtime_session_start`: 用 runtime_id 作为 key 写入 active_sessions
- `runtime_execute`: 从 active_sessions 获取对应 session_id 写入 buffer
- `get_active_session(runtime_id: String)`: 按 runtime_id 查找对应 session
- `clear_session_output(runtime_id: String)`: 按 runtime_id 清理对应 session

**前端改动:**
- StatusBar: 每个 runtime card 都检查是否有 active session，显示 "View Output"
- RuntimeOutputModal: 新增 `runtimeId` + `runtimeName` props
- RuntimeOutputModal: `invoke('get_active_session', { runtimeId })` 获取对应输出

### 4. 关闭/重开行为

- 移除 `useEffect([visible])` 中的 chunks/sessionInfo 重置逻辑（改为按 runtimeId 追踪多个 session state）
- 弹窗关闭时仅停止 UI 渲染（AnimatePresence 隐藏），保留 React state
- "Clear" 按钮同时调用后端 `clear_session_output` + 重置前端 state
- 弹窗位置/大小在组件生命周期内保持（不随 visible 变化重置）

## Acceptance Criteria (Gherkin)

### User Story
作为 IDE 用户，我希望 Runtime Output 弹窗能拖拽移动和缩放，内容以可读的方式渲染，
并且关闭弹窗后重新打开时能看到之前的内容。

### Scenarios (Given/When/Then)

#### Scenario 1: 弹窗拖拽移动
```gherkin
Given RuntimeOutputModal 已打开
When 用户在 header 区域按住鼠标并拖拽
Then 弹窗跟随鼠标移动
And 弹窗不会被拖出屏幕边界
```

#### Scenario 2: 弹窗缩放大小
```gherkin
Given RuntimeOutputModal 已打开
When 用户拖拽弹窗右下角或边缘
Then 弹窗大小随之变化
And 最小尺寸不低于 400x300
```

#### Scenario 3: JSON 内容智能渲染
```gherkin
Given RuntimeOutputModal 显示包含 JSON 格式的 chunk
When chunk 包含 TYPE=TOOL_RESULT 字段
Then 渲染为可读的操作结果（如 "File updated: vite.config.ts"）
And CONTENT 字段内容被高亮显示
```

#### Scenario 4: 关闭后重新打开保留内容
```gherkin
Given RuntimeOutputModal 正在显示 session 输出
When 用户关闭弹窗（点击 X 或点击背景）
And 再次从 StatusBar 打开 RuntimeOutputModal
Then 之前显示的内容仍然存在
And 弹窗继续接收新的 chunk 输出
```

#### Scenario 5: 多 Runtime 各自查看输出
```gherkin
Given Claude Code 和 Codex 两个 runtime 都有活跃 session
When 用户在 StatusBar 展开运行时面板
Then Claude Code card 显示 "View Output"
And Codex card 也显示 "View Output"
When 用户点击 Claude Code 的 "View Output"
Then 打开弹窗显示 Claude Code session 的输出
When 用户关闭弹窗后点击 Codex 的 "View Output"
Then 打开弹窗显示 Codex session 的输出
And 两个 runtime 的输出互不干扰
```

#### Scenario 6: Clear 清理所有内容
```gherkin
Given RuntimeOutputModal 有内容显示
When 用户点击 "Clear" 按钮
Then 后端 session buffer 被清理
And 前端显示内容被清空
And 弹窗关闭
```

### UI/Interaction Checkpoints
- Header 区域 cursor: grab / grabbing 切换
- 弹窗位置和大小在会话内持久化
- JSON 解析失败的 chunk 降级为原始文本显示
- 长输出支持折叠/展开

### General Checklist
- [ ] 拖拽实现与 NewTaskModal 一致（复用模式）
- [ ] JSON 解析有 try-catch 保护，不影响非 JSON 内容
- [ ] 关闭弹窗不清空 chunks state
- [ ] Clear 按钮同时清理前端 + 后端
- [ ] 多 runtime 各自独立的 session 追踪和输出查看
- [ ] StatusBar 每个 runtime card 都可查看输出

## Merge Record

- **Completed**: 2026-04-08T15:53:00Z
- **Merged Branch**: feature/feat-runtime-output-polish
- **Merge Commit**: 7b1e16b
- **Archive Tag**: feat-runtime-output-polish-20260408
- **Conflicts**: none
- **Verification**: all 6 Gherkin scenarios passed (code analysis)
- **Evidence**: evidence/verification-report.md
- **Stats**: 1 commit, 3 files changed (+456/-62 lines)

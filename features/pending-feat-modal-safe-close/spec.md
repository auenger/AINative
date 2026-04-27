# Feature: feat-modal-safe-close Modal 安全关闭保护

## Basic Information
- **ID**: feat-modal-safe-close
- **Name**: Modal 安全关闭保护
- **Priority**: 60
- **Size**: S
- **Dependencies**: [feat-modal-session-store]
- **Parent**: null
- **Children**: []
- **Created**: 2026-04-27

## Description
在 AI 正在交互时（streaming / executing），关闭弹窗（点击 backdrop 或关闭按钮）时弹出确认对话框，防止用户误关闭导致体验中断。确认关闭时利用 SessionStore 保存当前状态。

### 背景问题
用户在与 AI Agent 交互过程中，容易不小心点击弹窗外部区域（backdrop）或按 Esc 关闭弹窗，导致正在进行的 AI 响应中断、对话历史丢失。

## User Value Points
1. **误操作防护** — AI 正在响应时关闭弹窗需二次确认，避免无意中断

## Context Analysis
### Reference Code
- `neuro-syntax-ide/src/components/views/TaskBoard.tsx` — backdrop onClick={closeModal}（Line 783）
- `neuro-syntax-ide/src/components/views/NewTaskModal.tsx` — backdrop onClick={handleClose}（Line 603）
- `neuro-syntax-ide/src/components/views/NewTaskModal.tsx` — step === 'executing' 时取消按钮行为

### Related Features
- feat-modal-session-store（前置依赖，提供 SessionStore 用于保存关闭状态）

## Technical Solution

### 改动点
1. **TaskBoard.tsx — Feature Detail Modal**
   - backdrop `onClick` 和 Close 按钮 `onClick` 前检查 `agentSending || isStreaming` 等活跃状态
   - 活跃时显示确认弹窗（替代直接关闭）
   - 确认后调用 SessionStore.saveTaskSession() 再关闭

2. **NewTaskModal.tsx**
   - backdrop `onClick` 和 handleClose 前检查 `isStreaming || extStreaming || (step === 'executing' && !featureCreated)`
   - 活跃时显示确认弹窗
   - 确认后调用 SessionStore.saveNewTaskSession() 再关闭

3. **确认对话框组件**
   - 轻量级：直接在弹窗内渲染，不引入新组件
   - 文案："AI is responding. Close anyway? You can recover the conversation by reopening."
   - 按钮："Continue Waiting" / "Close"

### 确认对话框设计
```
┌──────────────────────────────────────────┐
│ ⚠ AI is responding                       │
│                                          │
│ Close anyway? You can recover the        │
│ conversation by reopening.               │
│                                          │
│   [Continue Waiting]    [Close]          │
└──────────────────────────────────────────┘
```

## Acceptance Criteria (Gherkin)
### User Story
As a user interacting with AI in a modal, I want to be protected from accidentally closing the modal during active AI responses, so that I don't lose my ongoing conversation.

### Scenarios

#### Scenario: Confirm before closing during streaming
```gherkin
Given the Feature Detail Modal Agent tab has active streaming (agentSending = true)
When the user clicks the backdrop
Then a confirmation dialog appears
And the modal remains open with streaming continuing
```

#### Scenario: Force close saves session
```gherkin
Given the confirmation dialog is shown
When the user clicks "Close"
Then the current state is saved to SessionStore
And the modal closes
And reopening the same feature restores the conversation
```

#### Scenario: Continue waiting dismisses confirmation
```gherkin
Given the confirmation dialog is shown
When the user clicks "Continue Waiting"
Then the confirmation dialog disappears
And the modal and streaming continue normally
```

#### Scenario: No confirmation when idle
```gherkin
Given no AI interaction is active (agentSending = false, isStreaming = false)
When the user clicks the backdrop
Then the modal closes immediately without confirmation
```

### UI/Interaction Checkpoints
- 确认对话框使用 modal 内的 overlay 层（不新开 fixed 层）
- "Continue Waiting" 为默认焦点按钮
- Esc 键在确认对话框显示时 = "Continue Waiting"（不关闭）

### General Checklist
- 不影响非活跃状态下的关闭行为
- 确认逻辑对 Feature Detail Modal 和 NewTaskModal 都生效
- 依赖 feat-modal-session-store 的 saveTaskSession / saveNewTaskSession

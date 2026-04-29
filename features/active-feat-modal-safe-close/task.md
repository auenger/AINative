# Tasks: feat-modal-safe-close

## Task Breakdown

### 1. Feature Detail Modal Protection
- [x] Add `isAgentActive` check (agentSending || streaming in progress) in TaskBoard.tsx
- [x] Intercept backdrop onClick: show confirmation if active
- [x] Intercept Close button onClick: show confirmation if active
- [x] On confirm close: call SessionStore.saveTaskSession() then closeModal()

### 2. NewTaskModal Protection
- [x] Add `isInteractionActive` check (isStreaming || extStreaming || step === 'executing')
- [x] Intercept backdrop onClick: show confirmation if active
- [x] On confirm close: call SessionStore.saveNewTaskSession() then handleClose()

### 3. Confirmation Dialog UI
- [x] Render confirmation overlay inside modal (not new fixed layer)
- [x] "Continue Waiting" (default) / "Close" buttons
- [x] Esc key maps to "Continue Waiting"
- [x] Warning icon + descriptive text

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-29 | All tasks implemented | TaskBoard + NewTaskModal safe-close with confirmation overlay |

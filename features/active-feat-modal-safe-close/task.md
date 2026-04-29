# Tasks: feat-modal-safe-close

## Task Breakdown

### 1. Feature Detail Modal Protection
- [ ] Add `isAgentActive` check (agentSending || streaming in progress) in TaskBoard.tsx
- [ ] Intercept backdrop onClick: show confirmation if active
- [ ] Intercept Close button onClick: show confirmation if active
- [ ] On confirm close: call SessionStore.saveTaskSession() then closeModal()

### 2. NewTaskModal Protection
- [ ] Add `isInteractionActive` check (isStreaming || extStreaming || step === 'executing')
- [ ] Intercept backdrop onClick: show confirmation if active
- [ ] On confirm close: call SessionStore.saveNewTaskSession() then handleClose()

### 3. Confirmation Dialog UI
- [ ] Render confirmation overlay inside modal (not new fixed layer)
- [ ] "Continue Waiting" (default) / "Close" buttons
- [ ] Esc key maps to "Continue Waiting"
- [ ] Warning icon + descriptive text

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|

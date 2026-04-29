# Tasks: feat-modal-session-store

## Task Breakdown

### 1. SessionStore Core
- [x] Add `TaskSessionState`, `NewTaskSessionState`, `SessionStoreAPI` types to `types.ts`
- [x] Create `src/lib/SessionStore.tsx` with React Context + Provider
- [x] Implement `saveTaskSession` with capacity management (20 session cap, FIFO eviction)
- [x] Implement `saveTaskSession` with agentOutput truncation (40KB limit)
- [x] Implement `saveNewTaskSession` with message truncation (200 message cap)
- [x] Implement `loadTaskSession` with 24h expiration check
- [x] Implement `loadNewTaskSession` with 24h expiration check
- [x] Implement `clearTaskSession`, `clearNewTaskSession`
- [x] Add `useSessionStore()` hook for consumer components

### 2. App Integration
- [x] Wrap `App.tsx` with `SessionStoreProvider`

### 3. Feature Detail Modal Integration
- [x] Modify `TaskBoard.tsx` closeModal: save state to SessionStore before clearing
- [x] Modify `TaskBoard.tsx` handleFeatureClick: check and load existing session
- [x] Handle stale/corrupted session: fallback to empty state, clear silently

### 4. NewTask Modal Integration
- [x] Modify `NewTaskModal.tsx` handleClose: save current step + messages to SessionStore
- [x] Modify `NewTaskModal.tsx` open handler: restore step + selectedAgent + messages
- [x] Add "Resumed session" indicator in header

### 5. Session Cleanup
- [x] Clear task session when feature moves to completed queue (in queue change handler)
- [x] Add manual "Clear session" option in modal UI

### 6. UI Indicator
- [x] Add "Resumed session" subtle indicator in Feature Detail Modal Agent tab
- [x] Add "Resumed session" subtle indicator in NewTask Modal header
- [x] Auto-dismiss after 3 seconds, manual dismiss on click

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-28 | All tasks completed | SessionStore core + App integration + TaskBoard + NewTaskModal + cleanup + UI indicators |

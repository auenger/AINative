# Tasks: feat-modal-session-store

## Task Breakdown

### 1. SessionStore Core
- [ ] Add `TaskSessionState`, `NewTaskSessionState`, `SessionStoreAPI` types to `types.ts`
- [ ] Create `src/lib/SessionStore.tsx` with React Context + Provider
- [ ] Implement `saveTaskSession` with capacity management (20 session cap, FIFO eviction)
- [ ] Implement `saveTaskSession` with agentOutput truncation (40KB limit)
- [ ] Implement `saveNewTaskSession` with message truncation (200 message cap)
- [ ] Implement `loadTaskSession` with 24h expiration check
- [ ] Implement `loadNewTaskSession` with 24h expiration check
- [ ] Implement `clearTaskSession`, `clearNewTaskSession`
- [ ] Add `useSessionStore()` hook for consumer components

### 2. App Integration
- [ ] Wrap `App.tsx` with `SessionStoreProvider`

### 3. Feature Detail Modal Integration
- [ ] Modify `TaskBoard.tsx` closeModal: save state to SessionStore before clearing
- [ ] Modify `TaskBoard.tsx` handleFeatureClick: check and load existing session
- [ ] Handle stale/corrupted session: fallback to empty state, clear silently

### 4. NewTask Modal Integration
- [ ] Modify `NewTaskModal.tsx` handleClose: save current step + messages to SessionStore
- [ ] Modify `NewTaskModal.tsx` open handler: restore step + selectedAgent + messages
- [ ] Add "Resumed session" indicator in header

### 5. Session Cleanup
- [ ] Clear task session when feature moves to completed queue (in queue change handler)
- [ ] Add manual "Clear session" option in modal UI

### 6. UI Indicator
- [ ] Add "Resumed session" subtle indicator in Feature Detail Modal Agent tab
- [ ] Add "Resumed session" subtle indicator in NewTask Modal header
- [ ] Auto-dismiss after 3 seconds, manual dismiss on click

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|

# Tasks: feat-task-execution-overlay

## Task Breakdown

### 1. Overlay State Layer (useQueueData 扩展)
- [x] Define `TaskExecutionOverlay` interface (featureId, status, startedAt, action, outputPreview)
- [x] Define `GhostCard` interface (tempId, featureId, name, targetQueue, status, startedAt, preview)
- [x] Add `overlayState` to useQueueData (Map<string, TaskExecutionOverlay>)
- [x] Add `ghostCards` state (GhostCard[])
- [x] Implement `setOverlay(featureId, partial)` — merge update
- [x] Implement `clearOverlay(featureId)` — remove
- [x] Implement `addGhostCard(ghost)` — push to ghostCards
- [x] Implement `updateGhostCard(tempId, partial)` — merge update
- [x] Implement `removeGhostCard(tempId)` — remove by tempId
- [x] Auto-cleanup in refresh(): clear overlays with status='done', remove ghostCards with matching real featureId
- [x] Error overlay 30s auto-cleanup via setTimeout

### 2. FeatureCard Overlay Visual (层面 A)
- [x] Add `overlay?: TaskExecutionOverlay` prop to FeatureCard
- [x] Conditional overlay rendering layer (absolute, semi-transparent)
- [x] Border color by status: dispatching=warning, streaming=primary+pulse, writing=secondary, done=tertiary, error=[#ffb4ab]
- [x] Status badge in card top-right (mini spinner + label)
- [x] Output preview: last 1-2 lines at card bottom (only in streaming)
- [x] Done status: 1.5s green flash then fadeout
- [x] Ensure overlay doesn't block card click (pointer-events-none on overlay, pointer-events-auto on card)

### 3. GhostFeatureCard Component (层面 B)
- [x] New `GhostFeatureCard` component in TaskBoard.tsx (co-located)
- [x] Visual: opacity-60, border-dashed, border-primary/30, animate-pulse
- [x] Top status bar: "Creating..." + spinner / "Synced ✓"
- [x] Display ghost.name and ghost.preview
- [x] onClick: open simplified detail (or no-op while creating)

### 4. TaskBoard Integration — Agent Send
- [x] Import overlay methods from useQueueData
- [x] handleAgentSend: call setOverlay(featureId, { status: 'dispatching', action }) before invoke
- [x] agent://chunk listener: update overlay status per chunk
  - First text chunk → streaming
  - Each text chunk → update outputPreview (last 2 lines)
  - is_done → writing
- [x] Error catch → setOverlay(featureId, { status: 'error' })

### 5. TaskBoard Integration — Column Rendering
- [x] Merge ghostCards into column items (ghosts prepended before real items — top of column)
- [x] Pass overlay prop from overlayState to each FeatureCard
- [x] Render GhostFeatureCard for ghost entries

### 6. NewTaskModal Integration — Ghost Card Trigger
- [x] Add `onGhostCardCreate?: (ghost: GhostCard) => void` prop to NewTaskModal
- [x] Built-in PM path: after generateFeaturePlan() succeeds, trigger onGhostCardCreate
- [x] External runtime path: after runtime_execute starts, trigger onGhostCardCreate
- [x] Pass onGhostCardCreate from TaskBoard to NewTaskModal

### 7. Cleanup & Edge Cases
- [x] Auto-cleanup on refresh(): done overlays removed, ghost cards with matching real ID removed
- [x] Error overlay 30s timeout cleanup
- [x] Page refresh: overlays/ghosts naturally cleared (in-memory only)
- [x] View mode switch (board/list/graph): overlay state persists in useQueueData

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|
| 2026-04-29 | All 7 tasks completed | Types in types.ts, overlay state in useQueueData.ts, visual layers in TaskBoard.tsx, ghost card trigger in NewTaskModal.tsx |

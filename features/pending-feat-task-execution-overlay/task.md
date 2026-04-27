# Tasks: feat-task-execution-overlay

## Task Breakdown

### 1. Overlay State Layer (useQueueData 扩展)
- [ ] Define `TaskExecutionOverlay` interface (featureId, status, startedAt, action, outputPreview)
- [ ] Define `GhostCard` interface (tempId, featureId, name, targetQueue, status, startedAt, preview)
- [ ] Add `overlayState` to useQueueData (Map<string, TaskExecutionOverlay>)
- [ ] Add `ghostCards` state (GhostCard[])
- [ ] Implement `setOverlay(featureId, partial)` — merge update
- [ ] Implement `clearOverlay(featureId)` — remove
- [ ] Implement `addGhostCard(ghost)` — push to ghostCards
- [ ] Implement `updateGhostCard(tempId, partial)` — merge update
- [ ] Implement `removeGhostCard(tempId)` — remove by tempId
- [ ] Auto-cleanup in refresh(): clear overlays with status='done', remove ghostCards with matching real featureId
- [ ] Error overlay 30s auto-cleanup via setTimeout

### 2. FeatureCard Overlay Visual (层面 A)
- [ ] Add `overlay?: TaskExecutionOverlay` prop to FeatureCard
- [ ] Conditional overlay rendering layer (absolute, semi-transparent)
- [ ] Border color by status: dispatching=warning, streaming=primary+pulse, writing=secondary, done=tertiary, error=[#ffb4ab]
- [ ] Status badge in card top-right (mini spinner + label)
- [ ] Output preview: last 1-2 lines at card bottom (only in streaming)
- [ ] Done status: 1.5s green flash then fadeout
- [ ] Ensure overlay doesn't block card click (pointer-events-none on overlay, pointer-events-auto on card)

### 3. GhostFeatureCard Component (层面 B)
- [ ] New `GhostFeatureCard` component in TaskBoard.tsx (co-located)
- [ ] Visual: opacity-60, border-dashed, border-primary/30, animate-pulse
- [ ] Top status bar: "Creating..." + spinner / "Synced ✓"
- [ ] Display ghost.name and ghost.preview
- [ onClick: open simplified detail (or no-op while creating)

### 4. TaskBoard Integration — Agent Send
- [ ] Import overlay methods from useQueueData
- [ ] handleAgentSend: call setOverlay(featureId, { status: 'dispatching', action }) before invoke
- [ ] agent://chunk listener: update overlay status per chunk
  - First text chunk → streaming
  - Each text chunk → update outputPreview (last 2 lines)
  - is_done → writing
- [ ] Error catch → setOverlay(featureId, { status: 'error' })

### 5. TaskBoard Integration — Column Rendering
- [ ] Merge ghostCards into column items (ghosts prepended before real items — top of column)
- [ ] Pass overlay prop from overlayState to each FeatureCard
- [ ] Render GhostFeatureCard for ghost entries

### 6. NewTaskModal Integration — Ghost Card Trigger
- [ ] Add `onGhostCardCreate?: (ghost: GhostCard) => void` prop to NewTaskModal
- [ ] Built-in PM path: after generateFeaturePlan() succeeds, trigger onGhostCardCreate
- [ ] External runtime path: after runtime_execute starts, trigger onGhostCardCreate
- [ ] Pass onGhostCardCreate from TaskBoard to NewTaskModal

### 7. Cleanup & Edge Cases
- [ ] Auto-cleanup on refresh(): done overlays removed, ghost cards with matching real ID removed
- [ ] Error overlay 30s timeout cleanup
- [ ] Page refresh: overlays/ghosts naturally cleared (in-memory only)
- [ ] View mode switch (board/list/graph): overlay state persists in useQueueData

## Progress Log
| Date | Progress | Notes |
|------|----------|-------|

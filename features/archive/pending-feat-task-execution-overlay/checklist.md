# Checklist: feat-task-execution-overlay

## Completion Checklist

### Development
- [ ] All tasks completed
- [ ] Code self-tested
- [ ] Overlay state machine works (dispatching → streaming → writing → done)
- [ ] Ghost card lifecycle works (creating → created → syncing → removed)
- [ ] Auto-cleanup on refresh works for both overlay and ghost cards

### Code Quality
- [ ] Code style follows conventions (cn(), types.ts patterns)
- [ ] No performance regression on board rendering
- [ ] Overlay state isolated from queue file state
- [ ] GhostCard properly typed and co-located

### Testing — 层面 A (Overlay)
- [ ] Manual test: Agent Send → card shows dispatching → streaming → done
- [ ] Manual test: Multiple concurrent overlays on different cards
- [ ] Edge case: refresh page mid-execution, overlays cleared gracefully
- [ ] Error case: agent fails, overlay shows error then auto-clears after 30s
- [ ] Overlay doesn't block card click interaction

### Testing — 层面 B (Ghost Card)
- [ ] Manual test: NewTask Create → ghost card appears in pending column
- [ ] Manual test: Ghost card replaced by real card after fs refresh
- [ ] Manual test: Ghost card shows preview text from streaming output
- [ ] Edge case: creation fails, ghost card shows error state

### Documentation
- [ ] spec.md technical solution filled
- [ ] Updated size from M to L (3 value points)

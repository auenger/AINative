# Checklist: feat-modal-session-store

## Completion Checklist

### Development
- [ ] All tasks completed
- [ ] Code self-tested
- [ ] SessionStore works across modal open/close cycles
- [ ] No memory leaks from unbounded session growth

### Code Quality
- [ ] Code style follows conventions (cn(), types.ts, etc.)
- [ ] No unnecessary external dependencies added
- [ ] Types defined in `types.ts` (NOT in SessionStore.tsx)
- [ ] SessionStore.tsx imports types from types.ts

### Capacity Management
- [ ] Task sessions capped at 20 entries with FIFO eviction
- [ ] agentOutput truncated at 40KB on save
- [ ] pmMessages / extMessages truncated at 200 entries on save
- [ ] Sessions older than 24h auto-cleared on load

### Error Handling
- [ ] Corrupted session data → fallback to empty state, no crash
- [ ] Expired session → silently cleared, normal open behavior
- [ ] Session eviction → no user-facing error

### Testing
- [ ] Manual test: close/reopen Feature Detail Modal preserves Agent state
- [ ] Manual test: close/reopen NewTaskModal preserves PM Agent conversation
- [ ] Manual test: multiple features have independent sessions
- [ ] Manual test: session cleared on feature completion
- [ ] Manual test: large agent output (>40KB) is truncated correctly
- [ ] Manual test: expired session (>24h) is silently cleared
- [ ] Manual test: 21st session evicts oldest

### Documentation
- [ ] spec.md technical solution filled

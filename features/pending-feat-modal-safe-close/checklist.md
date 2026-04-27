# Checklist: feat-modal-safe-close

## Completion Checklist

### Development
- [ ] All tasks completed
- [ ] Code self-tested
- [ ] Confirmation works for both Feature Detail and NewTask modals
- [ ] Session save on force close works

### Code Quality
- [ ] Minimal code changes (~20 lines per modal as planned)
- [ ] No new dependencies

### Testing
- [ ] Manual test: click backdrop during streaming → confirmation appears
- [ ] Manual test: click "Close" → session saved → reopen restores state
- [ ] Manual test: click "Continue Waiting" → streaming continues
- [ ] Manual test: close when idle → no confirmation, closes directly
- [ ] Manual test: Esc during confirmation → continues waiting

### Documentation
- [ ] spec.md technical solution filled

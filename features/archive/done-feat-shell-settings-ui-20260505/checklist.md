# Checklist: feat-shell-settings-ui
## Completion Checklist
### Development
- [x] All tasks completed (Task 4 optional/deferred)
- [x] Settings UI Shell dropdown available
- [x] Settings persistence works via useSettings + Tauri write_settings
- [x] Terminal creation uses user-selected Shell (XTerminal reads settings)
### Code Quality
- [x] Shell unavailable graceful fallback (console.warn + system default)
- [x] First use auto-selects system default (empty string = auto-detect)
- [x] Settings load/save no race conditions (AbortController + dirty guard)
### Testing
- [x] TypeScript compilation passes (no errors in modified files)
- [x] Vite build succeeds
- [ ] Settings YAML read/write test (no unit test framework configured)
- [ ] Shell switch terminal starts correctly (requires Tauri E2E)
### Documentation
- [x] spec.md technical solution filled

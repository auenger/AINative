# Checklist: feat-agent-acp-adapter

## Completion Checklist

### Development
- [x] All frontend tasks completed (Tasks 3-8)
- [ ] Rust backend tasks completed (Tasks 1-2, deferred to Tauri V2 phase)
- [x] Code self-tested (TypeScript compilation passes)

### Code Quality
- [x] JSON-RPC 2.0 protocol config matches spec for all 5 agents
- [x] AcpMessage types cover all notification categories
- [x] Agent config table complete (Codex/Hermes/Kiro/Kimi/Pi)
- [x] Error handling: error state set on invoke failure
- [x] Coexistence verified: zero changes to useAgentStream.ts

### Testing
- [x] TypeScript compilation: 0 errors in modified file
- [ ] Manual test: Codex JSON-RPC execution (requires Tauri backend)
- [ ] Manual test: Hermes ACP execution (requires Tauri backend)
- [ ] Manual test: Cancel execution (requires Tauri backend)
- [ ] Manual test: Approval auto-pass (requires Tauri backend)
- [ ] Manual test: Agent startup failure handling (requires Tauri backend)
- [x] Regression test: runtime_execute -> CodexRuntime -> agent://chunk path unaffected

### Documentation
- [x] spec.md technical solution filled
- [x] JSON-RPC lifecycle documented (agent config table with differences)

---

## Verification Record

| Timestamp | Status | Summary | Evidence |
|-----------|--------|---------|----------|
| 2026-04-30T16:30:00Z | PASS (frontend) | Frontend ACP adapter complete: types, hooks, rendering, coexistence verified. 21/21 frontend tasks done. Backend (10 tasks) deferred to Tauri V2 phase. | `evidence/verification-report.md` |

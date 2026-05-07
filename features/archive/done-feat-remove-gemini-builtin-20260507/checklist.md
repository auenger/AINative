# Checklist: feat-remove-gemini-builtin

## Completion Checklist

### Development
- [x] 所有 tasks 完成
- [x] Keyring crate 依赖已从 Cargo.toml 移除
- [x] 无残留 `get_api_key_inner` 调用
- [x] 无残留 `gemini` TerminalKind
- [x] 无残留 API Key Modal UI

### Code Quality
- [x] 代码风格符合项目规范
- [x] 无未使用的 import

### Testing
- [x] cargo check 通过
- [x] TypeScript 编译通过
- [ ] PM Agent 通过 Settings 配置的 Provider 正常工作（需手动验证）

### Documentation
- [x] spec.md technical solution 已填写

## Verification Record

| Date | Status | Result |
|------|--------|--------|
| 2026-05-07 | PASS | 6/6 task groups, 4/4 Gherkin scenarios, cargo check + tsc pass |

### Evidence
- `evidence/verification-report.md` — Full verification report
- Auto-fix applied: NewTaskModal.tsx apiKeyConfigured cleanup

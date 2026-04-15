# Checklist: fix-settings-api-base-url

## Completion Checklist

### Development
- [x] 根因确认并有复现步骤
- [x] 修复代码已实现
- [x] 代码自测通过

### Code Quality
- [x] 代码风格遵循项目约定 (React.FC, cn(), types.ts)
- [x] 无不必要的重构或额外改动
- [x] 无硬编码值或 magic numbers

### Testing
- [x] API Base URL 可正常编辑且值不回退 (Scenario 1 & 2)
- [x] Save 后持久化正确 (Scenario 3)
- [x] Tab 切换不丢失未保存修改 (Scenario 4)
- [x] API Key 编辑不受影响
- [x] 新增/删除供应商不受影响
- [x] Test Connection 功能正常

### Documentation
- [x] spec.md Technical Solution 已填写实际实施方案
- [x] task.md Progress Log 已更新

---

## Verification Record

| Field | Value |
|-------|-------|
| **Timestamp** | 2026-04-15T10:30:00Z |
| **Status** | PASS |
| **Method** | Code Analysis (no browser E2E available) |
| **TypeScript** | 0 new errors (2 pre-existing unrelated) |
| **Unit Tests** | N/A (no project test suite) |
| **Gherkin Scenarios** | 4/4 PASS (code analysis) |
| **General Checks** | 4/4 PASS |
| **Evidence** | `features/active-fix-settings-api-base-url/evidence/` |
